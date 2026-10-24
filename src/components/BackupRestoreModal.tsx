import React, { useState, useRef } from 'react';
import {
  X,
  Database,
  Download,
  Upload,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Server,
  FolderTree,
  KeyRound,
  Network,
  Code,
  LayoutGrid,
  Eye,
  EyeOff,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { api } from '../services/api';
import type { BackupPreview, RestoreOptions, HostConfig, HostGroup, SSHKeyItem, SSHTunnel, CommandSnippet, WorkspaceItem } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  hosts: HostConfig[];
  groups: HostGroup[];
  keys: SSHKeyItem[];
  tunnels: SSHTunnel[];
  snippets: CommandSnippet[];
  workspaces: WorkspaceItem[];
  onRestored: () => Promise<void>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  hosts,
  groups,
  keys,
  tunnels,
  snippets,
  workspaces,
  onRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>('backup');

  // Backup State
  const [encryptionMode, setEncryptionMode] = useState<'password' | 'device'>('password');
  const [backupPassword, setBackupPassword] = useState('');
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [customSavePath, setCustomSavePath] = useState(
    `/home/alish/termissh_backup_${new Date().toISOString().slice(0, 10)}.json`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

  // Restore State
  const [restoreMethod, setRestoreMethod] = useState<'upload' | 'path' | 'paste'>('upload');
  const [restorePath, setRestorePath] = useState('');
  const [rawBackupJson, setRawBackupJson] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [loadedJson, setLoadedJson] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(null);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);

  // Restore Options
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [includeHosts, setIncludeHosts] = useState(true);
  const [includeKeys, setIncludeKeys] = useState(true);
  const [includeTunnels, setIncludeTunnels] = useState(true);
  const [includeSnippets, setIncludeSnippets] = useState(true);
  const [includeWorkspaces, setIncludeWorkspaces] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Download Backup
  const handleDownloadBackup = async () => {
    setIsExporting(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);
    try {
      const pwd = encryptionMode === 'password' ? backupPassword.trim() : undefined;
      if (encryptionMode === 'password' && !pwd) {
        throw new Error('Please choose a password for this encrypted backup archive.');
      }

      const jsonStr = await api.exportBackup(pwd);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `termissh_backup_${timestamp}.json`;

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const sizeKb = (jsonStr.length / 1024).toFixed(1);
      setBackupSuccessMessage(
        `✓ Encrypted backup generated & downloaded as "${filename}" (${sizeKb} KB). Protected with AES-256-GCM (${
          encryptionMode === 'password' ? 'Password-Derived PBKDF2' : 'Local Device Hardware Key'
        }). All hostnames, usernames, passwords, and private keys are 100% encrypted.`
      );
    } catch (err: any) {
      console.error('Export failed:', err);
      setBackupErrorMessage(err?.toString() || 'Failed to generate backup archive');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Save Backup to Disk
  const handleSaveBackupToPath = async () => {
    if (!customSavePath.trim()) return;
    setIsExporting(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);
    try {
      const pwd = encryptionMode === 'password' ? backupPassword.trim() : undefined;
      if (encryptionMode === 'password' && !pwd) {
        throw new Error('Please choose a password for this encrypted backup archive.');
      }

      const savedPath = await api.saveBackupFile(customSavePath.trim(), pwd);
      setBackupSuccessMessage(`✓ Encrypted backup successfully saved to: ${savedPath} (AES-256-GCM)`);
    } catch (err: any) {
      console.error('Save to path failed:', err);
      setBackupErrorMessage(err?.toString() || 'Failed to write backup to path');
    } finally {
      setIsExporting(false);
    }
  };

  // Inspect / Preview loaded backup string
  const inspectBackupString = async (content: string, passwordOverride?: string) => {
    setIsInspecting(true);
    setRestoreErrorMessage(null);
    setRestoreSuccessMessage(null);
    try {
      const pwd = passwordOverride !== undefined ? passwordOverride : restorePassword;
      const prev = await api.previewBackup(content, pwd || undefined);
      setPreview(prev);
      setLoadedJson(content);
    } catch (err: any) {
      console.error('Inspection failed:', err);
      setRestoreErrorMessage(err?.toString() || 'Failed to inspect backup file');
      setPreview(null);
    } finally {
      setIsInspecting(false);
    }
  };

  // Handle File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        inspectBackupString(text);
      }
    };
    reader.readAsText(file);
  };

  // Handle Local Path Read
  const handleReadFromPath = async () => {
    if (!restorePath.trim()) return;
    setIsInspecting(true);
    setRestoreErrorMessage(null);
    try {
      const content = await api.readBackupFile(restorePath.trim());
      await inspectBackupString(content);
    } catch (err: any) {
      setRestoreErrorMessage(err?.toString() || 'Failed to read file from path');
    } finally {
      setIsInspecting(false);
    }
  };

  // Handle Decrypt with provided password
  const handleDecryptAndInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadedJson) return;
    await inspectBackupString(loadedJson, restorePassword);
  };

  // Perform Restore Execution
  const handleExecuteRestore = async () => {
    if (!loadedJson) return;

    if (restoreMode === 'replace') {
      setConfirmReplaceOpen(true);
      return;
    }

    await performRestore();
  };

  const performRestore = async () => {
    setConfirmReplaceOpen(false);
    if (!loadedJson) return;

    setIsRestoring(true);
    setRestoreErrorMessage(null);
    setRestoreSuccessMessage(null);
    try {
      const options: RestoreOptions = {
        mode: restoreMode,
        include_hosts: includeHosts,
        include_keys: includeKeys,
        include_tunnels: includeTunnels,
        include_snippets: includeSnippets,
        include_workspaces: includeWorkspaces,
        include_settings: includeSettings,
      };

      const result = await api.restoreBackup(loadedJson, options, restorePassword || undefined);
      await onRestored();

      setRestoreSuccessMessage(
        `✓ Restore completed successfully! Imported ${result.host_count} hosts, ${result.key_count} SSH keys, ${result.tunnel_count} tunnels, and ${result.secret_count} credentials.`
      );
    } catch (err: any) {
      console.error('Restore failed:', err);
      setRestoreErrorMessage(err?.toString() || 'Restore execution failed');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a] shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-[#f4f4f5]">
                Backup &amp; Restore TermiSSH
              </h3>
              <p className="text-[11px] text-[#938a87] font-mono">
                Portably archive hosts, SSH keys, credentials, and tunnels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#605e5e] hover:text-[#f4f4f5] rounded cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#2a2a2a] bg-[#19191a] px-6 shrink-0">
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center space-x-2 ${
              activeTab === 'backup'
                ? 'border-[#f4f4f5] text-[#f4f4f5] bg-[#2a2a2a]/40'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            <Download size={14} />
            <span>Create Backup</span>
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`py-3 px-5 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center space-x-2 ${
              activeTab === 'restore'
                ? 'border-[#f4f4f5] text-[#f4f4f5] bg-[#2a2a2a]/40'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            <Upload size={14} />
            <span>Restore from File</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1 bg-[#0a0a0a]">
          {activeTab === 'backup' && (
            <div className="space-y-5">
              {/* Data Summary Grid */}
              <div className="bg-[#19191a] border border-[#2a2a2a] rounded-xl p-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#938a87] block mb-3">
                  Current Application Inventory:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <Server size={15} className="mx-auto text-[#f4f4f5] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{hosts.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Hosts</div>
                  </div>
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <FolderTree size={15} className="mx-auto text-[#938a87] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{groups.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Groups</div>
                  </div>
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <KeyRound size={15} className="mx-auto text-[#938a87] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{keys.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Keys</div>
                  </div>
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <Network size={15} className="mx-auto text-[#938a87] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{tunnels.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Tunnels</div>
                  </div>
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <Code size={15} className="mx-auto text-[#938a87] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{snippets.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Snippets</div>
                  </div>
                  <div className="p-2.5 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <LayoutGrid size={15} className="mx-auto text-[#938a87] mb-1" />
                    <div className="font-bold text-[#f4f4f5] text-sm">{workspaces.length}</div>
                    <div className="text-[10px] text-[#605e5e]">Spaces</div>
                  </div>
                </div>
              </div>

              {/* Encryption Settings (Mandatory AES-256-GCM) */}
              <div className="bg-[#19191a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck size={18} className="text-[#938a87]" />
                    <span className="font-bold text-[#f4f4f5]">
                      AES-256-GCM Archive Encryption (Always Active)
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#2a2a2a] border border-[#363636] text-[#938a87] font-mono">
                    Zero Plaintext
                  </span>
                </div>
                <p className="text-[11px] text-[#605e5e] leading-relaxed">
                  All backup archives are strictly encrypted. Hostnames, usernames, passwords, private keys, and snippets are never saved in plaintext on disk.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col transition-all ${
                      encryptionMode === 'password'
                        ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="encryption_mode"
                        checked={encryptionMode === 'password'}
                        onChange={() => setEncryptionMode('password')}
                        className="accent-[#938a87]"
                      />
                      <span className="font-bold text-xs">Password Protected (Portable)</span>
                    </div>
                    <span className="text-[10px] text-[#605e5e] mt-1 pl-5">
                      Recommended. Encrypts with a custom master password. Restores on any computer.
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col transition-all ${
                      encryptionMode === 'device'
                        ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5]'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="encryption_mode"
                        checked={encryptionMode === 'device'}
                        onChange={() => setEncryptionMode('device')}
                        className="accent-[#938a87]"
                      />
                      <span className="font-bold text-xs">Device Key (Automatic)</span>
                    </div>
                    <span className="text-[10px] text-[#605e5e] mt-1 pl-5">
                      Encrypted with this PC's hardware key. Restores seamlessly without needing a password.
                    </span>
                  </label>
                </div>

                {encryptionMode === 'password' && (
                  <div className="pt-2">
                    <label className="block text-[#938a87] font-semibold mb-1">
                      Choose Master Passphrase:
                    </label>
                    <div className="relative">
                      <input
                        type={showBackupPassword ? 'text' : 'password'}
                        placeholder="Choose a strong backup passphrase..."
                        value={backupPassword}
                        onChange={(e) => setBackupPassword(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBackupPassword(!showBackupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#605e5e] hover:text-[#938a87]"
                      >
                        {showBackupPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Download / Export Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isExporting}
                  className="w-full py-2.5 rounded-xl bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] font-semibold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  <span>Download Backup (.json file)</span>
                </button>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="text"
                    value={customSavePath}
                    onChange={(e) => setCustomSavePath(e.target.value)}
                    placeholder="Path to save backup on local system..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636] placeholder-[#605e5e]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBackupToPath}
                    disabled={isExporting}
                    className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    Save to Path
                  </button>
                </div>
              </div>

              {/* Feedback messages */}
              {backupSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-[#2a2a2a] border border-[#363636] text-[#f4f4f5] flex items-start space-x-2">
                  <CheckCircle2 size={16} className="text-[#938a87] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{backupSuccessMessage}</p>
                </div>
              )}

              {backupErrorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 flex items-start space-x-2">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{backupErrorMessage}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'restore' && (
            <div className="space-y-5">
              {/* Select Source */}
              <div className="flex items-center space-x-3 text-xs">
                <button
                  type="button"
                  onClick={() => setRestoreMethod('upload')}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    restoreMethod === 'upload'
                      ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                      : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                  }`}
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreMethod('path')}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    restoreMethod === 'path'
                      ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                      : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                  }`}
                >
                  Local Path
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreMethod('paste')}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                    restoreMethod === 'paste'
                      ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                      : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                  }`}
                >
                  Paste JSON
                </button>
              </div>

              {/* Source Inputs */}
              {restoreMethod === 'upload' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.bak"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2a2a2a] hover:border-[#363636] bg-[#0a0a0a] rounded-xl p-6 text-center cursor-pointer transition-colors group"
                  >
                    <FolderOpen size={32} className="mx-auto text-[#605e5e] group-hover:text-[#f4f4f5] mb-2 transition-colors" />
                    <span className="font-semibold text-[#f4f4f5] block text-sm">
                      Click to Select Backup File (.json / .bak)
                    </span>
                    <span className="text-[11px] text-[#605e5e] block mt-1">
                      Supports encrypted and plain TermiSSH backup archives
                    </span>
                  </div>
                </div>
              )}

              {restoreMethod === 'path' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={restorePath}
                    onChange={(e) => setRestorePath(e.target.value)}
                    placeholder="Enter absolute path e.g. /home/alish/termissh_backup.json..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636] placeholder-[#605e5e]"
                  />
                  <button
                    type="button"
                    onClick={handleReadFromPath}
                    disabled={isInspecting}
                    className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {isInspecting ? <Loader2 size={14} className="animate-spin" /> : 'Load File'}
                  </button>
                </div>
              )}

              {restoreMethod === 'paste' && (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={rawBackupJson}
                    onChange={(e) => setRawBackupJson(e.target.value)}
                    placeholder="Paste raw backup JSON content here..."
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636] placeholder-[#605e5e]"
                  />
                  <button
                    type="button"
                    onClick={() => inspectBackupString(rawBackupJson)}
                    disabled={!rawBackupJson.trim() || isInspecting}
                    className="px-4 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Inspect JSON
                  </button>
                </div>
              )}

              {/* Password Decryption Prompt (If encrypted) */}
              {preview?.is_encrypted && preview.host_count === 0 && (
                <form
                  onSubmit={handleDecryptAndInspect}
                  className="bg-[#19191a] border border-[#2a2a2a] rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center space-x-2 text-[#f4f4f5] font-bold">
                    <Lock size={16} className="text-[#938a87]" />
                    <span>This backup is encrypted with AES-256-GCM.</span>
                  </div>
                  <p className="text-[11px] text-[#605e5e]">
                    Enter the password used to create this backup archive to decrypt and inspect its contents:
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type={showRestorePassword ? 'text' : 'password'}
                        value={restorePassword}
                        onChange={(e) => setRestorePassword(e.target.value)}
                        placeholder="Enter backup password..."
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowRestorePassword(!showRestorePassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#605e5e] hover:text-[#938a87]"
                      >
                        {showRestorePassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={isInspecting || !restorePassword.trim()}
                      className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isInspecting ? <Loader2 size={14} className="animate-spin" /> : 'Decrypt'}
                    </button>
                  </div>
                </form>
              )}

              {/* Valid Preview Details */}
              {preview && (preview.host_count > 0 || !preview.is_encrypted) && (
                <div className="space-y-4">
                  <div className="bg-[#19191a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck size={18} className="text-[#938a87]" />
                        <div>
                          <span className="font-bold text-[#f4f4f5] block text-xs">
                            Encrypted Archive Verified &amp; Ready
                          </span>
                          <span className="text-[10px] text-[#605e5e] font-mono">
                            AES-256-GCM ({preview.encryption_type === 'device_key' ? 'Device Key' : 'Password Protected'})
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#605e5e] font-mono">
                        Created: {new Date(preview.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center pt-1">
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.host_count}</div>
                        <div className="text-[10px] text-[#605e5e]">Hosts</div>
                      </div>
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.group_count}</div>
                        <div className="text-[10px] text-[#605e5e]">Groups</div>
                      </div>
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.key_count}</div>
                        <div className="text-[10px] text-[#605e5e]">SSH Keys</div>
                      </div>
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.tunnel_count}</div>
                        <div className="text-[10px] text-[#605e5e]">Tunnels</div>
                      </div>
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.snippet_count}</div>
                        <div className="text-[10px] text-[#605e5e]">Snippets</div>
                      </div>
                      <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                        <div className="font-bold text-[#f4f4f5] text-sm">{preview.secret_count}</div>
                        <div className="text-[10px] text-[#605e5e]">Credentials</div>
                      </div>
                    </div>
                  </div>

                  {/* Restore Mode Options */}
                  <div className="bg-[#19191a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-[#938a87] block">
                      Restore Mode:
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-lg border cursor-pointer flex flex-col transition-all ${
                          restoreMode === 'merge'
                            ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                            : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="restore_mode"
                            checked={restoreMode === 'merge'}
                            onChange={() => setRestoreMode('merge')}
                            className="accent-[#938a87]"
                          />
                          <span className="font-bold text-xs">Merge &amp; Update (Safe)</span>
                        </div>
                        <span className="text-[10px] text-[#605e5e] mt-1 pl-5">
                          Keeps existing items; updates matching IDs and adds new hosts &amp; keys.
                        </span>
                      </label>

                      <label
                        className={`p-3 rounded-lg border cursor-pointer flex flex-col transition-all ${
                          restoreMode === 'replace'
                            ? 'bg-rose-950/30 border-rose-500 text-rose-200'
                            : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="restore_mode"
                            checked={restoreMode === 'replace'}
                            onChange={() => setRestoreMode('replace')}
                            className="accent-rose-500"
                          />
                          <span className="font-bold text-xs text-rose-300">Clean Replace</span>
                        </div>
                        <span className="text-[10px] text-rose-400/70 mt-1 pl-5">
                          Wipes current data completely and restores exactly this backup archive.
                        </span>
                      </label>
                    </div>

                    {/* Selective Categories Checkboxes */}
                    <div className="pt-2 border-t border-[#2a2a2a] grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeHosts}
                          onChange={(e) => setIncludeHosts(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>Hosts &amp; Groups</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeKeys}
                          onChange={(e) => setIncludeKeys(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>SSH Keys</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeTunnels}
                          onChange={(e) => setIncludeTunnels(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>Tunnels</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSnippets}
                          onChange={(e) => setIncludeSnippets(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>Snippets</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeWorkspaces}
                          onChange={(e) => setIncludeWorkspaces(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>Workspaces</span>
                      </label>
                      <label className="flex items-center space-x-2 text-xs text-[#f4f4f5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSettings}
                          onChange={(e) => setIncludeSettings(e.target.checked)}
                          className="accent-[#938a87]"
                        />
                        <span>App Settings</span>
                      </label>
                    </div>
                  </div>

                  {/* Execute Button */}
                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    disabled={isRestoring}
                    className={`w-full py-2.5 rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                      restoreMode === 'replace'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5]'
                    }`}
                  >
                    {isRestoring ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    <span>{restoreMode === 'replace' ? 'Wipe & Restore Everything' : 'Restore & Merge Archive'}</span>
                  </button>
                </div>
              )}

              {/* Feedback messages */}
              {restoreSuccessMessage && (
                <div className="p-3.5 rounded-xl bg-[#2a2a2a] border border-[#363636] text-[#f4f4f5] flex items-start space-x-2">
                  <CheckCircle2 size={16} className="text-[#938a87] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{restoreSuccessMessage}</p>
                </div>
              )}

              {restoreErrorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 flex items-start space-x-2">
                  <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">{restoreErrorMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Replace Modal */}
      {confirmReplaceOpen && (
        <ConfirmModal
          isOpen={confirmReplaceOpen}
          title="Confirm Clean Restore (Wipe Existing Data)"
          message="WARNING: Clean Replace will permanently delete all existing hosts, keys, tunnels, snippets, and credentials on this computer before restoring the backup. Are you sure you want to proceed?"
          confirmLabel="Wipe & Restore"
          isDestructive={true}
          onConfirm={performRestore}
          onCancel={() => setConfirmReplaceOpen(false)}
        />
      )}
    </div>
  );
};
