use crate::db::Database;
use crate::models::{FileEntry, HostConfig, HostKeyPromptData};
use crate::vault::SecureVault;
use russh::client::{self, Config, Handle, Handler};
use russh::keys::key::PrivateKeyWithHashAlg;
use russh::keys::{decode_secret_key, HashAlg, PrivateKey, PublicKeyOrCertificate};
use russh::ChannelMsg;
use russh_sftp::client::SftpSession;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::process::Stdio;
use std::sync::Arc;
use std::task::{Context, Poll};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, Mutex};
use uuid::Uuid;

#[derive(Debug, Default, Clone)]
pub struct SSHConfigDirectives {
    pub proxy_command: Option<String>,
    pub identity_file: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub hostname: Option<String>,
}

pub fn resolve_ssh_config(target_host: &str, target_name: &str) -> SSHConfigDirectives {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return SSHConfigDirectives::default(),
    };
    let config_path = home.join(".ssh").join("config");
    if !config_path.exists() {
        return SSHConfigDirectives::default();
    }

    let content = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return SSHConfigDirectives::default(),
    };

    let mut matched = false;
    let mut directives = SSHConfigDirectives::default();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let lower = trimmed.to_lowercase();
        if lower.starts_with("host ") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            matched = parts[1..].iter().any(|pattern| {
                if *pattern == "*" {
                    return true;
                }
                pattern.eq_ignore_ascii_case(target_host)
                    || pattern.eq_ignore_ascii_case(target_name)
                    || (pattern.starts_with("*.")
                        && (target_host.ends_with(&pattern[1..]) || target_name.ends_with(&pattern[1..])))
            });
            continue;
        }

        if matched {
            if lower.starts_with("proxycommand") {
                if directives.proxy_command.is_none() {
                    if let Some(cmd) = trimmed.strip_prefix("ProxyCommand").or_else(|| trimmed.strip_prefix("proxycommand")) {
                        let clean = cmd.trim().trim_start_matches('=').trim();
                        directives.proxy_command = Some(clean.to_string());
                    }
                }
            } else if lower.starts_with("identityfile") {
                if directives.identity_file.is_none() {
                    if let Some(idf) = trimmed.strip_prefix("IdentityFile").or_else(|| trimmed.strip_prefix("identityfile")) {
                        directives.identity_file = Some(idf.trim().trim_start_matches('=').trim().to_string());
                    }
                }
            } else {
                let normalized = trimmed.replace('=', " ");
                let parts: Vec<&str> = normalized.split_whitespace().collect();
                if parts.len() > 1 {
                    match parts[0].to_lowercase().as_str() {
                        "user" if directives.user.is_none() => {
                            directives.user = Some(parts[1].to_string());
                        }
                        "port" if directives.port.is_none() => {
                            directives.port = parts[1].parse().ok();
                        }
                        "hostname" if directives.hostname.is_none() => {
                            directives.hostname = Some(parts[1].to_string());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    directives
}

pub struct ProcessStream {
    reader: ChildStdout,
    writer: ChildStdin,
    _child: Child,
}

impl ProcessStream {
    pub fn spawn(cmd_str: &str, host: &str, port: u16) -> Result<Self, String> {
        let expanded = cmd_str
            .replace("%h", host)
            .replace("%p", &port.to_string());

        log::info!("Spawning ProxyCommand: {}", expanded);

        let mut child = Command::new("sh")
            .arg("-c")
            .arg(&expanded)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn ProxyCommand '{}': {}", expanded, e))?;

        let writer = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to capture stdin of ProxyCommand".to_string())?;
        let reader = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout of ProxyCommand".to_string())?;

        Ok(Self {
            reader,
            writer,
            _child: child,
        })
    }
}

impl AsyncRead for ProcessStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.reader).poll_read(cx, buf)
    }
}

impl AsyncWrite for ProcessStream {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<Result<usize, std::io::Error>> {
        Pin::new(&mut self.writer).poll_write(cx, buf)
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Result<(), std::io::Error>> {
        Pin::new(&mut self.writer).poll_flush(cx)
    }

    fn poll_shutdown(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Result<(), std::io::Error>> {
        Pin::new(&mut self.writer).poll_shutdown(cx)
    }
}

pub struct ClientHandler {
    pub host: String,
    pub port: u16,
    pub db: Arc<Database>,
    pub app_handle: Option<AppHandle>,
    pub active_prompts: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl Handler for ClientHandler {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> impl Future<Output = Result<bool, Self::Error>> + Send {
        let host = self.host.clone();
        let port = self.port;
        let db = self.db.clone();
        let app_handle = self.app_handle.clone();
        let active_prompts = self.active_prompts.clone();

        let pub_key_obj = server_public_key.public_key();
        let key_type = pub_key_obj.algorithm().to_string();
        let fingerprint = pub_key_obj.fingerprint(HashAlg::Sha256).to_string();

        async move {
            // Check known hosts in database
            if let Ok(Some(known_fp)) = db.get_known_host_key(&host, port) {
                if known_fp == fingerprint {
                    // Host key matched trusted database
                    return Ok(true);
                } else {
                    // Security Warning: Host key changed!
                    log::warn!(
                        "HOST KEY MISMATCH DETECTED for {}:{}! Stored: {}, Received: {}",
                        host,
                        port,
                        known_fp,
                        fingerprint
                    );

                    if let Some(app) = app_handle {
                        let (tx, rx) = oneshot::channel();
                        let prompt_key = format!("{}:{}", host, port);
                        {
                            let mut lock = active_prompts.lock().await;
                            lock.insert(prompt_key, tx);
                        }

                        let payload = HostKeyPromptData {
                            host: host.clone(),
                            port,
                            key_type: key_type.clone(),
                            fingerprint: fingerprint.clone(),
                            is_mismatch: true,
                            old_fingerprint: Some(known_fp),
                        };

                        app.emit("host-key-prompt", payload).ok();

                        // Wait for user confirmation (timeout 60s)
                        if let Ok(accepted) = tokio::time::timeout(Duration::from_secs(60), rx).await {
                            if accepted == Ok(true) {
                                db.save_known_host(&host, port, &key_type, &fingerprint).ok();
                                return Ok(true);
                            }
                        }
                    }
                    return Ok(false);
                }
            }

            // New Host (First time connection / TOFU)
            if let Some(app) = app_handle {
                let (tx, rx) = oneshot::channel();
                let prompt_key = format!("{}:{}", host, port);
                {
                    let mut lock = active_prompts.lock().await;
                    lock.insert(prompt_key, tx);
                }

                let payload = HostKeyPromptData {
                    host: host.clone(),
                    port,
                    key_type: key_type.clone(),
                    fingerprint: fingerprint.clone(),
                    is_mismatch: false,
                    old_fingerprint: None,
                };

                app.emit("host-key-prompt", payload).ok();

                if let Ok(accepted) = tokio::time::timeout(Duration::from_secs(60), rx).await {
                    if accepted == Ok(true) {
                        db.save_known_host(&host, port, &key_type, &fingerprint).ok();
                        return Ok(true);
                    }
                }
                return Ok(false);
            }

            // Auto-accept if no UI handle
            db.save_known_host(&host, port, &key_type, &fingerprint).ok();
            Ok(true)
        }
    }
}

pub struct ActiveSession {
    pub session_id: String,
    pub host_id: String,
    pub data_tx: mpsc::Sender<String>,
    pub resize_tx: mpsc::Sender<(u32, u32)>,
    pub close_tx: Option<oneshot::Sender<()>>,
    pub output_tx: tokio::sync::broadcast::Sender<String>,
}

pub struct SSHEngine {
    db: Arc<Database>,
    vault: Arc<SecureVault>,
    sessions: Arc<Mutex<HashMap<String, ActiveSession>>>,
    active_prompts: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl SSHEngine {
    pub fn new(db: Arc<Database>, vault: Arc<SecureVault>) -> Self {
        Self {
            db,
            vault,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            active_prompts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn resolve_host_key(
        &self,
        host: &str,
        port: u16,
        _fingerprint: &str,
        accept: bool,
    ) {
        let key = format!("{}:{}", host, port);
        let prompts = self.active_prompts.clone();
        tokio::spawn(async move {
            let mut lock = prompts.lock().await;
            if let Some(tx) = lock.remove(&key) {
                tx.send(accept).ok();
            }
        });
    }

    pub async fn subscribe_output(&self, session_id: &str) -> Option<tokio::sync::broadcast::Receiver<String>> {
        let lock = self.sessions.lock().await;
        lock.get(session_id).map(|s| s.output_tx.subscribe())
    }

    pub async fn establish_connection(
        &self,
        host: &HostConfig,
        override_password: Option<String>,
        override_passphrase: Option<String>,
        app_handle: Option<AppHandle>,
    ) -> Result<Handle<ClientHandler>, String> {
        let directives = resolve_ssh_config(&host.hostname, &host.name);

        let effective_proxy = host
            .proxy_command
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or(directives.proxy_command.as_deref());

        let effective_host = directives.hostname.as_deref().unwrap_or(&host.hostname);
        let effective_port = directives.port.unwrap_or(host.port);
        let effective_user = if host.username.is_empty() || host.username == "root" {
            directives.user.as_deref().unwrap_or(&host.username)
        } else {
            &host.username
        };

        let mut config = Config::default();
        config.keepalive_interval = Some(Duration::from_secs(host.keepalive_interval.unwrap_or(30) as u64));

        let handler = ClientHandler {
            host: effective_host.to_string(),
            port: effective_port,
            db: self.db.clone(),
            app_handle,
            active_prompts: self.active_prompts.clone(),
        };

        let timeout_duration = Duration::from_secs(host.timeout_seconds.unwrap_or(15) as u64);

        let mut session = if let Some(proxy_cmd) = effective_proxy {
            log::info!("Connecting to {} via ProxyCommand: {}", effective_host, proxy_cmd);
            let stream = ProcessStream::spawn(proxy_cmd, effective_host, effective_port)?;
            let connect_fut = client::connect_stream(Arc::new(config), stream, handler);
            tokio::time::timeout(timeout_duration, connect_fut)
                .await
                .map_err(|_| format!("ProxyCommand connection timed out after {}s to {}", timeout_duration.as_secs(), effective_host))?
                .map_err(|e| format!("ProxyCommand connection error to {}: {}", effective_host, e))?
        } else {
            let addr = format!("{}:{}", effective_host, effective_port);
            let connect_fut = client::connect(Arc::new(config), addr, handler);
            tokio::time::timeout(timeout_duration, connect_fut)
                .await
                .map_err(|_| format!("Connection timed out after {}s to {}:{}", timeout_duration.as_secs(), effective_host, effective_port))?
                .map_err(|e| format!("Connection error to {}:{}: {}", effective_host, effective_port, e))?
        };

        // Gather candidate keys for authentication
        let mut candidate_keys: Vec<(String, String)> = Vec::new();

        // 1. Vault key if assigned
        if let Some(ref kid) = host.key_id {
            if !kid.is_empty() {
                let secret_id = format!("vault://{}", kid);
                if let Ok(Some(raw)) = self.vault.get(&secret_id) {
                    candidate_keys.push((raw, format!("Vault key '{}'", kid)));
                }
            }
        }

        // 2. IdentityFile from host config or ~/.ssh/config
        let id_file_path = host
            .identity_file
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or(directives.identity_file.as_deref());

        if let Some(id_path) = id_file_path {
            let expanded = if id_path.starts_with("~/") {
                dirs::home_dir().map(|h| h.join(&id_path[2..]))
            } else {
                Some(std::path::PathBuf::from(id_path))
            };
            if let Some(p) = expanded {
                if let Ok(raw) = std::fs::read_to_string(&p) {
                    candidate_keys.push((raw, format!("IdentityFile '{}'", p.display())));
                }
            }
        }

        // 3. Default ~/.ssh/id_* keys
        if let Some(home) = dirs::home_dir() {
            for key_name in &["id_ed25519", "id_rsa", "id_ecdsa"] {
                let path = home.join(".ssh").join(key_name);
                if path.exists() {
                    if let Ok(raw) = std::fs::read_to_string(&path) {
                        if !candidate_keys.iter().any(|(existing, _)| existing == &raw) {
                            candidate_keys.push((raw, format!("~/.ssh/{}", key_name)));
                        }
                    }
                }
            }
        }

        let mut authenticated = false;
        let mut auth_error = None;

        // If explicit password authentication configured
        if host.auth_type == "password" && override_password.is_some() {
            let pwd = override_password.unwrap_or_default();
            match session.authenticate_password(effective_user, pwd).await {
                Ok(ok) if ok.success() => authenticated = true,
                Ok(_) => auth_error = Some("Password rejected by server".to_string()),
                Err(e) => auth_error = Some(e.to_string()),
            }
        } else if host.auth_type == "password" && host.password.is_some() {
            let secret_id = format!("vault://host-pwd-{}", host.id);
            let pwd = self.vault.get(&secret_id)?.unwrap_or_default();
            match session.authenticate_password(effective_user, pwd).await {
                Ok(ok) if ok.success() => authenticated = true,
                Ok(_) => auth_error = Some("Password rejected by server".to_string()),
                Err(e) => auth_error = Some(e.to_string()),
            }
        }

        // Try Public Key Authentication with candidate keys
        if !authenticated {
            for (raw_key, source) in &candidate_keys {
                log::info!("Authenticating {} with {}", effective_user, source);

                let pass = override_passphrase
                    .as_deref()
                    .or(host.key_passphrase.as_deref());

                let parsed_key_res = decode_secret_key(raw_key, pass).or_else(|_| {
                    PrivateKey::from_openssh(raw_key).and_then(|k| {
                        if k.is_encrypted() {
                            k.decrypt(pass.unwrap_or(""))
                        } else {
                            Ok(k)
                        }
                    })
                });

                match parsed_key_res {
                    Ok(key) => {
                        let key_with_alg = PrivateKeyWithHashAlg::new(Arc::new(key), None);
                        match session.authenticate_publickey(effective_user, key_with_alg).await {
                            Ok(ok) => {
                                if ok.success() {
                                    log::info!("Public key authentication succeeded with {}", source);
                                    authenticated = true;
                                    break;
                                } else {
                                    log::warn!("Public key {} rejected by server", source);
                                }
                            }
                            Err(e) => {
                                log::warn!("Public key {} error: {}", source, e);
                                auth_error = Some(e.to_string());
                            }
                        }
                    }
                    Err(e) => {
                        log::warn!("Could not parse private key from {}: {}", source, e);
                        auth_error = Some(format!("Key decode error for {}: {}", source, e));
                    }
                }
            }
        }

        // If still not authenticated and password is in vault, try password
        if !authenticated && host.auth_type != "password" {
            let secret_id = format!("vault://host-pwd-{}", host.id);
            if let Ok(Some(pwd)) = self.vault.get(&secret_id) {
                if !pwd.is_empty() {
                    match session.authenticate_password(effective_user, pwd).await {
                        Ok(ok) if ok.success() => authenticated = true,
                        _ => {}
                    }
                }
            }
        }

        // Final fallback if nothing authenticated yet
        if !authenticated {
            if let Some(err) = auth_error {
                return Err(format!("Authentication failed for user '{}' on {}: {}", effective_user, effective_host, err));
            }
            let res = session.authenticate_none(effective_user).await.map_err(|e| e.to_string())?;
            if !res.success() {
                return Err(format!("Authentication failed for user '{}' on {}. Server requires valid public key or password.", effective_user, effective_host));
            }
        }

        Ok(session)
    }

    pub async fn start_session(
        &self,
        host_id: &str,
        cols: u32,
        rows: u32,
        override_password: Option<String>,
        override_passphrase: Option<String>,
        app_handle: Option<AppHandle>,
    ) -> Result<String, String> {
        let host = self
            .db
            .get_host(host_id)
            .map_err(|e| format!("Database error: {}", e))?
            .ok_or_else(|| "Host configuration not found".to_string())?;

        let session_id = format!("sess-{}", Uuid::new_v4());

        let session = self
            .establish_connection(
                &host,
                override_password,
                override_passphrase,
                app_handle.clone(),
            )
            .await?;

        // Open Session Channel
        let channel = session
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open session channel: {}", e))?;

        // Request PTY
        channel
            .request_pty(false, "xterm-256color", cols, rows, 0, 0, &[])
            .await
            .map_err(|e| format!("Failed to request pseudoterminal (PTY): {}", e))?;

        // Request Shell
        channel
            .request_shell(true)
            .await
            .map_err(|e| format!("Failed to request interactive shell: {}", e))?;

        // Create input & resize channels
        let (data_tx, mut data_rx) = mpsc::channel::<String>(100);
        let (resize_tx, mut resize_rx) = mpsc::channel::<(u32, u32)>(10);
        let (close_tx, mut close_rx) = oneshot::channel::<()>();
        let (output_tx, _) = tokio::sync::broadcast::channel::<String>(256);

        let sess_id_clone = session_id.clone();
        let app_handle_clone = app_handle.clone();
        let output_tx_clone = output_tx.clone();

        // Background reader & writer task
        tokio::spawn(async move {
            let mut channel = channel;
            let _session = session;

            loop {
                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                if let Ok(s) = String::from_utf8(data.to_vec()) {
                                    output_tx_clone.send(s.clone()).ok();
                                    if let Some(app) = &app_handle_clone {
                                        app.emit(&format!("term-data-{}", sess_id_clone), s).ok();
                                    }
                                }
                            }
                            Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                                if let Ok(s) = String::from_utf8(data.to_vec()) {
                                    output_tx_clone.send(s.clone()).ok();
                                    if let Some(app) = &app_handle_clone {
                                        app.emit(&format!("term-data-{}", sess_id_clone), s).ok();
                                    }
                                }
                            }
                            Some(ChannelMsg::ExitStatus { exit_status }) => {
                                if let Some(app) = &app_handle_clone {
                                    app.emit(&format!("term-exit-{}", sess_id_clone), exit_status).ok();
                                }
                                break;
                            }
                            Some(ChannelMsg::Close) | None => {
                                if let Some(app) = &app_handle_clone {
                                    app.emit(&format!("term-exit-{}", sess_id_clone), 0).ok();
                                }
                                break;
                            }
                            _ => {}
                        }
                    }
                    Some(input) = data_rx.recv() => {
                        channel.data_bytes(input.into_bytes()).await.ok();
                    }
                    Some((c, r)) = resize_rx.recv() => {
                        channel.window_change(c, r, 0, 0).await.ok();
                    }
                    _ = &mut close_rx => {
                        channel.close().await.ok();
                        break;
                    }
                }
            }
        });

        // Register active session
        let active = ActiveSession {
            session_id: session_id.clone(),
            host_id: host_id.to_string(),
            data_tx,
            resize_tx,
            close_tx: Some(close_tx),
            output_tx,
        };

        {
            let mut lock = self.sessions.lock().await;
            lock.insert(session_id.clone(), active);
        }

        // Record history start
        let hist = crate::models::ConnectionHistoryEntry {
            id: format!("hist-{}", Uuid::new_v4()),
            host_id: host.id.clone(),
            host_name: host.name.clone(),
            connected_at: chrono::Utc::now().to_rfc3339(),
            disconnected_at: None,
            status: "connected".to_string(),
            error_message: None,
        };
        self.db.record_history_start(&hist).ok();

        Ok(session_id)
    }

    pub async fn send_data(&self, session_id: &str, data: String) -> Result<(), String> {
        let lock = self.sessions.lock().await;
        if let Some(sess) = lock.get(session_id) {
            sess.data_tx
                .send(data)
                .await
                .map_err(|e| format!("Send error: {}", e))?;
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let lock = self.sessions.lock().await;
        if let Some(sess) = lock.get(session_id) {
            sess.resize_tx.send((cols, rows)).await.ok();
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        let mut lock = self.sessions.lock().await;
        if let Some(mut sess) = lock.remove(session_id) {
            if let Some(tx) = sess.close_tx.take() {
                tx.send(()).ok();
            }
            Ok(())
        } else {
            Ok(())
        }
    }

    // Connect temporary SSH Handle for SFTP or Tunnels
    pub async fn connect_host(&self, host_id: &str) -> Result<Handle<ClientHandler>, String> {
        let host = self
            .db
            .get_host(host_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Host not found".to_string())?;

        self.establish_connection(&host, None, None, None).await
    }

    // SFTP Operations
    pub async fn sftp_list(&self, host_id: &str, path: &str) -> Result<Vec<FileEntry>, String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        let read_dir = sftp.read_dir(path).await.map_err(|e| e.to_string())?;

        let mut entries = Vec::new();
        for entry in read_dir {
            let file_name = entry.file_name();
            if file_name == "." || file_name == ".." {
                continue;
            }

            let full_path = if path == "/" {
                format!("/{}", file_name)
            } else {
                format!("{}/{}", path.trim_end_matches('/'), file_name)
            };

            let metadata = entry.metadata();
            let is_dir = metadata.is_dir();
            let size = metadata.size.unwrap_or(0);
            let perms = metadata.permissions.map_or("-rw-r--r--".to_string(), |p| format!("{:o}", p));
            let modified = metadata.mtime.unwrap_or(0) as u64;

            entries.push(FileEntry {
                name: file_name,
                path: full_path,
                is_dir,
                size,
                permissions: perms,
                modified,
            });
        }

        // Sort folders first, then alphabetical
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

    pub async fn sftp_read_file(&self, host_id: &str, remote_path: &str) -> Result<String, String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        use tokio::io::AsyncReadExt;
        let mut file = sftp.open(remote_path).await.map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).await.map_err(|e| e.to_string())?;

        String::from_utf8(buffer).map_err(|e| format!("File content is not valid UTF-8: {}", e))
    }

    pub async fn sftp_write_file(&self, host_id: &str, remote_path: &str, content: &str) -> Result<(), String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        use tokio::io::AsyncWriteExt;
        let mut file = sftp.create(remote_path).await.map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).await.map_err(|e| e.to_string())?;
        file.shutdown().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn sftp_delete(&self, host_id: &str, remote_path: &str, is_dir: bool) -> Result<(), String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        if is_dir {
            sftp.remove_dir(remote_path).await.map_err(|e| e.to_string())?;
        } else {
            sftp.remove_file(remote_path).await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub async fn sftp_mkdir(&self, host_id: &str, remote_path: &str) -> Result<(), String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        sftp.create_dir(remote_path).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn sftp_upload(&self, host_id: &str, local_path: &str, remote_path: &str) -> Result<(), String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut local_file = tokio::fs::File::open(local_path).await.map_err(|e| e.to_string())?;
        let mut remote_file = sftp.create(remote_path).await.map_err(|e| e.to_string())?;

        let mut buf = vec![0u8; 64 * 1024]; // 64KB chunks
        loop {
            let n = local_file.read(&mut buf).await.map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            remote_file.write_all(&buf[..n]).await.map_err(|e| e.to_string())?;
        }
        remote_file.shutdown().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn sftp_download(&self, host_id: &str, remote_path: &str, local_path: &str) -> Result<(), String> {
        let session = self.connect_host(host_id).await?;
        let channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
        channel.request_subsystem(true, "sftp").await.map_err(|e| e.to_string())?;

        let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| e.to_string())?;
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let mut remote_file = sftp.open(remote_path).await.map_err(|e| e.to_string())?;
        let mut local_file = tokio::fs::File::create(local_path).await.map_err(|e| e.to_string())?;

        let mut buf = vec![0u8; 64 * 1024];
        loop {
            let n = remote_file.read(&mut buf).await.map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            local_file.write_all(&buf[..n]).await.map_err(|e| e.to_string())?;
        }
        local_file.shutdown().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_process_stream_spawn() {
        let stream = ProcessStream::spawn("echo 'SSH-2.0-TestServer'", "127.0.0.1", 22);
        assert!(stream.is_ok());
    }

    #[test]
    fn test_resolve_ssh_config_directives() {
        let dir = resolve_ssh_config("sshyunic.linuxeval.eu.org", "sshyunic.linuxeval.eu.org");
        assert!(dir.proxy_command.is_some());
        assert!(dir.proxy_command.unwrap().contains("cloudflared"));
        assert_eq!(dir.user.as_deref(), Some("root"));
    }
}
