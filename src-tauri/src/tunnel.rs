use crate::db::Database;
use crate::ssh_engine::SSHEngine;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex};

pub struct TunnelEngine {
    db: Arc<Database>,
    ssh_engine: Arc<SSHEngine>,
    active_tunnels: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
}

impl TunnelEngine {
    pub fn new(db: Arc<Database>, ssh_engine: Arc<SSHEngine>) -> Self {
        Self {
            db,
            ssh_engine,
            active_tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        let tunnel = self
            .db
            .get_tunnel(tunnel_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Tunnel configuration not found".to_string())?;

        // Port conflict check
        let bind_addr = format!("{}:{}", tunnel.local_host, tunnel.local_port);
        match std::net::TcpListener::bind(&bind_addr) {
            Ok(listener) => drop(listener),
            Err(e) => {
                let err_msg = format!("Local port conflict on {}: {}", bind_addr, e);
                self.db
                    .update_tunnel_status(tunnel_id, "error", Some(&err_msg))
                    .ok();
                return Err(err_msg);
            }
        }

        // Establish SSH session handle
        let session = self
            .ssh_engine
            .connect_host(&tunnel.host_id)
            .await
            .map_err(|e| {
                let err_msg = format!("SSH connection failed: {}", e);
                self.db
                    .update_tunnel_status(tunnel_id, "error", Some(&err_msg))
                    .ok();
                err_msg
            })?;

        let listener = TcpListener::bind(&bind_addr)
            .await
            .map_err(|e| format!("Failed to bind {}: {}", bind_addr, e))?;

        let (stop_tx, mut stop_rx) = oneshot::channel::<()>();

        {
            let mut lock = self.active_tunnels.lock().await;
            lock.insert(tunnel_id.to_string(), stop_tx);
        }

        self.db.update_tunnel_status(tunnel_id, "active", None).ok();

        let session = Arc::new(session);
        let tun_type = tunnel.tunnel_type.clone();
        let remote_host = tunnel.remote_host.unwrap_or_else(|| "127.0.0.1".to_string());
        let remote_port = tunnel.remote_port.unwrap_or(80);
        let tid = tunnel_id.to_string();
        let db_clone = self.db.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_res = listener.accept() => {
                        match accept_res {
                            Ok((mut client_stream, _)) => {
                                let sess_clone = session.clone();
                                let tt = tun_type.clone();
                                let rh = remote_host.clone();

                                tokio::spawn(async move {
                                    if tt == "dynamic" {
                                        // Handle SOCKS5 Dynamic Proxy Handshake (RFC 1928)
                                        if let Err(e) = handle_socks5(&mut client_stream, sess_clone).await {
                                            log::debug!("SOCKS5 handling error: {:?}", e);
                                        }
                                    } else {
                                        // Local Direct TCP/IP Forwarding (-L)
                                        if let Ok(channel) = sess_clone
                                            .channel_open_direct_tcpip(rh, remote_port as u32, "127.0.0.1", 0)
                                            .await
                                        {
                                            let mut channel_stream = channel.into_stream();
                                            tokio::io::copy_bidirectional(&mut client_stream, &mut channel_stream).await.ok();
                                        }
                                    }
                                });
                            }
                            Err(_) => break,
                        }
                    }
                    _ = &mut stop_rx => {
                        break;
                    }
                }
            }
            db_clone.update_tunnel_status(&tid, "inactive", None).ok();
        });

        Ok(())
    }

    pub async fn stop_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        let mut lock = self.active_tunnels.lock().await;
        if let Some(tx) = lock.remove(tunnel_id) {
            tx.send(()).ok();
        }
        self.db.update_tunnel_status(tunnel_id, "inactive", None).ok();
        Ok(())
    }
}

// RFC 1928 Compliant SOCKS5 Proxy Handshake
async fn handle_socks5(
    stream: &mut TcpStream,
    session: Arc<russh::client::Handle<crate::ssh_engine::ClientHandler>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut ver_buf = [0u8; 2];
    stream.read_exact(&mut ver_buf).await?;
    if ver_buf[0] != 0x05 {
        return Err("Unsupported SOCKS version".into());
    }

    let num_methods = ver_buf[1] as usize;
    let mut methods = vec![0u8; num_methods];
    stream.read_exact(&mut methods).await?;

    // Respond: SOCKS5, No Authentication Required (0x00)
    stream.write_all(&[0x05, 0x00]).await?;

    // Request Details
    let mut req_header = [0u8; 4];
    stream.read_exact(&mut req_header).await?;
    if req_header[0] != 0x05 || req_header[1] != 0x01 {
        // Only CONNECT command supported
        stream.write_all(&[0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await?;
        return Err("Unsupported SOCKS5 command".into());
    }

    let target_host = match req_header[3] {
        0x01 => {
            // IPv4
            let mut ipv4 = [0u8; 4];
            stream.read_exact(&mut ipv4).await?;
            format!("{}.{}.{}.{}", ipv4[0], ipv4[1], ipv4[2], ipv4[3])
        }
        0x03 => {
            // Domain name
            let mut len_buf = [0u8; 1];
            stream.read_exact(&mut len_buf).await?;
            let mut domain_buf = vec![0u8; len_buf[0] as usize];
            stream.read_exact(&mut domain_buf).await?;
            String::from_utf8(domain_buf)?
        }
        0x04 => {
            // IPv6
            let mut ipv6 = [0u8; 16];
            stream.read_exact(&mut ipv6).await?;
            std::net::Ipv6Addr::from(ipv6).to_string()
        }
        _ => return Err("Unsupported SOCKS5 address type".into()),
    };

    let mut port_buf = [0u8; 2];
    stream.read_exact(&mut port_buf).await?;
    let target_port = u16::from_be_bytes(port_buf);

    // Open direct-tcpip channel through SSH connection
    let channel = session
        .channel_open_direct_tcpip(target_host, target_port as u32, "127.0.0.1", 0)
        .await?;

    // Send Success Reply
    stream.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]).await?;

    let mut channel_stream = channel.into_stream();
    tokio::io::copy_bidirectional(stream, &mut channel_stream).await?;

    Ok(())
}
