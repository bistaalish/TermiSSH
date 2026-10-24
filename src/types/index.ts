export type AuthType = 'password' | 'private_key' | 'agent' | 'none';
export type NetworkProtocol = 'ssh' | 'telnet' | 'serial';

export interface HostConfig {
  id: string;
  name: string;
  description?: string;
  hostname: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  keyId?: string;
  keyPassphrase?: string;
  groupId?: string;
  tags?: string[];
  timeoutSeconds?: number;
  keepaliveInterval?: number;
  jumpHostId?: string;
  proxyCommand?: string;
  identityFile?: string;
  terminalTheme?: string;
  fontSize?: number;
  protocol?: NetworkProtocol;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware' | 'software';
  createdAt?: string;
  updatedAt?: string;
}

export interface SerialPortInfo {
  path: string;
  description?: string;
}

export interface HostGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export type KeyAlgorithm = 'ed25519' | 'rsa' | 'ecdsa';

export interface SSHKeyItem {
  id: string;
  name: string;
  keyType: KeyAlgorithm;
  publicKey: string;
  fingerprintSha256: string;
  hasPassphrase: boolean;
  createdAt: string;
}

export type TunnelType = 'local' | 'remote' | 'dynamic';
export type TunnelStatus = 'inactive' | 'starting' | 'active' | 'error';

export interface SSHTunnel {
  id: string;
  hostId: string;
  name: string;
  tunnelType: TunnelType;
  localHost: string;
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  status: TunnelStatus;
  errorMessage?: string;
}

export interface CommandSnippet {
  id: string;
  title: string;
  description?: string;
  command: string;
  category: string;
  tags: string[];
}

export interface WorkspaceItem {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production' | 'general';
  layout: 'single' | 'split-vertical' | 'split-horizontal' | 'grid';
  panes: { hostId: string; title?: string }[];
}

export interface ConnectionHistoryEntry {
  id: string;
  hostId: string;
  hostName: string;
  connectedAt: string;
  disconnectedAt?: string;
  status: 'connected' | 'disconnected' | 'failed';
  errorMessage?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  permissions: string;
  modified: number;
}

export type SessionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TerminalTab {
  id: string;
  hostId: string;
  title: string;
  status: SessionState;
  error?: string;
  sessionId?: string;
  isLocal?: boolean;
  protocol?: NetworkProtocol;
  baudRate?: number;
}

export interface HostKeyPromptData {
  host: string;
  port: number;
  keyType: string;
  fingerprint: string;
  isMismatch: boolean;
  oldFingerprint?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'amoled';
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollbackLines: number;
  copyOnSelect: boolean;
  keepaliveIntervalDefault: number;
  defaultTimeoutSeconds: number;
  confirmBeforeClosingActiveTab: boolean;
  soundBell: boolean;
}

export interface SSHConfigFileInfo {
  path: string;
  content: string;
  exists: boolean;
  permissions?: string;
  modifiedAt?: string;
  backupPath?: string;
}

export interface BackupPreview {
  app: string;
  version: number;
  created_at: string;
  is_encrypted: boolean;
  encryption_type: string;
  host_count: number;
  group_count: number;
  key_count: number;
  tunnel_count: number;
  snippet_count: number;
  workspace_count: number;
  secret_count: number;
}

export interface RestoreOptions {
  mode: 'merge' | 'replace';
  include_hosts: boolean;
  include_keys: boolean;
  include_tunnels: boolean;
  include_snippets: boolean;
  include_workspaces: boolean;
  include_settings: boolean;
}
