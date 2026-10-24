use app_lib::db::Database;
use app_lib::keys::KeyManager;
use app_lib::models::{HostConfig, SSHTunnel};
use app_lib::ssh_engine::SSHEngine;
use app_lib::tunnel::TunnelEngine;
use app_lib::vault::SecureVault;
use std::fs;
use std::process::{Child, Command};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;

struct TestSSHDServer {
    child: Child,
    temp_dir: std::path::PathBuf,
    _port: u16,
}

impl Drop for TestSSHDServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = fs::remove_dir_all(&self.temp_dir);
    }
}

fn spawn_test_sshd(port: u16) -> (TestSSHDServer, String, String) {
    let test_dir = std::env::temp_dir().join(format!("termissh_integ_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&test_dir).expect("Failed to create test directory");

    let host_key_path = test_dir.join("ssh_host_ed25519_key");
    let auth_keys_path = test_dir.join("authorized_keys");
    let config_path = test_dir.join("sshd_config");
    let pid_path = test_dir.join("sshd.pid");

    // Generate server host key
    let status = Command::new("ssh-keygen")
        .args(["-t", "ed25519", "-f", host_key_path.to_str().unwrap(), "-N", "", "-q"])
        .status()
        .expect("Failed to generate test server host key");
    assert!(status.success());

    // Generate client key pair
    let client_key_path = test_dir.join("id_ed25519");
    let status = Command::new("ssh-keygen")
        .args(["-t", "ed25519", "-f", client_key_path.to_str().unwrap(), "-N", "", "-q"])
        .status()
        .expect("Failed to generate test client key");
    assert!(status.success());

    let client_pub_content = fs::read_to_string(format!("{}.pub", client_key_path.to_str().unwrap()))
        .expect("Failed to read client pub key");
    let client_priv_content = fs::read_to_string(&client_key_path)
        .expect("Failed to read client priv key");

    // Write authorized_keys
    fs::write(&auth_keys_path, &client_pub_content).expect("Failed to write authorized_keys");

    // Write sshd_config
    let config_content = format!(
        "Port {}\n\
        ListenAddress 127.0.0.1\n\
        HostKey {}\n\
        PidFile {}\n\
        AuthorizedKeysFile {}\n\
        StrictModes no\n\
        UsePAM no\n\
        PermitRootLogin no\n\
        PasswordAuthentication no\n\
        PubkeyAuthentication yes\n\
        Subsystem sftp /usr/lib/openssh/sftp-server\n",
        port,
        host_key_path.display(),
        pid_path.display(),
        auth_keys_path.display()
    );
    fs::write(&config_path, config_content).expect("Failed to write sshd_config");

    // Spawn unprivileged sshd daemon
    let child = Command::new("/usr/sbin/sshd")
        .args(["-D", "-e", "-f", config_path.to_str().unwrap()])
        .spawn()
        .expect("Failed to spawn unprivileged test sshd");

    (
        TestSSHDServer {
            child,
            temp_dir: test_dir,
            _port: port,
        },
        client_priv_content,
        client_pub_content,
    )
}

#[tokio::test]
async fn test_ssh_engine_end_to_end() {
    let port = 22222;
    let (server, client_priv, _client_pub) = spawn_test_sshd(port);

    // Give sshd time to bind and listen
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Setup local TermiSSH environment
    let app_dir = std::env::temp_dir().join(format!("termissh_app_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&app_dir).unwrap();

    let db = Arc::new(Database::new(app_dir.clone()));
    let vault = Arc::new(SecureVault::new(app_dir.clone()));
    let ssh_engine = Arc::new(SSHEngine::new(db.clone(), vault.clone()));
    let _km = KeyManager::new(db.clone(), vault.clone());

    // Import client private key into vault & db
    let key_id = "test-client-key";
    let key_secret_id = format!("vault://{}", key_id);
    vault.store(&key_secret_id, &client_priv).expect("Vault store failed");

    let current_user = std::env::var("USER").unwrap_or_else(|_| "alish".to_string());
    let host_id = "test-local-sshd";
    let host = HostConfig {
        id: host_id.to_string(),
        name: "Local Test SSHD".to_string(),
        description: Some("Automated test server".to_string()),
        hostname: "127.0.0.1".to_string(),
        port,
        username: current_user.clone(),
        auth_type: "private_key".to_string(),
        password: None,
        key_id: Some(key_id.to_string()),
        key_passphrase: None,
        group_id: None,
        tags: Some(vec!["test".to_string()]),
        jump_host_id: None,
        proxy_command: None,
        identity_file: None,
        timeout_seconds: Some(10),
        keepalive_interval: Some(30),
        terminal_theme: None,
        font_size: None,
        protocol: Some("ssh".to_string()),
        baud_rate: None,
        data_bits: None,
        stop_bits: None,
        parity: None,
        flow_control: None,
        created_at: None,
        updated_at: None,
    };
    db.save_host(&host).expect("Save host failed");

    // ==========================================
    // 1. Test TOFU (Trust On First Use) Host Key
    // ==========================================
    let session_id = ssh_engine
        .start_session(host_id, 80, 24, None, None, None)
        .await
        .expect("SSH connection with TOFU failed");

    // Verify host key was saved in SQLite known_hosts table
    let known_fp = db
        .get_known_host_key("127.0.0.1", port)
        .expect("Failed to query known_host")
        .expect("Known host key was not recorded on first use!");
    assert!(known_fp.starts_with("SHA256:"));

    // ==========================================
    // 2. Test Interactive Terminal Shell Streaming
    // ==========================================
    let mut rx = ssh_engine
        .subscribe_output(&session_id)
        .await
        .expect("Failed to subscribe to terminal output");

    // Send a shell echo command
    let marker = "TERMISSH_INTEG_OK";
    ssh_engine
        .send_data(&session_id, format!("echo '{}'\n", marker))
        .await
        .expect("Failed to send terminal data");

    let mut output_accum = String::new();
    let collect_timeout = tokio::time::timeout(Duration::from_secs(5), async {
        while let Ok(chunk) = rx.recv().await {
            output_accum.push_str(&chunk);
            if output_accum.contains(marker) {
                return true;
            }
        }
        false
    });

    let reached_marker = collect_timeout.await.unwrap_or(false);
    assert!(reached_marker, "Did not receive echoed marker in terminal stream! Got: {}", output_accum);

    // Test terminal window resize (PTY resize)
    ssh_engine.resize(&session_id, 120, 40).await.expect("PTY resize failed");

    // Close terminal session
    ssh_engine.close_session(&session_id).await.expect("Close session failed");

    // ==========================================
    // 3. Test Host Key Mismatch Detection (Security Rule)
    // ==========================================
    // Tamper with SQLite known_hosts to simulate MITM or changed server key
    let forged_key = "SHA256:FAKEKEYFORGED000000000000000000000000000000=";
    db.save_known_host("127.0.0.1", port, "ssh-ed25519", forged_key).expect("Tamper failed");

    // Connection must be rejected due to host key mismatch!
    let mismatch_attempt = ssh_engine.start_session(host_id, 80, 24, None, None, None).await;
    assert!(
        mismatch_attempt.is_err(),
        "Security failure: Connection should have been rejected due to host key mismatch!"
    );

    // Restore legitimate key
    db.save_known_host("127.0.0.1", port, "ssh-ed25519", &known_fp).expect("Restore failed");

    // ==========================================
    // 4. Test SFTP File Management
    // ==========================================
    let test_sftp_dir = format!("{}/sftp_test_dir", server.temp_dir.display());
    ssh_engine
        .sftp_mkdir(host_id, &test_sftp_dir)
        .await
        .expect("SFTP mkdir failed");

    let remote_file = format!("{}/hello_termissh.txt", test_sftp_dir);
    let sample_content = "TermiSSH High-Performance Secure Shell Client\nLine 2 with UTF-8: 🚀🔒";
    ssh_engine
        .sftp_write_file(host_id, &remote_file, sample_content)
        .await
        .expect("SFTP write failed");

    // Verify remote file read
    let read_back = ssh_engine
        .sftp_read_file(host_id, &remote_file)
        .await
        .expect("SFTP read failed");
    assert_eq!(read_back, sample_content);

    // Directory listing
    let entries = ssh_engine
        .sftp_list(host_id, &test_sftp_dir)
        .await
        .expect("SFTP list failed");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "hello_termissh.txt");
    assert!(!entries[0].is_dir);

    // Streaming upload and download
    let local_upload_path = server.temp_dir.join("local_upload.dat");
    fs::write(&local_upload_path, b"Streaming file transfer verification payload").unwrap();
    let remote_uploaded_dest = format!("{}/streamed.dat", test_sftp_dir);

    ssh_engine
        .sftp_upload(host_id, local_upload_path.to_str().unwrap(), &remote_uploaded_dest)
        .await
        .expect("SFTP upload failed");

    let local_download_path = server.temp_dir.join("downloaded.dat");
    ssh_engine
        .sftp_download(host_id, &remote_uploaded_dest, local_download_path.to_str().unwrap())
        .await
        .expect("SFTP download failed");

    let downloaded_bytes = fs::read(&local_download_path).unwrap();
    assert_eq!(downloaded_bytes, b"Streaming file transfer verification payload");

    // Delete remote file
    ssh_engine
        .sftp_delete(host_id, &remote_file, false)
        .await
        .expect("SFTP delete file failed");

    // ==========================================
    // 5. Test Port Forwarding (Direct TCP/IP Tunnel)
    // ==========================================
    let tunnel_engine = Arc::new(TunnelEngine::new(db.clone(), ssh_engine.clone()));
    let tunnel_local_port = 23333;
    let tunnel_id = "test-integ-tunnel";

    let tunnel_config = SSHTunnel {
        id: tunnel_id.to_string(),
        host_id: host_id.to_string(),
        name: "Test Forward to SSHD".to_string(),
        tunnel_type: "local".to_string(),
        local_host: "127.0.0.1".to_string(),
        local_port: tunnel_local_port,
        remote_host: Some("127.0.0.1".to_string()),
        remote_port: Some(port),
        status: "inactive".to_string(),
        error_message: None,
    };
    db.save_tunnel(&tunnel_config).expect("Save tunnel failed");

    tunnel_engine.start_tunnel(tunnel_id).await.expect("Start tunnel failed");

    // Connect to local tunnel port and read SSH greeting banner
    let mut stream = TcpStream::connect(format!("127.0.0.1:{}", tunnel_local_port))
        .await
        .expect("Failed to connect to local forwarded port");

    let mut banner_buf = [0u8; 64];
    let n = stream.read(&mut banner_buf).await.expect("Failed to read forwarded stream");
    let banner = String::from_utf8_lossy(&banner_buf[..n]);
    assert!(banner.starts_with("SSH-2.0-OpenSSH"), "Forwarded stream banner did not match SSH! Got: {}", banner);

    // Stop tunnel
    tunnel_engine.stop_tunnel(tunnel_id).await.expect("Stop tunnel failed");

    // Cleanup app test dir
    let _ = fs::remove_dir_all(app_dir);
}
