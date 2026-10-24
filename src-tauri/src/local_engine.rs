use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

struct LocalSession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

#[derive(Clone)]
pub struct LocalEngine {
    sessions: Arc<Mutex<HashMap<String, LocalSession>>>,
}

impl LocalEngine {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().await.contains_key(session_id)
    }

    pub async fn start_session(
        &self,
        session_id: String,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create local PTY: {}", e))?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = CommandBuilder::new(&shell);
        if let Ok(home) = std::env::var("HOME") {
            cmd.cwd(home);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn local shell ({}): {}", shell, e))?;

        // Drop slave fd so master detects EOF when child terminates
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to obtain PTY writer: {}", e))?;

        let writer_arc = Arc::new(Mutex::new(writer));
        let master_arc = Arc::new(Mutex::new(pair.master));

        let sess_id_clone = session_id.clone();
        let sess_id_reader = session_id.clone();
        let sessions_for_exit = self.sessions.clone();

        // Background reader thread
        std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        app_handle
                            .emit(&format!("term-data-{}", sess_id_reader), text)
                            .ok();
                    }
                    Err(_) => break,
                }
            }

            let exit_code = child.wait().map(|status| status.exit_code()).unwrap_or(0);
            app_handle
                .emit(&format!("term-exit-{}", sess_id_reader), exit_code)
                .ok();

            // Clean up session entry
            let sess_id_for_clean = sess_id_reader.clone();
            tokio::spawn(async move {
                sessions_for_exit.lock().await.remove(&sess_id_for_clean);
            });
        });

        self.sessions.lock().await.insert(
            sess_id_clone.clone(),
            LocalSession {
                writer: writer_arc,
                master: master_arc,
            },
        );

        log::info!("Local PTY session started: {}", sess_id_clone);
        Ok(sess_id_clone)
    }

    pub async fn send_data(&self, session_id: &str, data: String) -> Result<(), String> {
        let lock = self.sessions.lock().await;
        if let Some(session) = lock.get(session_id) {
            let mut writer = session.writer.lock().await;
            writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to local PTY: {}", e))?;
            writer
                .flush()
                .map_err(|e| format!("Failed to flush local PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("Local session not found: {}", session_id))
        }
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let lock = self.sessions.lock().await;
        if let Some(session) = lock.get(session_id) {
            let master = session.master.lock().await;
            master
                .resize(PtySize {
                    rows: (rows as u16).max(1),
                    cols: (cols as u16).max(1),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize local PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("Local session not found: {}", session_id))
        }
    }

    pub async fn close_session(&self, session_id: &str) -> Result<(), String> {
        let mut lock = self.sessions.lock().await;
        if lock.remove(session_id).is_some() {
            log::info!("Local PTY session closed: {}", session_id);
        }
        Ok(())
    }
}
