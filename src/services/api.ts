import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  HostConfig,
  HostGroup,
  SSHKeyItem,
  SSHTunnel,
  CommandSnippet,
  WorkspaceItem,
  ConnectionHistoryEntry,
  FileEntry,
  AppSettings,
  HostKeyPromptData,
  SSHConfigFileInfo,
  BackupPreview,
  RestoreOptions,
  SerialPortInfo,
} from '../types';

// Check if running in Tauri
export const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

export const api = {
  // Hosts
  async getHosts(): Promise<HostConfig[]> {
    return invoke('get_hosts');
  },
  async saveHost(host: Partial<HostConfig>): Promise<HostConfig> {
    return invoke('save_host', { host: { ...host, id: host.id || '' } });
  },
  async deleteHost(id: string): Promise<void> {
    return invoke('delete_host', { id });
  },
  async importOpenSSHConfig(content: string): Promise<HostConfig[]> {
    return invoke('import_openssh_config', { content });
  },
  async getSSHConfig(): Promise<SSHConfigFileInfo> {
    return invoke('get_ssh_config');
  },
  async saveSSHConfig(content: string, createBackup: boolean = true): Promise<string> {
    return invoke('save_ssh_config', { content, createBackup });
  },
  async formatHostsAsSSHConfig(hostIds: string[] = []): Promise<string> {
    return invoke('format_hosts_as_ssh_config', { hostIds });
  },

  // Groups
  async getGroups(): Promise<HostGroup[]> {
    return invoke('get_groups');
  },
  async saveGroup(group: Partial<HostGroup>): Promise<HostGroup> {
    return invoke('save_group', { group: { ...group, id: group.id || '' } });
  },
  async deleteGroup(id: string): Promise<void> {
    return invoke('delete_group', { id });
  },

  // SSH Interactive Sessions
  async startSSHSession(
    hostId: string,
    cols: number,
    rows: number,
    overridePassword?: string,
    overridePassphrase?: string
  ): Promise<{ sessionId: string }> {
    return invoke('start_ssh_session', {
      hostId,
      cols,
      rows,
      overridePassword,
      overridePassphrase,
    });
  },
  async openLocalSession(cols: number = 80, rows: number = 24): Promise<{ sessionId: string }> {
    return invoke('open_local_session', { cols, rows });
  },
  async sendTerminalData(sessionId: string, data: string): Promise<void> {
    return invoke('send_terminal_data', { sessionId, data });
  },
  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke('resize_terminal', { sessionId, cols, rows });
  },
  async closeSSHSession(sessionId: string): Promise<void> {
    return invoke('close_ssh_session', { sessionId });
  },

  // Host Key Verification
  async resolveHostKey(
    host: string,
    port: number,
    fingerprint: string,
    accept: boolean
  ): Promise<void> {
    return invoke('resolve_host_key', { host, port, fingerprint, accept });
  },

  // SSH Keys
  async getSSHKeys(): Promise<SSHKeyItem[]> {
    return invoke('get_ssh_keys');
  },
  async generateSSHKey(
    name: string,
    keyType: 'ed25519' | 'rsa' | 'ecdsa',
    passphrase?: string,
    bits?: number
  ): Promise<SSHKeyItem> {
    return invoke('generate_ssh_key', { name, keyType, passphrase, bits });
  },
  async importSSHKey(
    name: string,
    privateKeyContent: string,
    passphrase?: string
  ): Promise<SSHKeyItem> {
    return invoke('import_ssh_key', { name, privateKeyContent, passphrase });
  },
  async getPrivateKey(keyId: string, passphrase?: string): Promise<string> {
    return invoke('get_private_key', { keyId, passphrase });
  },
  async deleteSSHKey(id: string): Promise<void> {
    return invoke('delete_ssh_key', { id });
  },

  // SFTP Operations
  async sftpList(hostId: string, remotePath: string): Promise<FileEntry[]> {
    return invoke('sftp_list', { hostId, remotePath });
  },
  async sftpReadFile(hostId: string, remotePath: string): Promise<string> {
    return invoke('sftp_read_file', { hostId, remotePath });
  },
  async sftpWriteFile(hostId: string, remotePath: string, content: string): Promise<void> {
    return invoke('sftp_write_file', { hostId, remotePath, content });
  },
  async sftpDelete(hostId: string, remotePath: string, isDir: boolean): Promise<void> {
    return invoke('sftp_delete', { hostId, remotePath, isDir });
  },
  async sftpMkdir(hostId: string, remotePath: string): Promise<void> {
    return invoke('sftp_mkdir', { hostId, remotePath });
  },
  async sftpUpload(hostId: string, localPath: string, remotePath: string): Promise<void> {
    return invoke('sftp_upload', { hostId, localPath, remotePath });
  },
  async sftpDownload(hostId: string, remotePath: string, localPath: string): Promise<void> {
    return invoke('sftp_download', { hostId, remotePath, localPath });
  },

  // Local Filesystem
  async localList(localPath: string): Promise<FileEntry[]> {
    return invoke('local_list', { localPath });
  },
  async getHomeDir(): Promise<string> {
    return invoke('get_home_dir');
  },

  // Port Forwarding / Tunnels
  async getTunnels(): Promise<SSHTunnel[]> {
    return invoke('get_tunnels');
  },
  async saveTunnel(tunnel: Partial<SSHTunnel>): Promise<SSHTunnel> {
    return invoke('save_tunnel', { tunnel: { ...tunnel, id: tunnel.id || '' } });
  },
  async deleteTunnel(id: string): Promise<void> {
    return invoke('delete_tunnel', { id });
  },
  async startTunnel(id: string): Promise<void> {
    return invoke('start_tunnel', { id });
  },
  async stopTunnel(id: string): Promise<void> {
    return invoke('stop_tunnel', { id });
  },

  // Snippets
  async getSnippets(): Promise<CommandSnippet[]> {
    return invoke('get_snippets');
  },
  async saveSnippet(snippet: Partial<CommandSnippet>): Promise<CommandSnippet> {
    return invoke('save_snippet', { snippet: { ...snippet, id: snippet.id || '' } });
  },
  async deleteSnippet(id: string): Promise<void> {
    return invoke('delete_snippet', { id });
  },

  // Workspaces
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    return invoke('get_workspaces');
  },
  async saveWorkspace(workspace: Partial<WorkspaceItem>): Promise<WorkspaceItem> {
    return invoke('save_workspace', { workspace: { ...workspace, id: workspace.id || '' } });
  },
  async deleteWorkspace(id: string): Promise<void> {
    return invoke('delete_workspace', { id });
  },

  // History
  async getHistory(): Promise<ConnectionHistoryEntry[]> {
    return invoke('get_history');
  },
  async clearHistory(): Promise<void> {
    return invoke('clear_history');
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    return invoke('get_settings');
  },
  async saveSettings(settings: AppSettings): Promise<void> {
    return invoke('save_settings', { settings });
  },

  // Backup & Restore
  async exportBackup(password?: string): Promise<string> {
    return invoke('export_backup_data', { password: password || null });
  },
  async saveBackupFile(path: string, password?: string): Promise<string> {
    return invoke('save_backup_file', { path, password: password || null });
  },
  async readBackupFile(path: string): Promise<string> {
    return invoke('read_backup_file', { path });
  },
  async previewBackup(backupJson: string, password?: string): Promise<BackupPreview> {
    return invoke('preview_backup_data', { backupJson, password: password || null });
  },
  async restoreBackup(backupJson: string, options: RestoreOptions, password?: string): Promise<BackupPreview> {
    return invoke('restore_backup_data', { backupJson, options, password: password || null });
  },

  // Serial Console
  async listSerialPorts(): Promise<SerialPortInfo[]> {
    return invoke('list_serial_ports');
  },

  // Event Subscriptions
  onTerminalData(sessionId: string, cb: (data: string) => void): Promise<UnlistenFn> {
    return listen<string>(`term-data-${sessionId}`, (event) => cb(event.payload));
  },
  onTerminalExit(sessionId: string, cb: (code: number) => void): Promise<UnlistenFn> {
    return listen<number>(`term-exit-${sessionId}`, (event) => cb(event.payload));
  },
  onHostKeyPrompt(cb: (prompt: HostKeyPromptData) => void): Promise<UnlistenFn> {
    return listen<HostKeyPromptData>('host-key-prompt', (event) => cb(event.payload));
  },
  onTunnelStatus(cb: (data: { tunnelId: string; status: string; error?: string }) => void): Promise<UnlistenFn> {
    return listen<{ tunnelId: string; status: string; error?: string }>('tunnel-status', (event) => cb(event.payload));
  },
};
