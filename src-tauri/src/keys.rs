use crate::db::Database;
use crate::models::SSHKeyItem;
use crate::vault::SecureVault;
use russh::keys::ssh_key::LineEnding;
use russh::keys::{Algorithm, EcdsaCurve, HashAlg, PrivateKey};
use std::sync::Arc;
use uuid::Uuid;

pub struct KeyManager {
    db: Arc<Database>,
    vault: Arc<SecureVault>,
}

impl KeyManager {
    pub fn new(db: Arc<Database>, vault: Arc<SecureVault>) -> Self {
        Self { db, vault }
    }

    pub fn generate_key(
        &self,
        name: &str,
        key_type: &str,
        passphrase: Option<&str>,
        _bits: Option<u32>,
    ) -> Result<SSHKeyItem, String> {
        let mut rng = rand::rng();

        let private_key = match key_type.to_lowercase().as_str() {
            "ed25519" => {
                PrivateKey::random(&mut rng, Algorithm::Ed25519)
                    .map_err(|e| format!("Ed25519 generation failed: {}", e))?
            }
            "rsa" => {
                PrivateKey::random(&mut rng, Algorithm::Rsa { hash: None })
                    .map_err(|e| format!("RSA generation failed: {}", e))?
            }
            "ecdsa" => {
                PrivateKey::random(&mut rng, Algorithm::Ecdsa { curve: EcdsaCurve::NistP256 })
                    .map_err(|e| format!("ECDSA generation failed: {}", e))?
            }
            _ => return Err(format!("Unsupported key algorithm: {}", key_type)),
        };

        // Encrypt with passphrase if specified
        let final_key = if let Some(pass) = passphrase {
            if !pass.is_empty() {
                private_key
                    .encrypt(&mut rng, pass)
                    .map_err(|e| format!("Passphrase encryption failed: {}", e))?
            } else {
                private_key
            }
        } else {
            private_key
        };

        let pub_key = final_key.public_key();
        let openssh_pub = pub_key
            .to_openssh()
            .map_err(|e| format!("Failed to format public key: {}", e))?;
        let fingerprint = pub_key.fingerprint(HashAlg::Sha256).to_string();

        let openssh_priv = final_key
            .to_openssh(LineEnding::LF)
            .map_err(|e| format!("Failed to export private key: {}", e))?;

        let id = format!("key-{}", Uuid::new_v4());
        let secret_id = format!("vault://{}", id);

        // Store private key securely in vault
        self.vault
            .store(&secret_id, openssh_priv.as_str())
            .map_err(|e| format!("Failed to store key in vault: {}", e))?;

        let item = SSHKeyItem {
            id,
            name: name.to_string(),
            key_type: key_type.to_lowercase(),
            public_key: openssh_pub,
            fingerprint_sha256: fingerprint,
            has_passphrase: passphrase.map_or(false, |p| !p.is_empty()),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        self.db
            .save_ssh_key(&item)
            .map_err(|e| format!("Database error: {}", e))?;

        Ok(item)
    }

    pub fn import_key(
        &self,
        name: &str,
        private_key_content: &str,
        passphrase: Option<&str>,
    ) -> Result<SSHKeyItem, String> {
        let mut key = PrivateKey::from_openssh(private_key_content)
            .map_err(|e| format!("Invalid OpenSSH private key format: {}", e))?;

        let has_passphrase = key.is_encrypted();

        if key.is_encrypted() {
            if let Some(pass) = passphrase {
                key = key
                    .decrypt(pass)
                    .map_err(|e| format!("Failed to decrypt private key with passphrase: {}", e))?;
            } else {
                return Err("Private key is encrypted. Passphrase is required to import.".to_string());
            }
        }

        let pub_key = key.public_key();
        let openssh_pub = pub_key
            .to_openssh()
            .map_err(|e| format!("Public key extraction error: {}", e))?;
        let fingerprint = pub_key.fingerprint(HashAlg::Sha256).to_string();

        let key_type = match pub_key.algorithm() {
            Algorithm::Ed25519 => "ed25519",
            Algorithm::Rsa { .. } => "rsa",
            Algorithm::Ecdsa { .. } => "ecdsa",
            _ => "unknown",
        };

        let id = format!("key-{}", Uuid::new_v4());
        let secret_id = format!("vault://{}", id);

        self.vault
            .store(&secret_id, private_key_content)
            .map_err(|e| format!("Vault storage error: {}", e))?;

        let item = SSHKeyItem {
            id,
            name: name.to_string(),
            key_type: key_type.to_string(),
            public_key: openssh_pub,
            fingerprint_sha256: fingerprint,
            has_passphrase,
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        self.db
            .save_ssh_key(&item)
            .map_err(|e| format!("Database error: {}", e))?;

        Ok(item)
    }

    pub fn get_private_key(&self, key_id: &str, passphrase: Option<&str>) -> Result<String, String> {
        let secret_id = format!("vault://{}", key_id);
        let raw_key = self
            .vault
            .get(&secret_id)?
            .ok_or_else(|| "Private key secret not found in vault".to_string())?;

        let mut key = PrivateKey::from_openssh(&raw_key)
            .map_err(|e| format!("Private key parse error: {}", e))?;

        if key.is_encrypted() {
            if let Some(pass) = passphrase {
                key = key
                    .decrypt(pass)
                    .map_err(|e| format!("Passphrase decryption failed: {}", e))?;
                let plain_openssh = key
                    .to_openssh(LineEnding::LF)
                    .map_err(|e| format!("Export error: {}", e))?;
                Ok(plain_openssh.as_str().to_string())
            } else {
                Err("Key is encrypted. Please provide passphrase to export.".to_string())
            }
        } else {
            Ok(raw_key)
        }
    }

    pub fn delete_key(&self, id: &str) -> Result<(), String> {
        let secret_id = format!("vault://{}", id);
        self.vault.delete(&secret_id).ok();
        self.db.delete_ssh_key(id).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_manager() -> (KeyManager, std::path::PathBuf) {
        let test_dir = std::env::temp_dir().join(format!("termish_test_keys_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&test_dir).unwrap();
        let db = Arc::new(Database::new(test_dir.join("test.db")));
        let vault = Arc::new(SecureVault::new(test_dir.clone()));
        let km = KeyManager::new(db, vault);
        (km, test_dir)
    }

    #[test]
    fn test_ed25519_key_generation() {
        let (km, test_dir) = setup_test_manager();
        let key_item = km.generate_key("my-ed25519", "ed25519", None, None).expect("Key gen failed");
        assert_eq!(key_item.key_type, "ed25519");
        assert!(key_item.fingerprint_sha256.starts_with("SHA256:"));
        assert!(key_item.public_key.starts_with("ssh-ed25519 "));

        let priv_key = km.get_private_key(&key_item.id, None).expect("Retrieve failed");
        assert!(priv_key.contains("BEGIN OPENSSH PRIVATE KEY"));

        let _ = std::fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_passphrase_protected_key() {
        let (km, test_dir) = setup_test_manager();
        let passphrase = "SecretPassphrase123!";
        let key_item = km
            .generate_key("my-pass-key", "ed25519", Some(passphrase), None)
            .expect("Passphrase key gen failed");

        assert!(key_item.has_passphrase);

        // Attempt retrieval without passphrase should fail
        let fail_res = km.get_private_key(&key_item.id, None);
        assert!(fail_res.is_err());

        // Attempt retrieval with wrong passphrase should fail
        let wrong_res = km.get_private_key(&key_item.id, Some("wrongpassword"));
        assert!(wrong_res.is_err());

        // Attempt retrieval with correct passphrase succeeds
        let success_res = km.get_private_key(&key_item.id, Some(passphrase));
        assert!(success_res.is_ok());

        let _ = std::fs::remove_dir_all(test_dir);
    }

    #[test]
    fn test_rsa_key_generation() {
        let (km, test_dir) = setup_test_manager();
        let key_item = km.generate_key("my-rsa", "rsa", None, None).expect("RSA gen failed");
        assert_eq!(key_item.key_type, "rsa");
        assert!(key_item.fingerprint_sha256.starts_with("SHA256:"));
        assert!(key_item.public_key.starts_with("ssh-rsa "));

        let _ = std::fs::remove_dir_all(test_dir);
    }
}
