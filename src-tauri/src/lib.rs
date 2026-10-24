pub mod backup;
pub mod commands;
pub mod db;
pub mod keys;
pub mod local_engine;
pub mod models;
pub mod serial_engine;
pub mod ssh_engine;
pub mod telnet_engine;
pub mod tunnel;
pub mod vault;

use commands::AppState;
use db::Database;
use keys::KeyManager;
use local_engine::LocalEngine;
use serial_engine::SerialEngine;
use ssh_engine::SSHEngine;
use std::sync::Arc;
use telnet_engine::TelnetEngine;
use tunnel::TunnelEngine;
use vault::SecureVault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/home/alish/.local/share"))
        .join("termissh");

    let db = Arc::new(Database::new(data_dir.clone()));
    let vault = Arc::new(SecureVault::new(data_dir.clone()));
    let keys = Arc::new(KeyManager::new(db.clone(), vault.clone()));
    let ssh = Arc::new(SSHEngine::new(db.clone(), vault.clone()));
    let telnet = Arc::new(TelnetEngine::new(db.clone()));
    let local = Arc::new(LocalEngine::new());
    let serial = Arc::new(SerialEngine::new(db.clone()));
    let tunnels = Arc::new(TunnelEngine::new(db.clone(), ssh.clone()));

    let app_state = AppState {
        db,
        vault,
        keys,
        ssh,
        telnet,
        local,
        serial,
        tunnels,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Hosts
            commands::get_hosts,
            commands::save_host,
            commands::delete_host,
            commands::import_openssh_config,
            commands::get_ssh_config,
            commands::save_ssh_config,
            commands::format_hosts_as_ssh_config,
            // Groups
            commands::get_groups,
            commands::save_group,
            commands::delete_group,
            // Interactive SSH & Terminal
            commands::start_ssh_session,
            commands::open_local_session,
            commands::send_terminal_data,
            commands::resize_terminal,
            commands::close_ssh_session,
            // Host Key Verification
            commands::resolve_host_key,
            // SSH Keys
            commands::get_ssh_keys,
            commands::generate_ssh_key,
            commands::import_ssh_key,
            commands::get_private_key,
            commands::delete_ssh_key,
            // SFTP
            commands::sftp_list,
            commands::sftp_read_file,
            commands::sftp_write_file,
            commands::sftp_delete,
            commands::sftp_mkdir,
            commands::sftp_upload,
            commands::sftp_download,
            // Local Filesystem
            commands::local_list,
            commands::get_home_dir,
            // Tunnels
            commands::get_tunnels,
            commands::save_tunnel,
            commands::delete_tunnel,
            commands::start_tunnel,
            commands::stop_tunnel,
            // Snippets
            commands::get_snippets,
            commands::save_snippet,
            commands::delete_snippet,
            // Workspaces
            commands::get_workspaces,
            commands::save_workspace,
            commands::delete_workspace,
            // History
            commands::get_history,
            commands::clear_history,
            // Settings
            commands::get_settings,
            commands::save_settings,
            // Backup & Restore
            commands::export_backup_data,
            commands::save_backup_file,
            commands::read_backup_file,
            commands::preview_backup_data,
            commands::restore_backup_data,
            // Serial Ports
            commands::list_serial_ports,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
