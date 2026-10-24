use serde::{Deserialize, Serialize};

fn default_port() -> u16 {
    22
}

fn default_username() -> String {
    "root".to_string()
}

fn default_auth_type() -> String {
    "password".to_string()
}

fn default_tunnel_type() -> String {
    "local".to_string()
}

fn default_tunnel_status() -> String {
    "inactive".to_string()
}

fn default_protocol() -> Option<String> {
    Some("ssh".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostConfig {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub hostname: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_username")]
    pub username: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String, // "password", "private_key", "agent"
    pub password: Option<String>,
    pub key_id: Option<String>,
    pub key_passphrase: Option<String>,
    pub group_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub timeout_seconds: Option<u32>,
    pub keepalive_interval: Option<u32>,
    pub jump_host_id: Option<String>,
    pub proxy_command: Option<String>,
    pub identity_file: Option<String>,
    pub terminal_theme: Option<String>,
    pub font_size: Option<u32>,
    #[serde(default = "default_protocol")]
    pub protocol: Option<String>, // "ssh", "telnet", or "serial"
    pub baud_rate: Option<u32>,
    pub data_bits: Option<u8>,
    pub stop_bits: Option<u8>,
    pub parity: Option<String>,
    pub flow_control: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortInfo {
    pub path: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostGroup {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHKeyItem {
    pub id: String,
    pub name: String,
    pub key_type: String, // "ed25519", "rsa", "ecdsa"
    pub public_key: String,
    pub fingerprint_sha256: String,
    pub has_passphrase: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHTunnel {
    #[serde(default)]
    pub id: String,
    pub host_id: String,
    pub name: String,
    #[serde(default = "default_tunnel_type")]
    pub tunnel_type: String, // "local", "remote", "dynamic"
    pub local_host: String,
    pub local_port: u16,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
    #[serde(default = "default_tunnel_status")]
    pub status: String, // "inactive", "starting", "active", "error"
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandSnippet {
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub command: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePane {
    pub host_id: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceItem {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub environment: String, // "development", "staging", "production", "general"
    #[serde(default)]
    pub layout: String,      // "single", "split-vertical", "split-horizontal", "grid"
    #[serde(default)]
    pub panes: Vec<WorkspacePane>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHistoryEntry {
    pub id: String,
    pub host_id: String,
    pub host_name: String,
    pub connected_at: String,
    pub disconnected_at: Option<String>,
    pub status: String, // "connected", "disconnected", "failed"
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: String,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPromptData {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub is_mismatch: bool,
    pub old_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback_lines: u32,
    pub copy_on_select: bool,
    pub keepalive_interval_default: u32,
    pub default_timeout_seconds: u32,
    pub confirm_before_closing_active_tab: bool,
    pub sound_bell: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHConfigFileInfo {
    pub path: String,
    pub content: String,
    pub exists: bool,
    pub permissions: Option<String>,
    pub modified_at: Option<String>,
    pub backup_path: Option<String>,
}
