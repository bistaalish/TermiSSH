use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct SecureVault {
    storage_path: PathBuf,
    master_key: [u8; 32],
    cache: Mutex<HashMap<String, String>>,
}

impl SecureVault {
    pub fn new(data_dir: PathBuf) -> Self {
        fs::create_dir_all(&data_dir).ok();
        let storage_path = data_dir.join("vault.enc");

        // Derive deterministic machine key based on machine-id and user
        let machine_id = fs::read_to_string("/etc/machine-id")
            .unwrap_or_else(|_| "termissh-default-machine-seed-uuid".to_string());
        let username = std::env::var("USER").unwrap_or_else(|_| "default".to_string());
        let salt = format!("termissh-linux-vault-salt-{}-{}", username, machine_id.trim());

        let mut master_key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(
            machine_id.as_bytes(),
            salt.as_bytes(),
            100_000,
            &mut master_key,
        );

        let vault = Self {
            storage_path,
            master_key,
            cache: Mutex::new(HashMap::new()),
        };

        // Load existing vault items into cache if present
        vault.load_from_disk();
        vault
    }

    fn load_from_disk(&self) {
        if !self.storage_path.exists() {
            return;
        }

        if let Ok(encrypted_bytes) = fs::read(&self.storage_path) {
            if encrypted_bytes.len() < 12 {
                return;
            }

            let (nonce_bytes, ciphertext) = encrypted_bytes.split_at(12);
            let cipher = match Aes256Gcm::new_from_slice(&self.master_key) {
                Ok(c) => c,
                Err(_) => return,
            };
            let nonce = match Nonce::try_from(nonce_bytes) {
                Ok(n) => n,
                Err(_) => return,
            };

            if let Ok(decrypted) = cipher.decrypt(&nonce, ciphertext) {
                if let Ok(json_str) = String::from_utf8(decrypted) {
                    if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&json_str) {
                        if let Ok(mut cache) = self.cache.lock() {
                            *cache = map;
                        }
                    }
                }
            }
        }
    }

    fn save_to_disk(&self) -> Result<(), String> {
        let cache = self.cache.lock().map_err(|e| e.to_string())?;
        let json_str = serde_json::to_string(&*cache).map_err(|e| e.to_string())?;

        let cipher = Aes256Gcm::new_from_slice(&self.master_key).map_err(|e| e.to_string())?;
        use rand::RngExt;
        let mut nonce_bytes = [0u8; 12];
        rand::rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        let ciphertext = cipher
            .encrypt(&nonce, json_str.as_bytes())
            .map_err(|e| format!("Encryption error: {:?}", e))?;

        let mut final_payload = Vec::with_capacity(12 + ciphertext.len());
        final_payload.extend_from_slice(&nonce_bytes);
        final_payload.extend_from_slice(&ciphertext);

        fs::write(&self.storage_path, final_payload).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn store(&self, secret_id: &str, plaintext: &str) -> Result<(), String> {
        {
            let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
            cache.insert(secret_id.to_string(), plaintext.to_string());
        }
        self.save_to_disk()
    }

    pub fn get(&self, secret_id: &str) -> Result<Option<String>, String> {
        let cache = self.cache.lock().map_err(|e| e.to_string())?;
        Ok(cache.get(secret_id).cloned())
    }

    pub fn delete(&self, secret_id: &str) -> Result<(), String> {
        {
            let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
            cache.remove(secret_id);
        }
        self.save_to_disk()
    }

    pub fn get_all(&self) -> Result<HashMap<String, String>, String> {
        let cache = self.cache.lock().map_err(|e| e.to_string())?;
        Ok(cache.clone())
    }

    pub fn clear(&self) -> Result<(), String> {
        {
            let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
            cache.clear();
        }
        self.save_to_disk()
    }

    pub fn get_master_key(&self) -> [u8; 32] {
        self.master_key
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_roundtrip() {
        let test_dir = std::env::temp_dir().join(format!("termish_test_vault_{}", uuid::Uuid::new_v4()));
        let vault = SecureVault::new(test_dir.clone());

        let secret_id = "test-secret-id";
        let secret_val = "SuperSecretPassword123!@#";

        vault.store(secret_id, secret_val).expect("Store failed");
        let retrieved = vault.get(secret_id).expect("Get failed");
        assert_eq!(retrieved, Some(secret_val.to_string()));

        // Reload vault from disk to ensure persistence and AES-GCM decryption
        let reloaded_vault = SecureVault::new(test_dir.clone());
        let reloaded_val = reloaded_vault.get(secret_id).expect("Reloaded get failed");
        assert_eq!(reloaded_val, Some(secret_val.to_string()));

        // Verify deletion
        vault.delete(secret_id).expect("Delete failed");
        let after_delete = vault.get(secret_id).expect("Get after delete failed");
        assert_eq!(after_delete, None);

        // Cleanup
        let _ = std::fs::remove_dir_all(&test_dir);
    }
}
