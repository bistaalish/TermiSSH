use crate::db::Database;
use crate::models::{
    AppSettings, CommandSnippet, HostConfig, HostGroup, SSHKeyItem, SSHTunnel, WorkspaceItem,
};
use crate::vault::SecureVault;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::prelude::*;
use pbkdf2::pbkdf2_hmac;
use rand::RngExt;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::fs;

const BACKUP_FORMAT_VERSION: u32 = 1;
const PBKDF2_ITERATIONS: u32 = 100_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPayload {
    pub app: String,
    pub version: u32,
    pub created_at: String,
    pub hosts: Vec<HostConfig>,
    pub host_groups: Vec<HostGroup>,
    pub ssh_keys: Vec<SSHKeyItem>,
    pub tunnels: Vec<SSHTunnel>,
    pub snippets: Vec<CommandSnippet>,
    pub workspaces: Vec<WorkspaceItem>,
    pub app_settings: Option<AppSettings>,
    pub secrets: HashMap<String, String>,
}

fn default_encryption_type() -> String {
    "password".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupContainer {
    pub app: String,
    pub version: u32,
    pub created_at: String,
    pub is_encrypted: bool,
    #[serde(default = "default_encryption_type")]
    pub encryption_type: String, // "password" | "device_key" | "none"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub salt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ciphertext: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<BackupPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPreview {
    pub app: String,
    pub version: u32,
    pub created_at: String,
    pub is_encrypted: bool,
    pub encryption_type: String,
    pub host_count: usize,
    pub group_count: usize,
    pub key_count: usize,
    pub tunnel_count: usize,
    pub snippet_count: usize,
    pub workspace_count: usize,
    pub secret_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreOptions {
    pub mode: String, // "merge" | "replace"
    pub include_hosts: bool,
    pub include_keys: bool,
    pub include_tunnels: bool,
    pub include_snippets: bool,
    pub include_workspaces: bool,
    pub include_settings: bool,
}

impl Default for RestoreOptions {
    fn default() -> Self {
        Self {
            mode: "merge".to_string(),
            include_hosts: true,
            include_keys: true,
            include_tunnels: true,
            include_snippets: true,
            include_workspaces: true,
            include_settings: true,
        }
    }
}

pub struct BackupManager;

impl BackupManager {
    /// Always creates an AES-256-GCM encrypted backup container.
    /// If password is provided: encrypted via PBKDF2(password) + AES-256-GCM (portable).
    /// If password is None: encrypted via device master key + AES-256-GCM (auto-unlock on this machine).
    pub fn create_backup(
        db: &Database,
        vault: &SecureVault,
        password: Option<&str>,
    ) -> Result<BackupContainer, String> {
        let hosts = db.get_hosts().map_err(|e| e.to_string())?;
        let host_groups = db.get_groups().map_err(|e| e.to_string())?;
        let ssh_keys = db.get_ssh_keys().map_err(|e| e.to_string())?;
        let tunnels = db.get_tunnels().map_err(|e| e.to_string())?;
        let snippets = db.get_snippets().map_err(|e| e.to_string())?;
        let workspaces = db.get_workspaces().map_err(|e| e.to_string())?;
        let app_settings = db.get_settings().ok();
        let secrets = vault.get_all().unwrap_or_default();

        let created_at = chrono::Utc::now().to_rfc3339();

        let payload = BackupPayload {
            app: "TermiSSH".to_string(),
            version: BACKUP_FORMAT_VERSION,
            created_at: created_at.clone(),
            hosts,
            host_groups,
            ssh_keys,
            tunnels,
            snippets,
            workspaces,
            app_settings,
            secrets,
        };

        let json_str = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

        let mut nonce_bytes = [0u8; 12];
        rand::rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        if let Some(pwd) = password.filter(|p| !p.trim().is_empty()) {
            let mut salt = [0u8; 16];
            rand::rng().fill(&mut salt);

            let mut key = [0u8; 32];
            pbkdf2_hmac::<Sha256>(pwd.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

            let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
            let ciphertext = cipher
                .encrypt(&nonce, json_str.as_bytes())
                .map_err(|e| format!("Encryption error: {:?}", e))?;

            Ok(BackupContainer {
                app: "TermiSSH".to_string(),
                version: BACKUP_FORMAT_VERSION,
                created_at,
                is_encrypted: true,
                encryption_type: "password".to_string(),
                salt: Some(BASE64_STANDARD.encode(salt)),
                nonce: Some(BASE64_STANDARD.encode(nonce_bytes)),
                ciphertext: Some(BASE64_STANDARD.encode(ciphertext)),
                payload: None,
            })
        } else {
            // Encrypt using local device vault master key
            let key = vault.get_master_key();
            let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
            let ciphertext = cipher
                .encrypt(&nonce, json_str.as_bytes())
                .map_err(|e| format!("Encryption error: {:?}", e))?;

            Ok(BackupContainer {
                app: "TermiSSH".to_string(),
                version: BACKUP_FORMAT_VERSION,
                created_at,
                is_encrypted: true,
                encryption_type: "device_key".to_string(),
                salt: None,
                nonce: Some(BASE64_STANDARD.encode(nonce_bytes)),
                ciphertext: Some(BASE64_STANDARD.encode(ciphertext)),
                payload: None,
            })
        }
    }

    pub fn decrypt_and_extract_payload(
        container: &BackupContainer,
        vault: &SecureVault,
        password: Option<&str>,
    ) -> Result<BackupPayload, String> {
        // Fallback for legacy unencrypted backups (if any)
        if !container.is_encrypted {
            return container
                .payload
                .clone()
                .ok_or_else(|| "Backup payload is missing".to_string());
        }

        let nonce_b64 = container
            .nonce
            .as_ref()
            .ok_or_else(|| "Corrupted backup: nonce missing".to_string())?;
        let cipher_b64 = container
            .ciphertext
            .as_ref()
            .ok_or_else(|| "Corrupted backup: ciphertext missing".to_string())?;

        let nonce_bytes = BASE64_STANDARD
            .decode(nonce_b64)
            .map_err(|e| format!("Invalid nonce encoding: {}", e))?;
        let ciphertext = BASE64_STANDARD
            .decode(cipher_b64)
            .map_err(|e| format!("Invalid ciphertext encoding: {}", e))?;
        let nonce = Nonce::try_from(nonce_bytes.as_slice())
            .map_err(|_| "Invalid nonce length".to_string())?;

        let is_device_key = container.encryption_type == "device_key" || container.salt.is_none();

        let key: [u8; 32] = if is_device_key {
            vault.get_master_key()
        } else {
            let pwd = password
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "Password is required to decrypt this encrypted backup.".to_string())?;

            let salt_b64 = container
                .salt
                .as_ref()
                .ok_or_else(|| "Corrupted backup: salt missing".to_string())?;
            let salt = BASE64_STANDARD
                .decode(salt_b64)
                .map_err(|e| format!("Invalid salt encoding: {}", e))?;

            let mut k = [0u8; 32];
            pbkdf2_hmac::<Sha256>(pwd.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut k);
            k
        };

        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let decrypted = cipher
            .decrypt(&nonce, ciphertext.as_slice())
            .map_err(|_| {
                if is_device_key {
                    "Decryption failed: This backup was encrypted using the device key of a different computer. To restore backups across different machines, please create a password-protected backup.".to_string()
                } else {
                    "Decryption failed: Incorrect backup password or damaged archive.".to_string()
                }
            })?;

        let json_str = String::from_utf8(decrypted)
            .map_err(|e| format!("UTF-8 decode error in decrypted payload: {}", e))?;

        serde_json::from_str::<BackupPayload>(&json_str)
            .map_err(|e| format!("Invalid backup payload structure: {}", e))
    }

    pub fn preview(
        container: &BackupContainer,
        vault: &SecureVault,
        password: Option<&str>,
    ) -> Result<BackupPreview, String> {
        let is_password_protected = container.encryption_type == "password"
            || (container.is_encrypted && container.salt.is_some());

        if is_password_protected && password.filter(|p| !p.trim().is_empty()).is_none() {
            // Return locked preview indicating it is password encrypted
            return Ok(BackupPreview {
                app: container.app.clone(),
                version: container.version,
                created_at: container.created_at.clone(),
                is_encrypted: true,
                encryption_type: container.encryption_type.clone(),
                host_count: 0,
                group_count: 0,
                key_count: 0,
                tunnel_count: 0,
                snippet_count: 0,
                workspace_count: 0,
                secret_count: 0,
            });
        }

        let payload = Self::decrypt_and_extract_payload(container, vault, password)?;
        Ok(BackupPreview {
            app: payload.app,
            version: payload.version,
            created_at: payload.created_at,
            is_encrypted: container.is_encrypted,
            encryption_type: container.encryption_type.clone(),
            host_count: payload.hosts.len(),
            group_count: payload.host_groups.len(),
            key_count: payload.ssh_keys.len(),
            tunnel_count: payload.tunnels.len(),
            snippet_count: payload.snippets.len(),
            workspace_count: payload.workspaces.len(),
            secret_count: payload.secrets.len(),
        })
    }

    pub fn restore(
        db: &Database,
        vault: &SecureVault,
        container: &BackupContainer,
        password: Option<&str>,
        options: &RestoreOptions,
    ) -> Result<BackupPreview, String> {
        let payload = Self::decrypt_and_extract_payload(container, vault, password)?;

        if options.mode == "replace" {
            db.clear_all_data().map_err(|e| e.to_string())?;
            vault.clear().map_err(|e| e.to_string())?;
        }

        // 1. Host Groups
        for group in &payload.host_groups {
            let _ = db.save_group(group);
        }

        // 2. Hosts
        if options.include_hosts {
            for host in &payload.hosts {
                let _ = db.save_host(host);
            }
        }

        // 3. SSH Keys
        if options.include_keys {
            for key in &payload.ssh_keys {
                let _ = db.save_ssh_key(key);
            }
        }

        // 4. Tunnels
        if options.include_tunnels {
            for tunnel in &payload.tunnels {
                let _ = db.save_tunnel(tunnel);
            }
        }

        // 5. Snippets
        if options.include_snippets {
            for snip in &payload.snippets {
                let _ = db.save_snippet(snip);
            }
        }

        // 6. Workspaces
        if options.include_workspaces {
            for ws in &payload.workspaces {
                let _ = db.save_workspace(ws);
            }
        }

        // 7. Settings
        if options.include_settings {
            if let Some(ref sett) = payload.app_settings {
                let _ = db.save_settings(sett);
            }
        }

        // 8. Vault Secrets (Passwords, private keys, passphrases)
        for (secret_id, plaintext) in &payload.secrets {
            let _ = vault.store(secret_id, plaintext);
        }

        Ok(BackupPreview {
            app: payload.app,
            version: payload.version,
            created_at: payload.created_at,
            is_encrypted: container.is_encrypted,
            encryption_type: container.encryption_type.clone(),
            host_count: payload.hosts.len(),
            group_count: payload.host_groups.len(),
            key_count: payload.ssh_keys.len(),
            tunnel_count: payload.tunnels.len(),
            snippet_count: payload.snippets.len(),
            workspace_count: payload.workspaces.len(),
            secret_count: payload.secrets.len(),
        })
    }

    pub fn save_to_file(path: &str, content: &str) -> Result<String, String> {
        let p = std::path::Path::new(path);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(p, content).map_err(|e| format!("Failed to write backup file: {}", e))?;
        Ok(path.to_string())
    }

    pub fn read_from_file(path: &str) -> Result<String, String> {
        fs::read_to_string(path).map_err(|e| format!("Failed to read backup file at '{}': {}", path, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_env() -> (Database, SecureVault, std::path::PathBuf) {
        let test_dir = std::env::temp_dir().join(format!("termish_test_backup_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&test_dir).unwrap();
        let db = Database::new(test_dir.join("test.db"));
        let vault = SecureVault::new(test_dir.clone());
        (db, vault, test_dir)
    }

    #[test]
    fn test_device_key_backup_and_restore_always_encrypted() {
        let (db, vault, test_dir) = setup_test_env();

        vault.store("test-secret", "hunter2").unwrap();

        // Backup without password must STILL be encrypted with device key!
        let container = BackupManager::create_backup(&db, &vault, None).unwrap();
        assert!(container.is_encrypted, "Backup must always be encrypted");
        assert_eq!(container.encryption_type, "device_key");
        assert!(container.payload.is_none(), "Raw payload must never be stored in plaintext");
        assert!(container.ciphertext.is_some(), "Ciphertext must be present");

        // Preview should automatically decrypt with device key
        let preview = BackupManager::preview(&container, &vault, None).unwrap();
        assert_eq!(preview.secret_count, 1);
        assert_eq!(preview.group_count, 3); // 3 seeded groups

        let options = RestoreOptions::default();
        let restored = BackupManager::restore(&db, &vault, &container, None, &options).unwrap();
        assert_eq!(restored.secret_count, 1);

        let retrieved_secret = vault.get("test-secret").unwrap();
        assert_eq!(retrieved_secret, Some("hunter2".to_string()));

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_password_encrypted_backup_validation() {
        let (db, vault, test_dir) = setup_test_env();

        vault.store("root-pass", "secret-key-material").unwrap();

        let password = "UltraSecureMatrixPassword2026!";
        let container = BackupManager::create_backup(&db, &vault, Some(password)).unwrap();
        assert!(container.is_encrypted);
        assert_eq!(container.encryption_type, "password");
        assert!(container.payload.is_none());
        assert!(container.ciphertext.is_some());
        assert!(container.salt.is_some());

        // Preview with wrong password should fail
        let wrong_preview = BackupManager::preview(&container, &vault, Some("wrongpass"));
        assert!(wrong_preview.is_err());

        // Preview without password should return locked preview
        let locked_preview = BackupManager::preview(&container, &vault, None).unwrap();
        assert!(locked_preview.is_encrypted);
        assert_eq!(locked_preview.secret_count, 0);

        // Preview with correct password should succeed
        let valid_preview = BackupManager::preview(&container, &vault, Some(password)).unwrap();
        assert_eq!(valid_preview.secret_count, 1);

        // Test restore
        let options = RestoreOptions::default();
        let restored = BackupManager::restore(&db, &vault, &container, Some(password), &options).unwrap();
        assert_eq!(restored.secret_count, 1);

        let _ = fs::remove_dir_all(&test_dir);
    }
}
