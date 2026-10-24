use crate::db::Database;
use crate::keys::KeyManager;
use crate::local_engine::LocalEngine;
use crate::models::*;
use crate::serial_engine::SerialEngine;
use crate::ssh_engine::SSHEngine;
use crate::telnet_engine::TelnetEngine;
use crate::tunnel::TunnelEngine;
use crate::vault::SecureVault;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

pub struct AppState {
    pub db: Arc<Database>,
    pub vault: Arc<SecureVault>,
    pub keys: Arc<KeyManager>,
    pub ssh: Arc<SSHEngine>,
    pub telnet: Arc<TelnetEngine>,
    pub local: Arc<LocalEngine>,
    pub serial: Arc<SerialEngine>,
    pub tunnels: Arc<TunnelEngine>,
}

// HOSTS
#[tauri::command]
pub async fn get_hosts(state: State<'_, AppState>) -> Result<Vec<HostConfig>, String> {
    state.db.get_hosts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_host(
    host: HostConfig,
    state: State<'_, AppState>,
) -> Result<HostConfig, String> {
    let mut h = host;
    if h.id.is_empty() {
        h.id = format!("host-{}", Uuid::new_v4());
    }

    // If password provided, store in vault securely
    if let Some(ref pwd) = h.password {
        if !pwd.is_empty() {
            let secret_id = format!("vault://host-pwd-{}", h.id);
            state.vault.store(&secret_id, pwd).map_err(|e| e.to_string())?;
        }
    }

    state.db.save_host(&h).map_err(|e| e.to_string())?;
    Ok(h)
}

#[tauri::command]
pub async fn delete_host(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let secret_id = format!("vault://host-pwd-{}", id);
    state.vault.delete(&secret_id).ok();
    state.db.delete_host(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ssh_config() -> Result<SSHConfigFileInfo, String> {
    let ssh_dir = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?
        .join(".ssh");
    let config_path = ssh_dir.join("config");
    let backup_path = ssh_dir.join("config.bak");

    let path_str = config_path.to_string_lossy().to_string();
    let backup_str = if backup_path.exists() {
        Some(backup_path.to_string_lossy().to_string())
    } else {
        None
    };

    if !config_path.exists() {
        return Ok(SSHConfigFileInfo {
            path: path_str,
            content: String::new(),
            exists: false,
            permissions: None,
            modified_at: None,
            backup_path: backup_str,
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read {}: {}", path_str, e))?;

    let meta = fs::metadata(&config_path).ok();
    let permissions = meta.as_ref().map(|m| {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            format!("0{:o}", m.mode() & 0o777)
        }
        #[cfg(not(unix))]
        {
            "0600".to_string()
        }
    });

    let modified_at = meta.and_then(|m| m.modified().ok()).map(|sys_time| {
        let dt: chrono::DateTime<chrono::Utc> = sys_time.into();
        dt.to_rfc3339()
    });

    Ok(SSHConfigFileInfo {
        path: path_str,
        content,
        exists: true,
        permissions,
        modified_at,
        backup_path: backup_str,
    })
}

#[tauri::command]
pub async fn save_ssh_config(
    content: String,
    create_backup: bool,
) -> Result<String, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not determine home directory".to_string())?;
    let ssh_dir = home.join(".ssh");
    let config_path = ssh_dir.join("config");

    if !ssh_dir.exists() {
        fs::create_dir_all(&ssh_dir)
            .map_err(|e| format!("Failed to create ~/.ssh directory: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&ssh_dir, fs::Permissions::from_mode(0o700));
        }
    }

    let mut backup_info = String::new();
    if create_backup && config_path.exists() {
        let bak_path = ssh_dir.join("config.bak");
        fs::copy(&config_path, &bak_path)
            .map_err(|e| format!("Failed to create backup at {}: {}", bak_path.display(), e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&bak_path, fs::Permissions::from_mode(0o600));
        }
        backup_info = format!(" (backup saved to {})", bak_path.display());
    }

    fs::write(&config_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", config_path.display(), e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&config_path, fs::Permissions::from_mode(0o600));
    }

    Ok(format!("Saved successfully to {}{}", config_path.display(), backup_info))
}

pub fn format_hosts_as_ssh_config_internal(
    host_ids: &[String],
    db: &Database,
) -> Result<String, String> {
    let all_hosts = db.get_hosts().map_err(|e| e.to_string())?;
    let keys = db.get_ssh_keys().unwrap_or_default();
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/home/alish"));

    let selected: Vec<&HostConfig> = if host_ids.is_empty() {
        all_hosts.iter().collect()
    } else {
        all_hosts.iter().filter(|h| host_ids.contains(&h.id)).collect()
    };

    let mut output = String::new();
    for host in selected {
        output.push_str(&format!("\n# Host: {}\n", host.name));
        let alias = host.name.replace(' ', "-").to_lowercase();
        output.push_str(&format!("Host {}\n", alias));
        output.push_str(&format!("    HostName {}\n", host.hostname));
        output.push_str(&format!("    User {}\n", host.username));
        if host.port != 22 {
            output.push_str(&format!("    Port {}\n", host.port));
        }

        if let Some(ref kid) = host.key_id {
            if let Some(key) = keys.iter().find(|k| &k.id == kid) {
                let default_key_path = home.join(".ssh").join(format!("id_{}", key.key_type));
                if default_key_path.exists() {
                    output.push_str(&format!("    IdentityFile {}\n", default_key_path.display()));
                }
            }
        }

        if let Some(ref jid) = host.jump_host_id {
            if let Some(jh) = all_hosts.iter().find(|h| &h.id == jid) {
                let jh_alias = jh.name.replace(' ', "-").to_lowercase();
                output.push_str(&format!("    ProxyJump {}\n", jh_alias));
            }
        }

        if let Some(ref pc) = host.proxy_command {
            output.push_str(&format!("    ProxyCommand {}\n", pc));
        }

        if let Some(ref idf) = host.identity_file {
            output.push_str(&format!("    IdentityFile {}\n", idf));
        }

        if let Some(keepalive) = host.keepalive_interval {
            if keepalive > 0 {
                output.push_str(&format!("    ServerAliveInterval {}\n", keepalive));
                output.push_str("    ServerAliveCountMax 3\n");
            }
        }
    }

    Ok(output)
}

#[tauri::command]
pub async fn format_hosts_as_ssh_config(
    host_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    format_hosts_as_ssh_config_internal(&host_ids, &state.db)
}

pub fn import_config_internal(
    content: &str,
    db: &Database,
) -> Result<Vec<HostConfig>, String> {
    let existing_hosts = db.get_hosts().unwrap_or_default();
    let mut imported = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_host = "127.0.0.1".to_string();
    let mut current_user = "root".to_string();
    let mut current_port = 22u16;
    let mut current_proxy_command: Option<String> = None;
    let mut current_identity_file: Option<String> = None;
    let mut current_key_note: Option<String> = None;

    let flush_host = |name: String,
                      host: String,
                      user: String,
                      port: u16,
                      proxy_cmd: Option<String>,
                      identity_file: Option<String>,
                      key_note: Option<String>,
                      existing: &[HostConfig]|
     -> HostConfig {
        let existing_match = existing.iter().find(|h| h.name == name || (h.hostname == host && h.port == port && h.username == user));
        let id = match existing_match {
            Some(existing_h) => existing_h.id.clone(),
            None => format!("host-{}", Uuid::new_v4()),
        };

        let mut desc = match key_note {
            Some(k) => format!("Imported from OpenSSH config ({})", k),
            None => "Imported from OpenSSH config".to_string(),
        };

        if let Some(ref pc) = proxy_cmd {
            if pc.contains("cloudflared") {
                desc.push_str(" [Cloudflare Tunnel]");
            }
        }

        HostConfig {
            id,
            name,
            description: Some(desc),
            hostname: host,
            port,
            username: user,
            auth_type: "agent".to_string(),
            password: None,
            key_id: None,
            key_passphrase: None,
            group_id: None,
            tags: Some(vec!["imported".to_string()]),
            timeout_seconds: Some(15),
            keepalive_interval: Some(30),
            jump_host_id: None,
            proxy_command: proxy_cmd,
            identity_file,
            terminal_theme: Some("dark".to_string()),
            font_size: Some(14),
            protocol: Some("ssh".to_string()),
            baud_rate: None,
            data_bits: None,
            stop_bits: None,
            parity: None,
            flow_control: None,
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            updated_at: Some(chrono::Utc::now().to_rfc3339()),
        }
    };

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Check for ProxyCommand first (preserves full command line with arguments)
        let lower = trimmed.to_lowercase();
        if lower.starts_with("proxycommand") {
            if let Some(cmd) = trimmed.strip_prefix("ProxyCommand").or_else(|| trimmed.strip_prefix("proxycommand")) {
                let clean = cmd.trim().trim_start_matches('=').trim();
                current_proxy_command = Some(clean.to_string());
            }
            continue;
        }

        // Check for IdentityFile
        if lower.starts_with("identityfile") {
            if let Some(idf) = trimmed.strip_prefix("IdentityFile").or_else(|| trimmed.strip_prefix("identityfile")) {
                let clean = idf.trim().trim_start_matches('=').trim();
                current_identity_file = Some(clean.to_string());
                current_key_note = Some(format!("key: {}", clean));
            }
            continue;
        }

        // Normalize space-or-equals separated directives
        let normalized = trimmed.replace('=', " ");
        let parts: Vec<&str> = normalized.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0].to_lowercase().as_str() {
            "host" => {
                if let Some(name) = current_name.take() {
                    let h = flush_host(
                        name,
                        current_host.clone(),
                        current_user.clone(),
                        current_port,
                        current_proxy_command.take(),
                        current_identity_file.take(),
                        current_key_note.take(),
                        &existing_hosts,
                    );
                    db.save_host(&h).map_err(|e| e.to_string())?;
                    imported.push(h);
                }
                if parts.len() > 1 && parts[1] != "*" {
                    current_name = Some(parts[1].to_string());
                    current_host = parts[1].to_string();
                    current_user = "root".to_string();
                    current_port = 22;
                    current_proxy_command = None;
                    current_identity_file = None;
                    current_key_note = None;
                }
            }
            "hostname" => {
                if parts.len() > 1 {
                    current_host = parts[1].to_string();
                }
            }
            "user" => {
                if parts.len() > 1 {
                    current_user = parts[1].to_string();
                }
            }
            "port" => {
                if parts.len() > 1 {
                    current_port = parts[1].parse().unwrap_or(22);
                }
            }
            _ => {}
        }
    }

    if let Some(name) = current_name {
        let h = flush_host(
            name,
            current_host,
            current_user,
            current_port,
            current_proxy_command,
            current_identity_file,
            current_key_note,
            &existing_hosts,
        );
        db.save_host(&h).map_err(|e| e.to_string())?;
        imported.push(h);
    }

    Ok(imported)
}

#[tauri::command]
pub async fn import_openssh_config(
    content: String,
    state: State<'_, AppState>,
) -> Result<Vec<HostConfig>, String> {
    import_config_internal(&content, &state.db)
}

// GROUPS
#[tauri::command]
pub async fn get_groups(state: State<'_, AppState>) -> Result<Vec<HostGroup>, String> {
    state.db.get_groups().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_group(
    group: HostGroup,
    state: State<'_, AppState>,
) -> Result<HostGroup, String> {
    let mut g = group;
    if g.id.is_empty() {
        g.id = format!("grp-{}", Uuid::new_v4());
    }
    state.db.save_group(&g).map_err(|e| e.to_string())?;
    Ok(g)
}

#[tauri::command]
pub async fn delete_group(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_group(&id).map_err(|e| e.to_string())
}

// INTERACTIVE SSH
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub session_id: String,
}

#[tauri::command]
pub async fn start_ssh_session(
    host_id: String,
    cols: u32,
    rows: u32,
    override_password: Option<String>,
    override_passphrase: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionResponse, String> {
    let host = state
        .db
        .get_host(&host_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Host not found".to_string())?;

    if host.protocol.as_deref() == Some("serial") {
        let session_id = state
            .serial
            .start_session(&host, app_handle)
            .await?;
        return Ok(SessionResponse { session_id });
    }

    if host.protocol.as_deref() == Some("telnet") {
        let session_id = state
            .telnet
            .start_session(&host, cols, rows, Some(app_handle))
            .await?;
        return Ok(SessionResponse { session_id });
    }

    let session_id = state
        .ssh
        .start_session(
            &host_id,
            cols,
            rows,
            override_password,
            override_passphrase,
            Some(app_handle),
        )
        .await?;

    Ok(SessionResponse { session_id })
}

#[tauri::command]
pub async fn open_local_session(
    cols: u32,
    rows: u32,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionResponse, String> {
    let session_id = format!("local-{}", Uuid::new_v4());
    state
        .local
        .start_session(session_id.clone(), cols as u16, rows as u16, app_handle)
        .await?;
    Ok(SessionResponse { session_id })
}

#[tauri::command]
pub async fn send_terminal_data(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.local.has_session(&session_id).await {
        state.local.send_data(&session_id, data).await
    } else if state.telnet.has_session(&session_id).await {
        state.telnet.send_data(&session_id, data).await
    } else if state.serial.has_session(&session_id).await {
        state.serial.send_data(&session_id, &data).await
    } else {
        state.ssh.send_data(&session_id, data).await
    }
}

#[tauri::command]
pub async fn resize_terminal(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.local.has_session(&session_id).await {
        state.local.resize(&session_id, cols, rows).await
    } else if state.telnet.has_session(&session_id).await {
        state.telnet.resize(&session_id, cols, rows).await
    } else if state.serial.has_session(&session_id).await {
        state.serial.resize(&session_id, cols, rows).await
    } else {
        state.ssh.resize(&session_id, cols, rows).await
    }
}

#[tauri::command]
pub async fn close_ssh_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.local.has_session(&session_id).await {
        state.local.close_session(&session_id).await
    } else if state.telnet.has_session(&session_id).await {
        state.telnet.close_session(&session_id).await
    } else if state.serial.has_session(&session_id).await {
        state.serial.close_session(&session_id).await;
        Ok(())
    } else {
        state.ssh.close_session(&session_id).await
    }
}

// HOST KEY VERIFICATION
#[tauri::command]
pub async fn resolve_host_key(
    host: String,
    port: u16,
    fingerprint: String,
    accept: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.resolve_host_key(&host, port, &fingerprint, accept);
    Ok(())
}

// SSH KEYS
#[tauri::command]
pub async fn get_ssh_keys(state: State<'_, AppState>) -> Result<Vec<SSHKeyItem>, String> {
    state.db.get_ssh_keys().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_ssh_key(
    name: String,
    key_type: String,
    passphrase: Option<String>,
    bits: Option<u32>,
    state: State<'_, AppState>,
) -> Result<SSHKeyItem, String> {
    state.keys.generate_key(&name, &key_type, passphrase.as_deref(), bits)
}

#[tauri::command]
pub async fn import_ssh_key(
    name: String,
    private_key_content: String,
    passphrase: Option<String>,
    state: State<'_, AppState>,
) -> Result<SSHKeyItem, String> {
    state.keys.import_key(&name, &private_key_content, passphrase.as_deref())
}

#[tauri::command]
pub async fn get_private_key(
    key_id: String,
    passphrase: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.keys.get_private_key(&key_id, passphrase.as_deref())
}

#[tauri::command]
pub async fn delete_ssh_key(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.keys.delete_key(&id)
}

// SFTP
#[tauri::command]
pub async fn sftp_list(
    host_id: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<FileEntry>, String> {
    state.ssh.sftp_list(&host_id, &remote_path).await
}

#[tauri::command]
pub async fn sftp_read_file(
    host_id: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.ssh.sftp_read_file(&host_id, &remote_path).await
}

#[tauri::command]
pub async fn sftp_write_file(
    host_id: String,
    remote_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.sftp_write_file(&host_id, &remote_path, &content).await
}

#[tauri::command]
pub async fn sftp_delete(
    host_id: String,
    remote_path: String,
    is_dir: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.sftp_delete(&host_id, &remote_path, is_dir).await
}

#[tauri::command]
pub async fn sftp_mkdir(
    host_id: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.sftp_mkdir(&host_id, &remote_path).await
}

#[tauri::command]
pub async fn sftp_upload(
    host_id: String,
    local_path: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.sftp_upload(&host_id, &local_path, &remote_path).await
}

#[tauri::command]
pub async fn sftp_download(
    host_id: String,
    remote_path: String,
    local_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ssh.sftp_download(&host_id, &remote_path, &local_path).await
}

// LOCAL FILESYSTEM
#[tauri::command]
pub async fn local_list(local_path: String) -> Result<Vec<FileEntry>, String> {
    let p = Path::new(&local_path);
    if !p.exists() {
        return Err("Directory does not exist".to_string());
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(p).map_err(|e| e.to_string())?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        let is_dir = meta.as_ref().map_or(false, |m| m.is_dir());
        let size = meta.as_ref().map_or(0, |m| m.len());
        let modified = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs());

        entries.push(FileEntry {
            name,
            path,
            is_dir,
            size,
            permissions: if is_dir { "drwxr-xr-x".to_string() } else { "-rw-r--r--".to_string() },
            modified,
        });
    }

    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(entries)
}

#[tauri::command]
pub async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "/home".to_string())
}

// TUNNELS
#[tauri::command]
pub async fn get_tunnels(state: State<'_, AppState>) -> Result<Vec<SSHTunnel>, String> {
    state.db.get_tunnels().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_tunnel(
    tunnel: SSHTunnel,
    state: State<'_, AppState>,
) -> Result<SSHTunnel, String> {
    let mut t = tunnel;
    if t.id.is_empty() {
        t.id = format!("tun-{}", Uuid::new_v4());
    }
    state.db.save_tunnel(&t).map_err(|e| e.to_string())?;
    Ok(t)
}

#[tauri::command]
pub async fn delete_tunnel(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.tunnels.stop_tunnel(&id).await.ok();
    state.db.delete_tunnel(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_tunnel(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.tunnels.start_tunnel(&id).await
}

#[tauri::command]
pub async fn stop_tunnel(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.tunnels.stop_tunnel(&id).await
}

// SNIPPETS
#[tauri::command]
pub async fn get_snippets(state: State<'_, AppState>) -> Result<Vec<CommandSnippet>, String> {
    state.db.get_snippets().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_snippet(
    snippet: CommandSnippet,
    state: State<'_, AppState>,
) -> Result<CommandSnippet, String> {
    let mut s = snippet;
    if s.id.is_empty() {
        s.id = format!("snip-{}", Uuid::new_v4());
    }
    state.db.save_snippet(&s).map_err(|e| e.to_string())?;
    Ok(s)
}

#[tauri::command]
pub async fn delete_snippet(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_snippet(&id).map_err(|e| e.to_string())
}

// WORKSPACES
#[tauri::command]
pub async fn get_workspaces(state: State<'_, AppState>) -> Result<Vec<WorkspaceItem>, String> {
    state.db.get_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_workspace(
    workspace: WorkspaceItem,
    state: State<'_, AppState>,
) -> Result<WorkspaceItem, String> {
    let mut w = workspace;
    if w.id.is_empty() {
        w.id = format!("ws-{}", Uuid::new_v4());
    }
    state.db.save_workspace(&w).map_err(|e| e.to_string())?;
    Ok(w)
}

#[tauri::command]
pub async fn delete_workspace(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_workspace(&id).map_err(|e| e.to_string())
}

// HISTORY
#[tauri::command]
pub async fn get_history(state: State<'_, AppState>) -> Result<Vec<ConnectionHistoryEntry>, String> {
    state.db.get_history().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_history().map_err(|e| e.to_string())
}

// SETTINGS
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_settings(&settings).map_err(|e| e.to_string())
}

// BACKUP & RESTORE
#[tauri::command]
pub async fn export_backup_data(
    password: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let container = crate::backup::BackupManager::create_backup(
        &state.db,
        &state.vault,
        password.as_deref(),
    )?;
    serde_json::to_string_pretty(&container).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_backup_file(
    path: String,
    password: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let container = crate::backup::BackupManager::create_backup(
        &state.db,
        &state.vault,
        password.as_deref(),
    )?;
    let json_str = serde_json::to_string_pretty(&container).map_err(|e| e.to_string())?;
    crate::backup::BackupManager::save_to_file(&path, &json_str)
}

#[tauri::command]
pub async fn read_backup_file(path: String) -> Result<String, String> {
    crate::backup::BackupManager::read_from_file(&path)
}

#[tauri::command]
pub async fn preview_backup_data(
    backup_json: String,
    password: Option<String>,
    state: State<'_, AppState>,
) -> Result<crate::backup::BackupPreview, String> {
    let container = serde_json::from_str::<crate::backup::BackupContainer>(&backup_json)
        .map_err(|e| format!("Invalid backup file format: {}", e))?;
    crate::backup::BackupManager::preview(&container, &state.vault, password.as_deref())
}

#[tauri::command]
pub async fn restore_backup_data(
    backup_json: String,
    password: Option<String>,
    options: crate::backup::RestoreOptions,
    state: State<'_, AppState>,
) -> Result<crate::backup::BackupPreview, String> {
    let container = serde_json::from_str::<crate::backup::BackupContainer>(&backup_json)
        .map_err(|e| format!("Invalid backup file format: {}", e))?;
    crate::backup::BackupManager::restore(
        &state.db,
        &state.vault,
        &container,
        password.as_deref(),
        &options,
    )
}

// SERIAL PORTS
#[tauri::command]
pub async fn list_serial_ports(state: State<'_, AppState>) -> Result<Vec<SerialPortInfo>, String> {
    Ok(state.serial.list_ports())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_ssh_config_reads_or_reports_missing() {
        let res = get_ssh_config().await;
        assert!(res.is_ok());
        let info = res.unwrap();
        assert!(info.path.contains(".ssh/config"));
        if info.exists {
            assert!(info.permissions.is_some());
        }
    }

    #[test]
    fn test_import_and_format_openssh_config() {
        let test_dir = std::env::temp_dir().join(format!("termissh_cmd_test_{}", Uuid::new_v4()));
        std::fs::create_dir_all(&test_dir).unwrap();
        let db = Database::new(test_dir.join("test.db"));

        let sample = r#"
# Sample OpenSSH config
Host dev-bastion
    HostName 10.0.0.1
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_ed25519
    ProxyCommand /usr/local/bin/cloudflared access ssh --hostname %h

Host web-node
    HostName 10.0.0.2
    User ubuntu
    Port 22
    ProxyJump dev-bastion
"#;

        let imported = import_config_internal(sample, &db).expect("import should succeed");
        assert_eq!(imported.len(), 2);
        assert_eq!(imported[0].name, "dev-bastion");
        assert_eq!(imported[0].hostname, "10.0.0.1");
        assert_eq!(imported[0].username, "admin");
        assert_eq!(imported[0].port, 2222);
        assert_eq!(imported[0].proxy_command.as_deref(), Some("/usr/local/bin/cloudflared access ssh --hostname %h"));
        assert_eq!(imported[0].identity_file.as_deref(), Some("~/.ssh/id_ed25519"));

        assert_eq!(imported[1].name, "web-node");
        assert_eq!(imported[1].hostname, "10.0.0.2");
        assert_eq!(imported[1].username, "ubuntu");
        assert_eq!(imported[1].port, 22);

        // Test formatting back to OpenSSH config format
        let formatted = format_hosts_as_ssh_config_internal(&[], &db).expect("format should succeed");
        assert!(formatted.contains("Host dev-bastion"));
        assert!(formatted.contains("HostName 10.0.0.1"));
        assert!(formatted.contains("User admin"));
        assert!(formatted.contains("Port 2222"));
        assert!(formatted.contains("ProxyCommand /usr/local/bin/cloudflared access ssh --hostname %h"));
        assert!(formatted.contains("IdentityFile ~/.ssh/id_ed25519"));
        assert!(formatted.contains("Host web-node"));
        assert!(formatted.contains("HostName 10.0.0.2"));
        assert!(formatted.contains("User ubuntu"));

        std::fs::remove_dir_all(&test_dir).ok();
    }
}
