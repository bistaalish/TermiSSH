use crate::db::Database;
use crate::models::HostConfig;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{mpsc, oneshot, Mutex};
use uuid::Uuid;

// RFC 854 / 855 / 1073 / 1091 Constants
pub const IAC: u8 = 255;
pub const DONT: u8 = 254;
pub const DO: u8 = 253;
pub const WONT: u8 = 252;
pub const WILL: u8 = 251;
pub const SB: u8 = 250;
pub const GA: u8 = 249;
pub const EL: u8 = 248;
pub const EC: u8 = 247;
pub const AYT: u8 = 246;
pub const AO: u8 = 245;
pub const IP: u8 = 244;
pub const BRK: u8 = 243;
pub const DM: u8 = 242;
pub const NOP: u8 = 241;
pub const SE: u8 = 240;

// Options
pub const OPT_BINARY: u8 = 0;
pub const OPT_ECHO: u8 = 1;
pub const OPT_SGA: u8 = 3;
pub const OPT_TTYPE: u8 = 24;
pub const OPT_NAWS: u8 = 31;

pub fn format_naws_subneg(cols: u16, rows: u16) -> Vec<u8> {
    vec![
        IAC,
        SB,
        OPT_NAWS,
        (cols >> 8) as u8,
        (cols & 0xFF) as u8,
        (rows >> 8) as u8,
        (rows & 0xFF) as u8,
        IAC,
        SE,
    ]
}

pub fn escape_telnet_input(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bytes.len() + 4);
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'\r' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                out.push(b'\r');
                out.push(b'\n');
                i += 2;
                continue;
            } else {
                // Standalone \r -> \r\n
                out.push(b'\r');
                out.push(b'\n');
                i += 1;
                continue;
            }
        } else if b == IAC {
            // Escape IAC as IAC IAC
            out.push(IAC);
            out.push(IAC);
            i += 1;
            continue;
        } else {
            out.push(b);
            i += 1;
        }
    }
    out
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ParserState {
    Normal,
    Iac,
    Will,
    Wont,
    Do,
    Dont,
    SubnegStart,
    SubnegData(u8, Vec<u8>),
    SubnegIac(u8, Vec<u8>),
}

pub struct TelnetParser {
    state: ParserState,
    cols: u16,
    rows: u16,
}

impl TelnetParser {
    pub fn new(cols: u16, rows: u16) -> Self {
        Self {
            state: ParserState::Normal,
            cols,
            rows,
        }
    }

    pub fn set_dimensions(&mut self, cols: u16, rows: u16) {
        self.cols = cols;
        self.rows = rows;
    }

