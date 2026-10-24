use crate::models::*;
use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(data_dir: PathBuf) -> Self {
        fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("termissh.db");
        let conn = Connection::open(&db_path).expect("Failed to open SQLite database");

        // Enable WAL mode for high performance concurrency
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
            .ok();

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_schema();
        db.seed_defaults();
        db
    }

    fn init_schema(&self) {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS host_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                sort_order INTEGER
            );

            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                hostname TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username TEXT NOT NULL,
                auth_type TEXT NOT NULL,
                key_id TEXT,
                group_id TEXT,
                tags_json TEXT,
                timeout_seconds INTEGER DEFAULT 15,
                keepalive_interval INTEGER DEFAULT 30,
                jump_host_id TEXT,
                proxy_command TEXT,
                identity_file TEXT,
                terminal_theme TEXT DEFAULT 'dark',
                font_size INTEGER DEFAULT 14,
                protocol TEXT DEFAULT 'ssh',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ssh_keys (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                key_type TEXT NOT NULL,
                public_key TEXT NOT NULL,
                fingerprint_sha256 TEXT NOT NULL,
                has_passphrase INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tunnels (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                name TEXT NOT NULL,
                tunnel_type TEXT NOT NULL,
                local_host TEXT NOT NULL,
                local_port INTEGER NOT NULL,
                remote_host TEXT,
                remote_port INTEGER,
                status TEXT NOT NULL DEFAULT 'inactive',
                error_message TEXT
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                command TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT
            );

            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                environment TEXT NOT NULL,
                layout TEXT NOT NULL,
                panes_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS known_hosts (
                id TEXT PRIMARY KEY,
                host_pattern TEXT NOT NULL,
                port INTEGER NOT NULL,
                key_type TEXT NOT NULL,
                fingerprint_sha256 TEXT NOT NULL,
                first_seen TEXT NOT NULL,
                last_verified TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS connection_history (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                host_name TEXT NOT NULL,
                connected_at TEXT NOT NULL,
                disconnected_at TEXT,
                status TEXT NOT NULL,
                error_message TEXT
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )
        .expect("Failed to initialize database schema");

        // Schema migrations for existing databases
        conn.execute("ALTER TABLE hosts ADD COLUMN proxy_command TEXT;", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN identity_file TEXT;", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN protocol TEXT DEFAULT 'ssh';", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN baud_rate INTEGER DEFAULT 9600;", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN data_bits INTEGER DEFAULT 8;", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN stop_bits INTEGER DEFAULT 1;", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN parity TEXT DEFAULT 'none';", []).ok();
        conn.execute("ALTER TABLE hosts ADD COLUMN flow_control TEXT DEFAULT 'none';", []).ok();
    }

    fn seed_defaults(&self) {
        let conn = self.conn.lock().unwrap();

        // Check if groups empty -> seed
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM host_groups", [], |r| r.get(0))
            .unwrap_or(0);
        if count == 0 {
            let defaults = vec![
                ("grp-prod", "Production Cluster", "Production servers and critical nodes", "#ef4444", 1),
                ("grp-stage", "Staging Environment", "Testing and pre-release validation", "#f59e0b", 2),
                ("grp-infra", "Infrastructure & DB", "Database clusters, routers and bastion gateways", "#3b82f6", 3),
            ];
            for (id, name, desc, color, sort) in defaults {
                conn.execute(
                    "INSERT INTO host_groups (id, name, description, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![id, name, desc, color, sort],
                ).ok();
            }
        }

        // Check if snippets empty -> seed
        let snip_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM snippets", [], |r| r.get(0))
            .unwrap_or(0);
        if snip_count == 0 {
            let sample_snippets = vec![
                (
                    "snip-1",
                    "Docker Container Logs",
                    "Stream logs from any running container with tail",
                    "docker logs -f --tail {{lines:100}} {{container_name}}",
                    "Docker & Containers",
                    "[\"docker\",\"logs\",\"tail\"]",
                ),
                (
                    "snip-2",
                    "Systemd Service Restart",
                    "Safely restart service and inspect immediate status",
                    "sudo systemctl restart {{service:nginx}} && sudo systemctl status {{service:nginx}} --no-pager",
                    "Sysadmin",
                    "[\"systemd\",\"restart\",\"service\"]",
                ),
                (
                    "snip-3",
                    "Disk Usage Summary",
                    "Overview of disk usage and top consuming root directories",
                    "df -h && echo '=== Top 10 Large Directories ===' && sudo du -sh /* 2>/dev/null | sort -hr | head -n 10",
                    "Sysadmin",
                    "[\"disk\",\"storage\",\"du\"]",
                ),
                (
                    "snip-4",
                    "Network Listening Ports",
                    "List all TCP/UDP listening sockets with process names",
                    "sudo ss -tulwnp | grep -E 'LISTEN|State'",
                    "Network & Diagnostics",
                    "[\"ports\",\"ss\",\"networking\"]",
                ),
                (
                    "snip-5",
                    "Memory & Top CPU Stats",
                    "Inspect available RAM and top CPU consumers",
                    "free -m && echo '=== Top CPU Processes ===' && ps aux --sort=-%cpu | head -n 10",
                    "Sysadmin",
                    "[\"memory\",\"cpu\",\"top\"]",
                ),
            ];

            for (id, title, desc, cmd, cat, tags) in sample_snippets {
                conn.execute(
                    "INSERT INTO snippets (id, title, description, command, category, tags_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![id, title, desc, cmd, cat, tags],
                ).ok();
            }
        }

        // Check if gateway telnet test host exists -> seed
        let gw_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM hosts WHERE hostname = '192.168.10.1' OR id = 'host-gateway-telnet'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if gw_count == 0 {
            let now = chrono::Utc::now().to_rfc3339();
            let tags = serde_json::to_string(&vec!["router".to_string(), "gateway".to_string(), "telnet".to_string()]).unwrap_or_default();
            conn.execute(
                r#"
                INSERT INTO hosts (
                    id, name, description, hostname, port, username, auth_type,
                    key_id, group_id, tags_json, timeout_seconds, keepalive_interval,
                    jump_host_id, proxy_command, identity_file, terminal_theme, font_size, created_at, updated_at, protocol
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
                "#,
                params![
                    "host-gateway-telnet",
                    "Huawei Gateway (192.168.10.1)",
                    "Local Huawei Home Gateway router for Telnet testing",
                    "192.168.10.1",
                    23,
                    "admin",
                    "password",
                    None::<String>,
                    Some("grp-infra"),
                    tags,
                    15,
                    30,
                    None::<String>,
                    None::<String>,
                    None::<String>,
                    "dark",
                    14,
                    now,
                    now,
                    "telnet"
                ],
            ).ok();
        }
    }

    // Hosts
    pub fn get_hosts(&self) -> Result<Vec<HostConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, hostname, port, username, auth_type, key_id, group_id, tags_json, timeout_seconds, keepalive_interval, jump_host_id, proxy_command, identity_file, terminal_theme, font_size, created_at, updated_at, protocol, baud_rate, data_bits, stop_bits, parity, flow_control FROM hosts ORDER BY name ASC",
        )?;

        let host_iter = stmt.query_map([], |row| {
            let tags_json: Option<String> = row.get(9)?;
            let tags: Option<Vec<String>> = tags_json.and_then(|j| serde_json::from_str(&j).ok());
            let protocol: Option<String> = row.get(19).unwrap_or(None).or_else(|| Some("ssh".to_string()));

            Ok(HostConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                hostname: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_type: row.get(6)?,
                password: None,
                key_id: row.get(7)?,
                key_passphrase: None,
                group_id: row.get(8)?,
                tags,
                timeout_seconds: row.get(10)?,
                keepalive_interval: row.get(11)?,
                jump_host_id: row.get(12)?,
                proxy_command: row.get(13)?,
                identity_file: row.get(14)?,
                terminal_theme: row.get(15)?,
                font_size: row.get(16)?,
                protocol,
                baud_rate: row.get(20)?,
                data_bits: row.get(21)?,
                stop_bits: row.get(22)?,
                parity: row.get(23)?,
                flow_control: row.get(24)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            })
        })?;

        let mut hosts = Vec::new();
        for h in host_iter {
            hosts.push(h?);
        }
        Ok(hosts)
    }

    pub fn get_host(&self, id: &str) -> Result<Option<HostConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, hostname, port, username, auth_type, key_id, group_id, tags_json, timeout_seconds, keepalive_interval, jump_host_id, proxy_command, identity_file, terminal_theme, font_size, created_at, updated_at, protocol, baud_rate, data_bits, stop_bits, parity, flow_control FROM hosts WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let tags_json: Option<String> = row.get(9)?;
            let tags: Option<Vec<String>> = tags_json.and_then(|j| serde_json::from_str(&j).ok());
            let protocol: Option<String> = row.get(19).unwrap_or(None).or_else(|| Some("ssh".to_string()));

            Ok(Some(HostConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                hostname: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_type: row.get(6)?,
                password: None,
                key_id: row.get(7)?,
                key_passphrase: None,
                group_id: row.get(8)?,
                tags,
                timeout_seconds: row.get(10)?,
                keepalive_interval: row.get(11)?,
                jump_host_id: row.get(12)?,
                proxy_command: row.get(13)?,
                identity_file: row.get(14)?,
                terminal_theme: row.get(15)?,
                font_size: row.get(16)?,
                protocol,
                baud_rate: row.get(20)?,
                data_bits: row.get(21)?,
                stop_bits: row.get(22)?,
                parity: row.get(23)?,
                flow_control: row.get(24)?,
                created_at: row.get(17)?,
                updated_at: row.get(18)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_host(&self, host: &HostConfig) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_json = host.tags.as_ref().map(|t| serde_json::to_string(t).unwrap_or_default());
        let now = chrono::Utc::now().to_rfc3339();
        let created_at = host.created_at.as_deref().unwrap_or(&now);
        let protocol = host.protocol.as_deref().unwrap_or("ssh");

        conn.execute(
            r#"
            INSERT INTO hosts (
                id, name, description, hostname, port, username, auth_type,
                key_id, group_id, tags_json, timeout_seconds, keepalive_interval,
                jump_host_id, proxy_command, identity_file, terminal_theme, font_size, created_at, updated_at, protocol,
                baud_rate, data_bits, stop_bits, parity, flow_control
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                hostname = excluded.hostname,
                port = excluded.port,
                username = excluded.username,
                auth_type = excluded.auth_type,
                key_id = excluded.key_id,
                group_id = excluded.group_id,
                tags_json = excluded.tags_json,
                timeout_seconds = excluded.timeout_seconds,
                keepalive_interval = excluded.keepalive_interval,
                jump_host_id = excluded.jump_host_id,
                proxy_command = excluded.proxy_command,
                identity_file = excluded.identity_file,
                terminal_theme = excluded.terminal_theme,
                font_size = excluded.font_size,
                protocol = excluded.protocol,
                baud_rate = excluded.baud_rate,
                data_bits = excluded.data_bits,
                stop_bits = excluded.stop_bits,
                parity = excluded.parity,
                flow_control = excluded.flow_control,
                updated_at = excluded.updated_at
            "#,
            params![
                host.id,
                host.name,
                host.description,
                host.hostname,
                host.port,
                host.username,
                host.auth_type,
                host.key_id,
                host.group_id,
                tags_json,
                host.timeout_seconds.unwrap_or(15),
                host.keepalive_interval.unwrap_or(30),
                host.jump_host_id,
                host.proxy_command,
                host.identity_file,
                host.terminal_theme.as_deref().unwrap_or("dark"),
                host.font_size.unwrap_or(14),
                created_at,
                now,
                protocol,
                host.baud_rate.unwrap_or(9600),
                host.data_bits.unwrap_or(8),
                host.stop_bits.unwrap_or(1),
                host.parity.as_deref().unwrap_or("none"),
                host.flow_control.as_deref().unwrap_or("none"),
            ],
        )?;
        Ok(())
    }

    pub fn delete_host(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Groups
    pub fn get_groups(&self) -> Result<Vec<HostGroup>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, description, color, sort_order FROM host_groups ORDER BY sort_order ASC, name ASC")?;
        let iter = stmt.query_map([], |r| {
            Ok(HostGroup {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                color: r.get(3)?,
                sort_order: r.get(4)?,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn save_group(&self, group: &HostGroup) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO host_groups (id, name, description, color, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, color = excluded.color, sort_order = excluded.sort_order",
            params![group.id, group.name, group.description, group.color, group.sort_order.unwrap_or(0)],
        )?;
        Ok(())
    }

    pub fn delete_group(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE hosts SET group_id = NULL WHERE group_id = ?1", params![id])?;
        conn.execute("DELETE FROM host_groups WHERE id = ?1", params![id])?;
        Ok(())
    }

    // SSH Keys
    pub fn get_ssh_keys(&self) -> Result<Vec<SSHKeyItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, key_type, public_key, fingerprint_sha256, has_passphrase, created_at FROM ssh_keys ORDER BY name ASC")?;
        let iter = stmt.query_map([], |r| {
            let has_pass: i32 = r.get(5)?;
            Ok(SSHKeyItem {
                id: r.get(0)?,
                name: r.get(1)?,
                key_type: r.get(2)?,
                public_key: r.get(3)?,
                fingerprint_sha256: r.get(4)?,
                has_passphrase: has_pass != 0,
                created_at: r.get(6)?,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn save_ssh_key(&self, key: &SSHKeyItem) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO ssh_keys (id, name, key_type, public_key, fingerprint_sha256, has_passphrase, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, public_key = excluded.public_key, fingerprint_sha256 = excluded.fingerprint_sha256, has_passphrase = excluded.has_passphrase",
            params![key.id, key.name, key.key_type, key.public_key, key.fingerprint_sha256, if key.has_passphrase { 1 } else { 0 }, key.created_at],
        )?;
        Ok(())
    }

    pub fn delete_ssh_key(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM ssh_keys WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Known Hosts & Host Key Verification
    pub fn get_known_host_key(&self, host: &str, port: u16) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT fingerprint_sha256 FROM known_hosts WHERE host_pattern = ?1 AND port = ?2 LIMIT 1",
        )?;
        let mut rows = stmt.query(params![host, port])?;
        if let Some(r) = rows.next()? {
            Ok(Some(r.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn save_known_host(
        &self,
        host: &str,
        port: u16,
        key_type: &str,
        fingerprint: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let id = format!("{}:{}:{}", host, port, key_type);

        conn.execute(
            "INSERT INTO known_hosts (id, host_pattern, port, key_type, fingerprint_sha256, first_seen, last_verified)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET fingerprint_sha256 = excluded.fingerprint_sha256, last_verified = excluded.last_verified",
            params![id, host, port, key_type, fingerprint, now, now],
        )?;
        Ok(())
    }

    // Tunnels
    pub fn get_tunnels(&self) -> Result<Vec<SSHTunnel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, status, error_message FROM tunnels ORDER BY name ASC")?;
        let iter = stmt.query_map([], |r| {
            Ok(SSHTunnel {
                id: r.get(0)?,
                host_id: r.get(1)?,
                name: r.get(2)?,
                tunnel_type: r.get(3)?,
                local_host: r.get(4)?,
                local_port: r.get(5)?,
                remote_host: r.get(6)?,
                remote_port: r.get(7)?,
                status: r.get(8)?,
                error_message: r.get(9)?,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn get_tunnel(&self, id: &str) -> Result<Option<SSHTunnel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, status, error_message FROM tunnels WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(r) = rows.next()? {
            Ok(Some(SSHTunnel {
                id: r.get(0)?,
                host_id: r.get(1)?,
                name: r.get(2)?,
                tunnel_type: r.get(3)?,
                local_host: r.get(4)?,
                local_port: r.get(5)?,
                remote_host: r.get(6)?,
                remote_port: r.get(7)?,
                status: r.get(8)?,
                error_message: r.get(9)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_tunnel(&self, tunnel: &SSHTunnel) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tunnels (id, host_id, name, tunnel_type, local_host, local_port, remote_host, remote_port, status, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                host_id = excluded.host_id,
                name = excluded.name,
                tunnel_type = excluded.tunnel_type,
                local_host = excluded.local_host,
                local_port = excluded.local_port,
                remote_host = excluded.remote_host,
                remote_port = excluded.remote_port,
                status = excluded.status,
                error_message = excluded.error_message",
            params![tunnel.id, tunnel.host_id, tunnel.name, tunnel.tunnel_type, tunnel.local_host, tunnel.local_port, tunnel.remote_host, tunnel.remote_port, tunnel.status, tunnel.error_message],
        )?;
        Ok(())
    }

    pub fn update_tunnel_status(&self, id: &str, status: &str, error: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tunnels SET status = ?1, error_message = ?2 WHERE id = ?3",
            params![status, error, id],
        )?;
        Ok(())
    }

    pub fn delete_tunnel(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM tunnels WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Snippets
    pub fn get_snippets(&self) -> Result<Vec<CommandSnippet>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, description, command, category, tags_json FROM snippets ORDER BY category ASC, title ASC")?;
        let iter = stmt.query_map([], |r| {
            let tags_json: Option<String> = r.get(5)?;
            let tags = tags_json.and_then(|j| serde_json::from_str(&j).ok()).unwrap_or_default();
            Ok(CommandSnippet {
                id: r.get(0)?,
                title: r.get(1)?,
                description: r.get(2)?,
                command: r.get(3)?,
                category: r.get(4)?,
                tags,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn save_snippet(&self, snip: &CommandSnippet) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_json = serde_json::to_string(&snip.tags).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO snippets (id, title, description, command, category, tags_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET title = excluded.title, description = excluded.description, command = excluded.command, category = excluded.category, tags_json = excluded.tags_json",
            params![snip.id, snip.title, snip.description, snip.command, snip.category, tags_json],
        )?;
        Ok(())
    }

    pub fn delete_snippet(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Workspaces
    pub fn get_workspaces(&self) -> Result<Vec<WorkspaceItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, environment, layout, panes_json FROM workspaces ORDER BY name ASC")?;
        let iter = stmt.query_map([], |r| {
            let panes_json: String = r.get(4)?;
            let panes = serde_json::from_str(&panes_json).unwrap_or_default();
            Ok(WorkspaceItem {
                id: r.get(0)?,
                name: r.get(1)?,
                environment: r.get(2)?,
                layout: r.get(3)?,
                panes,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn save_workspace(&self, ws: &WorkspaceItem) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let panes_json = serde_json::to_string(&ws.panes).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "INSERT INTO workspaces (id, name, environment, layout, panes_json) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, environment = excluded.environment, layout = excluded.layout, panes_json = excluded.panes_json",
            params![ws.id, ws.name, ws.environment, ws.layout, panes_json],
        )?;
        Ok(())
    }

    pub fn delete_workspace(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
        Ok(())
    }

    // Connection History
    pub fn get_history(&self) -> Result<Vec<ConnectionHistoryEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, host_id, host_name, connected_at, disconnected_at, status, error_message FROM connection_history ORDER BY connected_at DESC LIMIT 200")?;
        let iter = stmt.query_map([], |r| {
            Ok(ConnectionHistoryEntry {
                id: r.get(0)?,
                host_id: r.get(1)?,
                host_name: r.get(2)?,
                connected_at: r.get(3)?,
                disconnected_at: r.get(4)?,
                status: r.get(5)?,
                error_message: r.get(6)?,
            })
        })?;
        let mut list = Vec::new();
        for item in iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn record_history_start(&self, entry: &ConnectionHistoryEntry) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO connection_history (id, host_id, host_name, connected_at, disconnected_at, status, error_message) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![entry.id, entry.host_id, entry.host_name, entry.connected_at, entry.disconnected_at, entry.status, entry.error_message],
        )?;
        Ok(())
    }

    pub fn record_history_end(&self, id: &str, status: &str, error: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE connection_history SET disconnected_at = ?1, status = ?2, error_message = ?3 WHERE id = ?4",
            params![now, status, error, id],
        )?;
        Ok(())
    }

    pub fn clear_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM connection_history", [])?;
        Ok(())
    }

    // Settings
    pub fn get_settings(&self) -> Result<AppSettings> {
        let conn = self.conn.lock().unwrap();
        let val: Result<String> = conn.query_row(
            "SELECT value FROM app_settings WHERE key = 'user_settings'",
            [],
            |r| r.get(0),
        );
        match val {
            Ok(json_str) => Ok(serde_json::from_str(&json_str).unwrap_or(AppSettings {
                theme: "dark".to_string(),
                font_family: "Menlo, Monaco, 'Courier New', monospace".to_string(),
                font_size: 14,
                cursor_style: "block".to_string(),
                cursor_blink: true,
                scrollback_lines: 10000,
                copy_on_select: true,
                keepalive_interval_default: 30,
                default_timeout_seconds: 15,
                confirm_before_closing_active_tab: true,
                sound_bell: false,
            })),
            Err(_) => Ok(AppSettings {
                theme: "dark".to_string(),
                font_family: "Menlo, Monaco, 'Courier New', monospace".to_string(),
                font_size: 14,
                cursor_style: "block".to_string(),
                cursor_blink: true,
                scrollback_lines: 10000,
                copy_on_select: true,
                keepalive_interval_default: 30,
                default_timeout_seconds: 15,
                confirm_before_closing_active_tab: true,
                sound_bell: false,
            }),
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let json_str = serde_json::to_string(settings).unwrap_or_default();
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('user_settings', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![json_str],
        )?;
        Ok(())
    }

    pub fn clear_all_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            DELETE FROM hosts;
            DELETE FROM host_groups;
            DELETE FROM ssh_keys;
            DELETE FROM tunnels;
            DELETE FROM snippets;
            DELETE FROM workspaces;
            DELETE FROM connection_history;
            "#,
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::HostConfig;

    fn setup_test_db() -> (Database, std::path::PathBuf) {
        let test_dir = std::env::temp_dir().join(format!("termish_test_db_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&test_dir).unwrap();
        let db_path = test_dir.join("test.db");
        let db = Database::new(db_path);
        (db, test_dir)
    }

    #[test]
    fn test_db_initialization_and_seeds() {
        let (db, test_dir) = setup_test_db();

        let groups = db.get_groups().expect("Failed to query host groups");
        assert_eq!(groups.len(), 3, "Expected 3 seeded host groups");
        assert_eq!(groups[0].name, "Production Cluster");

        let snippets = db.get_snippets().expect("Failed to query snippets");
        assert_eq!(snippets.len(), 5, "Expected 5 seeded default snippets");

        let settings = db.get_settings().expect("Failed to query settings");
        assert_eq!(settings.theme, "dark");

        let _ = std::fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_host_crud() {
        let (db, test_dir) = setup_test_db();

        let new_host = HostConfig {
            id: "test-host-1".to_string(),
            name: "Production Gateway".to_string(),
            description: Some("Critical gateway".to_string()),
            hostname: "192.168.1.100".to_string(),
            port: 2222,
            username: "admin".to_string(),
            auth_type: "key".to_string(),
            password: None,
            key_id: Some("key-1".to_string()),
            key_passphrase: None,
            group_id: None,
            tags: Some(vec!["prod".to_string(), "bastion".to_string()]),
            jump_host_id: None,
            proxy_command: None,
            identity_file: None,
            timeout_seconds: Some(20),
            keepalive_interval: Some(60),
            terminal_theme: None,
            font_size: None,
            protocol: Some("ssh".to_string()),
            baud_rate: Some(9600),
            data_bits: Some(8),
            stop_bits: Some(1),
            parity: Some("none".to_string()),
            flow_control: Some("none".to_string()),
            created_at: None,
            updated_at: None,
        };

        db.save_host(&new_host).expect("Save host failed");

        let fetched = db.get_host("test-host-1").expect("Get host failed").expect("Host not found");
        assert_eq!(fetched.name, "Production Gateway");
        assert_eq!(fetched.hostname, "192.168.1.100");
        assert_eq!(fetched.port, 2222);
        assert_eq!(fetched.tags, Some(vec!["prod".to_string(), "bastion".to_string()]));

        db.delete_host("test-host-1").expect("Delete host failed");
        let after_delete = db.get_host("test-host-1").expect("Get host query failed");
        assert!(after_delete.is_none());

        let _ = std::fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_known_hosts_verification() {
        let (db, test_dir) = setup_test_db();

        // 1. Host not known yet
        let known = db.get_known_host_key("srv.example.com", 22).expect("Query failed");
        assert!(known.is_none());

        // 2. Save trusted host key (TOFU)
        let fingerprint = "SHA256:abcd1234efgh5678ijkl9012mnop3456qrst7890";
        db.save_known_host("srv.example.com", 22, "ssh-ed25519", fingerprint)
            .expect("Save known host failed");

        // 3. Retrieve and match
        let retrieved = db.get_known_host_key("srv.example.com", 22).expect("Query failed").expect("Known host not found");
        assert_eq!(retrieved, fingerprint);

        // 4. Update key (e.g. after user confirms key change)
        let new_fingerprint = "SHA256:zzzz9999yyyy8888xxxx7777wwww6666vvvv5555";
        db.save_known_host("srv.example.com", 22, "ssh-ed25519", new_fingerprint)
            .expect("Update known host failed");

        let updated = db.get_known_host_key("srv.example.com", 22).expect("Query failed").expect("Known host not found");
        assert_eq!(updated, new_fingerprint);

        let _ = std::fs::remove_dir_all(test_dir);
    }
}
