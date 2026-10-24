use crate::db::Database;
use crate::models::{HostConfig, SerialPortInfo};
use serial2::{CharSize, FlowControl, Parity, SerialPort, Settings, StopBits};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

struct SerialSession {
    _session_id: String,
    _port_path: String,
    _baud_rate: u32,
    port: Arc<SerialPort>,
    running: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct SerialEngine {
    _db: Arc<Database>,
    sessions: Arc<Mutex<HashMap<String, Arc<SerialSession>>>>,
}

impl SerialEngine {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            _db: db,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Enumerate all available serial ports on the host system.
    pub fn list_ports(&self) -> Vec<SerialPortInfo> {
        let mut results = Vec::new();
        let mut seen = HashSet::new();

        // 1. Query serial2 available ports API
        if let Ok(ports) = SerialPort::available_ports() {
            for p in ports {
                let path_str = p.to_string_lossy().to_string();
                if seen.insert(path_str.clone()) {
                    let desc = Self::lookup_port_description(&p);
                    results.push(SerialPortInfo {
                        path: path_str,
                        description: Some(desc),
                    });
                }
            }
        }

        // 2. Scan standard Linux /dev paths for USB serial, ACM, and standard UARTs
        if let Ok(entries) = fs::read_dir("/dev") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("ttyUSB")
                    || name.starts_with("ttyACM")
                    || name.starts_with("ttyXRUSB")
                    || (name.starts_with("ttyS") && name[4..].parse::<u32>().map_or(false, |n| n < 4))
                {
                    let full_path = format!("/dev/{}", name);
                    if seen.insert(full_path.clone()) {
                        let path_buf = PathBuf::from(&full_path);
                        let desc = Self::lookup_port_description(&path_buf);
                        results.push(SerialPortInfo {
                            path: full_path,
                            description: Some(desc),
                        });
                    }
                }
            }
        }