    /// Process incoming chunk of raw network bytes.
    /// Returns `(clean_terminal_bytes, protocol_reply_bytes)`.
    pub fn process_chunk(&mut self, input: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let mut clean = Vec::with_capacity(input.len());
        let mut replies = Vec::new();

        for &b in input {
            match &mut self.state {
                ParserState::Normal => {
                    if b == IAC {
                        self.state = ParserState::Iac;
                    } else {
                        clean.push(b);
                    }
                }
                ParserState::Iac => {
                    match b {
                        IAC => {
                            clean.push(IAC);
                            self.state = ParserState::Normal;
                        }
                        WILL => self.state = ParserState::Will,
                        WONT => self.state = ParserState::Wont,
                        DO => self.state = ParserState::Do,
                        DONT => self.state = ParserState::Dont,
                        SB => self.state = ParserState::SubnegStart,
                        _ => {
                            // Single byte commands like NOP, GA, etc.
                            self.state = ParserState::Normal;
                        }
                    }
                }
                ParserState::Will => {
                    let opt = b;
                    match opt {
                        OPT_ECHO | OPT_SGA => {
                            // We agree: DO <opt>
                            replies.extend_from_slice(&[IAC, DO, opt]);
                        }
                        OPT_BINARY => {
                            replies.extend_from_slice(&[IAC, DO, OPT_BINARY]);
                        }
                        _ => {
                            // Decline other options
                            replies.extend_from_slice(&[IAC, DONT, opt]);
                        }
                    }
                    self.state = ParserState::Normal;
                }
                ParserState::Wont => {
                    let opt = b;
                    replies.extend_from_slice(&[IAC, DONT, opt]);
                    self.state = ParserState::Normal;
                }
                ParserState::Do => {
                    let opt = b;
                    match opt {
                        OPT_NAWS => {
                            // Agree to NAWS and send initial dimensions
                            replies.extend_from_slice(&[IAC, WILL, OPT_NAWS]);
                            replies.extend_from_slice(&format_naws_subneg(self.cols, self.rows));
                        }
                        OPT_TTYPE => {
                            replies.extend_from_slice(&[IAC, WILL, OPT_TTYPE]);
                        }
                        OPT_SGA => {
                            replies.extend_from_slice(&[IAC, WILL, OPT_SGA]);
                        }
                        OPT_BINARY => {
                            replies.extend_from_slice(&[IAC, WILL, OPT_BINARY]);
                        }
                        _ => {
                            replies.extend_from_slice(&[IAC, WONT, opt]);
                        }
                    }
                    self.state = ParserState::Normal;
                }
                ParserState::Dont => {
                    let opt = b;
                    replies.extend_from_slice(&[IAC, WONT, opt]);
                    self.state = ParserState::Normal;
                }
                ParserState::SubnegStart => {
                    self.state = ParserState::SubnegData(b, Vec::new());
                }
                ParserState::SubnegData(opt, buf) => {
                    if b == IAC {
                        let cur_opt = *opt;
                        let cur_buf = std::mem::take(buf);
                        self.state = ParserState::SubnegIac(cur_opt, cur_buf);
                    } else {
                        buf.push(b);
                    }
                }
                ParserState::SubnegIac(opt, buf) => {
                    if b == SE {
                        // End of subnegotiation
                        if *opt == OPT_TTYPE && buf.first() == Some(&1) {
                            // Server requested SEND (1) -> reply with IS (0) + terminal name
                            replies.extend_from_slice(&[IAC, SB, OPT_TTYPE, 0]);
                            replies.extend_from_slice(b"xterm-256color");
                            replies.extend_from_slice(&[IAC, SE]);
                        }
                        self.state = ParserState::Normal;
                    } else if b == IAC {
                        // Escaped 255 inside subnegotiation
                        buf.push(IAC);
                        let cur_opt = *opt;
                        let cur_buf = std::mem::take(buf);
                        self.state = ParserState::SubnegData(cur_opt, cur_buf);
                    } else {
                        self.state = ParserState::Normal;
                    }
                }
            }
        }

        (clean, replies)
    }
}

pub struct ActiveTelnetSession {
    pub session_id: String,
    pub host_id: String,
    pub data_tx: mpsc::Sender<String>,
    pub resize_tx: mpsc::Sender<(u32, u32)>,
    pub close_tx: Option<oneshot::Sender<()>>,
    pub output_tx: tokio::sync::broadcast::Sender<String>,
}

pub struct TelnetEngine {
    db: Arc<Database>,
    sessions: Arc<Mutex<HashMap<String, ActiveTelnetSession>>>,
}

impl TelnetEngine {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn has_session(&self, session_id: &str) -> bool {
        let lock = self.sessions.lock().await;
        lock.contains_key(session_id)
    }

    pub async fn subscribe_output(
        &self,
        session_id: &str,
    ) -> Option<tokio::sync::broadcast::Receiver<String>> {
        let lock = self.sessions.lock().await;
        lock.get(session_id).map(|s| s.output_tx.subscribe())
    }

    pub async fn start_session(
        &self,
        host: &HostConfig,
        cols: u32,
        rows: u32,
        app_handle: Option<AppHandle>,
    ) -> Result<String, String> {
        let session_id = format!("telnet-{}", Uuid::new_v4());
        let addr = format!("{}:{}", host.hostname, host.port);
        let timeout_secs = host.timeout_seconds.unwrap_or(15);

        log::info!("Connecting via Telnet to {} (timeout: {}s)", addr, timeout_secs);

        let stream = tokio::time::timeout(
            Duration::from_secs(timeout_secs as u64),
            TcpStream::connect(&addr),
        )
        .await
        .map_err(|_| format!("Connection timeout connecting to {} after {}s", addr, timeout_secs))?
        .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        log::info!("Connected via Telnet to {}", addr);

        let (mut reader, mut writer) = stream.into_split();

        let (data_tx, mut data_rx) = mpsc::channel::<String>(100);
        let (resize_tx, mut resize_rx) = mpsc::channel::<(u32, u32)>(10);
        let (close_tx, mut close_rx) = oneshot::channel::<()>();
        let (output_tx, _) = tokio::sync::broadcast::channel::<String>(256);

        let initial_cols = cols as u16;
        let initial_rows = rows as u16;

        let sess_id_clone = session_id.clone();
        let app_handle_clone = app_handle.clone();
        let output_tx_clone = output_tx.clone();
        let sessions_map_clone = self.sessions.clone();

        let initial_handshake = vec![
            IAC, WILL, OPT_NAWS,
            IAC, DO, OPT_SGA,
            IAC, WILL, OPT_SGA,
            IAC, WILL, OPT_TTYPE,
        ];
        if let Err(e) = writer.write_all(&initial_handshake).await {
            log::warn!("Failed to send initial Telnet handshake: {}", e);
        }
        let initial_naws = format_naws_subneg(initial_cols, initial_rows);
        if let Err(e) = writer.write_all(&initial_naws).await {
            log::warn!("Failed to send initial Telnet NAWS: {}", e);
        }
        writer.flush().await.ok();

        // Background worker
        tokio::spawn(async move {
            let mut parser = TelnetParser::new(initial_cols, initial_rows);
            let mut buf = [0u8; 4096];

            loop {
                tokio::select! {
                    read_res = reader.read(&mut buf) => {
                        match read_res {
                            Ok(0) => {
                                // Connection closed by remote peer
                                log::info!("Telnet session {}: remote closed connection", sess_id_clone);
                                if let Some(app) = &app_handle_clone {
                                    app.emit(&format!("term-exit-{}", sess_id_clone), 0).ok();
                                }
                                break;
                            }
                            Ok(n) => {
                                let (clean, replies) = parser.process_chunk(&buf[..n]);

                                if !replies.is_empty() {
                                    if let Err(e) = writer.write_all(&replies).await {
                                        log::warn!("Telnet write replies error: {}", e);
                                        break;
                                    }
                                    writer.flush().await.ok();
                                }

                                if !clean.is_empty() {
                                    let text = String::from_utf8_lossy(&clean).to_string();
                                    output_tx_clone.send(text.clone()).ok();
                                    if let Some(app) = &app_handle_clone {
                                        app.emit(&format!("term-data-{}", sess_id_clone), text).ok();
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("Telnet read error on {}: {}", sess_id_clone, e);
                                if let Some(app) = &app_handle_clone {
                                    app.emit(&format!("term-exit-{}", sess_id_clone), 1).ok();
                                }
                                break;
                            }
                        }
                    }
                    Some(input) = data_rx.recv() => {
                        let escaped = escape_telnet_input(input.as_bytes());
                        if let Err(e) = writer.write_all(&escaped).await {
                            log::warn!("Telnet write data error: {}", e);
                            break;
                        }
                        writer.flush().await.ok();
                    }
                    Some((c, r)) = resize_rx.recv() => {
                        let c16 = c as u16;
                        let r16 = r as u16;
                        parser.set_dimensions(c16, r16);
                        let naws_bytes = format_naws_subneg(c16, r16);
                        if let Err(e) = writer.write_all(&naws_bytes).await {
                            log::warn!("Telnet write NAWS error: {}", e);
                            break;
                        }
                        writer.flush().await.ok();
                    }
                    _ = &mut close_rx => {
                        log::info!("Telnet session {}: explicitly closed", sess_id_clone);
                        writer.shutdown().await.ok();
                        break;
                    }
                }
            }

            // Cleanup from active map
            let mut map = sessions_map_clone.lock().await;
            map.remove(&sess_id_clone);
        });

        // Store active session
        let active = ActiveTelnetSession {
            session_id: session_id.clone(),
            host_id: host.id.clone(),
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
            Err("Telnet session not found".to_string())
        }
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let lock = self.sessions.lock().await;
        if let Some(sess) = lock.get(session_id) {
            sess.resize_tx.send((cols, rows)).await.ok();
            Ok(())
        } else {
            Err("Telnet session not found".to_string())
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        let mut lock = self.sessions.lock().await;
        if let Some(mut sess) = lock.remove(session_id) {
            if let Some(tx) = sess.close_tx.take() {
                tx.send(()).ok();
            }
            self.db.record_history_end(session_id, "disconnected", None).ok();
            Ok(())
        } else {
            Err("Telnet session not found".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_naws_subneg() {
        let bytes = format_naws_subneg(80, 24);
        assert_eq!(
            bytes,
            vec![IAC, SB, OPT_NAWS, 0, 80, 0, 24, IAC, SE]
        );
    }

    #[test]
    fn test_escape_telnet_input() {
        assert_eq!(escape_telnet_input(b"hello\r"), b"hello\r\n");
        assert_eq!(escape_telnet_input(b"hello\r\n"), b"hello\r\n");
        assert_eq!(escape_telnet_input(&[255, b'a', b'b', b'c']), vec![255, 255, b'a', b'b', b'c']);
    }

    #[test]
    fn test_telnet_parser_strips_iac_and_replies_do_echo() {
        let mut parser = TelnetParser::new(80, 24);
        // IAC WILL ECHO (255, 251, 1) + text "Login:"
        let input = vec![IAC, WILL, OPT_ECHO, b'L', b'o', b'g', b'i', b'n', b':'];
        let (clean, replies) = parser.process_chunk(&input);

        assert_eq!(clean, b"Login:");
        assert_eq!(replies, vec![IAC, DO, OPT_ECHO]);
    }

    #[test]
    fn test_telnet_parser_ttype_subnegotiation() {
        let mut parser = TelnetParser::new(80, 24);
        // IAC DO TTYPE
        let (c1, r1) = parser.process_chunk(&[IAC, DO, OPT_TTYPE]);
        assert_eq!(c1, b"");
        assert_eq!(r1, vec![IAC, WILL, OPT_TTYPE]);

        // IAC SB TTYPE 1 IAC SE
        let (c2, r2) = parser.process_chunk(&[IAC, SB, OPT_TTYPE, 1, IAC, SE]);
        assert_eq!(c2, b"");
        assert_eq!(
            r2,
            vec![
                IAC, SB, OPT_TTYPE, 0,
                b'x', b't', b'e', b'r', b'm', b'-', b'2', b'5', b'6', b'c', b'o', b'l', b'o', b'r',
                IAC, SE
            ]
        );
    }

    #[test]
    fn test_telnet_parser_escaped_iac() {
        let mut parser = TelnetParser::new(80, 24);
        let input = vec![b'A', IAC, IAC, b'B'];
        let (clean, replies) = parser.process_chunk(&input);
        assert_eq!(clean, vec![b'A', 255, b'B']);
        assert!(replies.is_empty());
    }

    #[tokio::test]
    async fn test_telnet_engine_end_to_end() {
        let temp_dir = std::env::temp_dir().join(format!("termissh-telnet-test-{}", Uuid::new_v4()));
        let db = Arc::new(Database::new(temp_dir.clone()));
        let engine = TelnetEngine::new(db);

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        // Spawn mock server
        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                // Send banner
                socket.write_all(b"\xff\xfb\x01\r\nRouter Login:\r\n").await.ok();
                let mut buf = [0u8; 1024];
                while let Ok(n) = socket.read(&mut buf).await {
                    if n == 0 {
                        break;
                    }
                    let s = String::from_utf8_lossy(&buf[..n]);
                    if s.contains("admin") {
                        socket.write_all(b"Password:\r\n").await.ok();
                    }
                }
            }
        });

        let host = HostConfig {
            id: "telnet-test-host".to_string(),
            name: "Mock Telnet Router".to_string(),
            description: None,
            hostname: "127.0.0.1".to_string(),
            port,
            username: "admin".to_string(),
            auth_type: "password".to_string(),
            password: None,
            key_id: None,
            key_passphrase: None,
            group_id: None,
            tags: None,
            timeout_seconds: Some(5),
            keepalive_interval: Some(30),
            jump_host_id: None,
            proxy_command: None,
            identity_file: None,
            terminal_theme: None,
            font_size: None,
            protocol: Some("telnet".to_string()),
            baud_rate: None,
            data_bits: None,
            stop_bits: None,
            parity: None,
            flow_control: None,
            created_at: None,
            updated_at: None,
        };

        let session_id = engine.start_session(&host, 80, 24, None).await.expect("Start telnet failed");
        let mut rx = engine.subscribe_output(&session_id).await.expect("Subscribe failed");

        // Wait for banner
        let banner = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
        assert!(banner.is_ok());
        let text = banner.unwrap().unwrap();
        assert!(text.contains("Router Login:"));

        // Send username
        engine.send_data(&session_id, "admin\r".to_string()).await.expect("Send data failed");

        // Wait for password prompt
        let prompt = tokio::time::timeout(Duration::from_secs(3), rx.recv()).await;
        assert!(prompt.is_ok());
        let text2 = prompt.unwrap().unwrap();
        assert!(text2.contains("Password:"));

        engine.close_session(&session_id).await.ok();
        let _ = std::fs::remove_dir_all(temp_dir);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn test_live_gateway_telnet_connection() {
        let temp_dir = std::env::temp_dir().join(format!("termissh-telnet-gw-{}", Uuid::new_v4()));
        let db = Arc::new(Database::new(temp_dir.clone()));
        let engine = TelnetEngine::new(db);

        let host = HostConfig {
            id: "host-gateway-telnet".to_string(),
            name: "Huawei Gateway (192.168.10.1)".to_string(),
            description: Some("Gateway for testing".to_string()),
            hostname: "192.168.10.1".to_string(),
            port: 23,
            username: "admin".to_string(),
            auth_type: "password".to_string(),
            password: None,
            key_id: None,
            key_passphrase: None,
            group_id: None,
            tags: None,
            timeout_seconds: Some(5),
            keepalive_interval: Some(30),
            jump_host_id: None,
            proxy_command: None,
            identity_file: None,
            terminal_theme: None,
            font_size: None,
            protocol: Some("telnet".to_string()),
            baud_rate: None,
            data_bits: None,
            stop_bits: None,
            parity: None,
            flow_control: None,
            created_at: None,
            updated_at: None,
        };

        let session_id = match engine.start_session(&host, 80, 24, None).await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Skipping live test, cannot connect: {}", e);
                return;
            }
        };

        let mut rx = engine.subscribe_output(&session_id).await.expect("Failed to subscribe");

        // Send a newline after brief delay to trigger login prompt
        tokio::time::sleep(Duration::from_millis(300)).await;
        engine.send_data(&session_id, "\r\n".to_string()).await.ok();

        let mut received = String::new();
        let deadline = tokio::time::Instant::now() + Duration::from_secs(5);

        while tokio::time::Instant::now() < deadline {
            if let Ok(Ok(chunk)) = tokio::time::timeout(Duration::from_millis(500), rx.recv()).await {
                eprintln!("Received chunk: {:?}", chunk);
                received.push_str(&chunk);
                if received.contains("Login:") || received.contains("Huawei") {
                    break;
                }
            }
        }

        eprintln!("=== LIVE GATEWAY TELNET OUTPUT ===\n{}", received);
        assert!(received.contains("Login:") || received.contains("Huawei") || received.contains("Command line"));

        engine.close_session(&session_id).await.ok();
        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