        // Sort by path for a stable, clean user experience
        results.sort_by(|a, b| a.path.cmp(&b.path));
        results
    }

    fn lookup_port_description(path: &Path) -> String {
        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Check Linux sysfs for device model and driver name
        if !filename.is_empty() {
            let sys_device_path = format!("/sys/class/tty/{}/device", filename);
            let driver_path = format!("{}/driver", sys_device_path);

            if let Ok(driver_target) = fs::read_link(&driver_path) {
                let driver_name = driver_target
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                if !driver_name.is_empty() {
                    return match driver_name {
                        "ftdi_sio" => format!("FTDI USB Serial ({})", filename),
                        "ch341-uart" => format!("CH340/CH341 USB Serial ({})", filename),
                        "cp210x" => format!("Silicon Labs CP210x ({})", filename),
                        "pl2303" => format!("Prolific PL2303 ({})", filename),
                        "cdc_acm" => format!("USB CDC-ACM Device ({})", filename),
                        "serial8250" => format!("Standard 16550/8250 UART ({})", filename),
                        other => format!("{} ({})", other, filename),
                    };
                }
            }
        }

        if filename.starts_with("ttyUSB") {
            format!("USB-to-Serial Console ({})", filename)
        } else if filename.starts_with("ttyACM") {
            format!("CDC-ACM Serial Device ({})", filename)
        } else if filename.starts_with("ttyS") {
            format!("Hardware Serial Port ({})", filename)
        } else {
            format!("Serial Port ({})", filename)
        }
    }

    /// Open a serial port session and start bidirectional streaming with frontend.
    pub async fn start_session(
        &self,
        host: &HostConfig,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let port_path = &host.hostname;
        let baud_rate = host.baud_rate.unwrap_or_else(|| {
            if host.port > 0 && host.port != 22 && host.port != 23 {
                host.port as u32
            } else {
                9600
            }
        });

        let data_bits = match host.data_bits.unwrap_or(8) {
            5 => CharSize::Bits5,
            6 => CharSize::Bits6,
            7 => CharSize::Bits7,
            _ => CharSize::Bits8,
        };

        let stop_bits = match host.stop_bits.unwrap_or(1) {
            2 => StopBits::Two,
            _ => StopBits::One,
        };

        let parity = match host.parity.as_deref().unwrap_or("none") {
            "even" => Parity::Even,
            "odd" => Parity::Odd,
            _ => Parity::None,
        };

        let flow_control = match host.flow_control.as_deref().unwrap_or("none") {
            "hardware" | "rtscts" => FlowControl::RtsCts,
            "software" | "xonxoff" => FlowControl::XonXoff,
            _ => FlowControl::None,
        };

        // Open serial port and apply settings
        let mut port = SerialPort::open(port_path, |mut settings: Settings| {
            settings.set_raw();
            settings.set_baud_rate(baud_rate)?;
            settings.set_char_size(data_bits);
            settings.set_stop_bits(stop_bits);
            settings.set_parity(parity);
            settings.set_flow_control(flow_control);
            Ok(settings)
        })
        .map_err(|e| format!("Failed to open serial port '{}' (Baud: {}): {}", port_path, baud_rate, e))?;

        // Set non-blocking timeout for read loop so thread can terminate cleanly
        let _ = port.set_read_timeout(Duration::from_millis(100));

        let session_id = uuid::Uuid::new_v4().to_string();
        let port_arc = Arc::new(port);
        let running = Arc::new(AtomicBool::new(true));

        let session = Arc::new(SerialSession {
            _session_id: session_id.clone(),
            _port_path: port_path.to_string(),
            _baud_rate: baud_rate,
            port: port_arc.clone(),
            running: running.clone(),
        });

        {
            let mut map = self.sessions.lock().await;
            map.insert(session_id.clone(), session);
        }

        // Spawn background reader thread
        let reader_port = port_arc.clone();
        let reader_running = running.clone();
        let reader_session_id = session_id.clone();
        let handle = app_handle.clone();

        std::thread::spawn(move || {
            let mut buffer = [0u8; 1024];
            while reader_running.load(Ordering::SeqCst) {
                match reader_port.read(&mut buffer) {
                    Ok(0) => {
                        std::thread::sleep(Duration::from_millis(10));
                    }
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = handle.emit(&format!("term-data-{}", reader_session_id), text);
                    }
                    Err(ref e)
                        if e.kind() == std::io::ErrorKind::TimedOut
                            || e.kind() == std::io::ErrorKind::WouldBlock =>
                    {
                        // Timeout hit, continue loop checking running flag
                        continue;
                    }
                    Err(e) => {
                        log::warn!("Serial read stream ended on {}: {:?}", reader_session_id, e);
                        let _ = handle.emit(
                            &format!("term-data-{}", reader_session_id),
                            format!("\r\n\x1b[31m[Serial connection closed: {}]\x1b[0m\r\n", e),
                        );
                        break;
                    }
                }
            }
            let _ = handle.emit(&format!("term-exit-{}", reader_session_id), 0);
        });

        // Emit initial connection banner for network engineers
        let banner = format!(
            "\r\n\x1b[1;32m[TermiSSH Serial Console]\x1b[0m Connected to \x1b[1;36m{}\x1b[0m at \x1b[1;33m{} baud\x1b[0m (8N1)\r\n\x1b[90mPress [Enter] to activate console prompt...\x1b[0m\r\n\r\n",
            port_path, baud_rate
        );
        let _ = app_handle.emit(&format!("term-data-{}", session_id), banner);

        Ok(session_id)
    }

    pub async fn send_data(&self, session_id: &str, data: &str) -> Result<(), String> {
        let session = {
            let map = self.sessions.lock().await;
            map.get(session_id).cloned()
        };

        if let Some(s) = session {
            s.port
                .write_all(data.as_bytes())
                .map_err(|e| format!("Serial write error: {}", e))?;
            Ok(())
        } else {
            Err("Serial session not found".to_string())
        }
    }

    pub async fn close_session(&self, session_id: &str) {
        let session = {
            let mut map = self.sessions.lock().await;
            map.remove(session_id)
        };
        if let Some(s) = session {
            s.running.store(false, Ordering::SeqCst);
        }
    }

    pub async fn has_session(&self, session_id: &str) -> bool {
        let map = self.sessions.lock().await;
        map.contains_key(session_id)
    }

    pub async fn resize(&self, _session_id: &str, _cols: u32, _rows: u32) -> Result<(), String> {
        // Physical serial console UARTs have no dynamic window size protocol (unlike SSH NAWS), so we acknowledge gracefully
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_serial_ports() {
        let test_dir = std::env::temp_dir().join(format!("termish_test_serial_db_{}", uuid::Uuid::new_v4()));
        let db = Arc::new(Database::new(test_dir.join("test.db")));
        let engine = SerialEngine::new(db);
        let ports = engine.list_ports();
        // Machine has /dev/ttyS0 - /dev/ttyS3
        assert!(!ports.is_empty(), "Expected at least hardware serial ports on Linux");
    }

    #[test]
    fn test_serial_port_pair_bidirectional_comm() {
        let (pty_a, pty_b) = SerialPort::pair().expect("SerialPort::pair should succeed on Unix");
        pty_a.write_all(b"Router# show ip interface brief\r\n").unwrap();

        let mut buf = [0u8; 128];
        let n = pty_b.read(&mut buf).unwrap();
        assert_eq!(&buf[..n], b"Router# show ip interface brief\r\n");

        pty_b.write_all(b"FastEthernet0/0    192.168.1.1    YES NVRAM  up  up\r\n").unwrap();
        let n2 = pty_a.read(&mut buf).unwrap();
        assert_eq!(&buf[..n2], b"FastEthernet0/0    192.168.1.1    YES NVRAM  up  up\r\n");
    }
}
