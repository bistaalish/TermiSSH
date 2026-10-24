import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { HostConfig, FileEntry } from '../types';
import { api } from '../services/api';
import { FileEditorModal } from './FileEditorModal';
import { ConfirmModal } from './ConfirmModal';
import {
  Folder,
  File,
  ArrowUp,
  RotateCw,
  UploadCloud,
  DownloadCloud,
  Trash2,
  FolderPlus,
  Edit,
  Server,
  HardDrive,
  Loader2,
  AlertCircle,
  FileText,
  Search,
  X,
} from 'lucide-react';

interface SFTPManagerProps {
  hosts: HostConfig[];
  selectedHostId?: string;
}

export const SFTPManager: React.FC<SFTPManagerProps> = ({ hosts, selectedHostId }) => {
  const [currentHostId, setCurrentHostId] = useState<string>(selectedHostId || (hosts[0]?.id ?? ''));

  // Local state
  const [localPath, setLocalPath] = useState<string>('');
  const [localFiles, setLocalFiles] = useState<FileEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localSelected, setLocalSelected] = useState<FileEntry | null>(null);

  // Remote state
  const [remotePath, setRemotePath] = useState<string>('/root');
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteSelected, setRemoteSelected] = useState<FileEntry | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Editor Modal
  const [editorFile, setEditorFile] = useState<{ path: string; name: string } | null>(null);

  // New folder prompt modal
  const [newFolderTarget, setNewFolderTarget] = useState<'local' | 'remote' | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Transfer State
  const [transferring, setTransferring] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Search filter states
  const [localSearch, setLocalSearch] = useState<string>('');
  const [remoteSearch, setRemoteSearch] = useState<string>('');

  // Filtered files
  const filteredLocalFiles = useMemo(() => {
    if (!localSearch.trim()) return localFiles;
    const q = localSearch.trim().toLowerCase();
    return localFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [localFiles, localSearch]);

  const filteredRemoteFiles = useMemo(() => {
    if (!remoteSearch.trim()) return remoteFiles;
    const q = remoteSearch.trim().toLowerCase();
    return remoteFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [remoteFiles, remoteSearch]);

  // Format bytes
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Load Local Files
  const loadLocalFiles = useCallback(async (path: string) => {
    setLocalLoading(true);
    try {
      const files = await api.localList(path);
      setLocalFiles(files);
      setLocalPath(path);
      setLocalSelected(null);
    } catch (e) {
      console.error('Failed to load local files:', e);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // Load Remote Files
  const loadRemoteFiles = useCallback(async (hostId: string, path: string) => {
    if (!hostId) return;
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const files = await api.sftpList(hostId, path);
      setRemoteFiles(files);
      setRemotePath(path);
      setRemoteSelected(null);
    } catch (e) {
      setRemoteError(typeof e === 'string' ? e : 'Failed to connect or list remote directory');
    } finally {
      setRemoteLoading(false);
    }
  }, []);

  // Init
  useEffect(() => {
    api.getHomeDir()
      .then((home) => loadLocalFiles(home || '/home'))
      .catch(() => loadLocalFiles('/home'));
  }, [loadLocalFiles]);

  useEffect(() => {
    if (currentHostId) {
      loadRemoteFiles(currentHostId, remotePath);
    }
  }, [currentHostId, loadRemoteFiles, remotePath]);

  // Handle Local Navigation
  const navigateLocalUp = () => {
    const parts = localPath.split('/').filter(Boolean);
    parts.pop();
    const parent = '/' + parts.join('/');
    setLocalSearch('');
    loadLocalFiles(parent || '/');
  };

  // Handle Remote Navigation
  const navigateRemoteUp = () => {
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    const parent = '/' + parts.join('/');
    setRemoteSearch('');
    loadRemoteFiles(currentHostId, parent || '/');
  };

  // Upload Local File to Remote
  const handleUpload = async () => {
    if (!localSelected || !currentHostId) return;
    const dest = `${remotePath.replace(/\/$/, '')}/${localSelected.name}`;
    setTransferring(`Uploading ${localSelected.name}...`);
    try {
      await api.sftpUpload(currentHostId, localSelected.path, dest);
      await loadRemoteFiles(currentHostId, remotePath);
    } catch (e) {
      setRemoteError(`Upload failed: ${e}`);
    } finally {
      setTransferring(null);
    }
  };

  // Download Remote File to Local
  const handleDownload = async () => {
    if (!remoteSelected || !currentHostId) return;
    const dest = `${localPath.replace(/\/$/, '')}/${remoteSelected.name}`;
    setTransferring(`Downloading ${remoteSelected.name}...`);
    try {
      await api.sftpDownload(currentHostId, remoteSelected.path, dest);
      await loadLocalFiles(localPath);
    } catch (e) {
      setRemoteError(`Download failed: ${e}`);
    } finally {
      setTransferring(null);
    }
  };

  // Delete Remote File
  const handleDeleteRemote = () => {
    if (!remoteSelected || !currentHostId) return;
    setDeleteConfirmOpen(true);
  };

  const executeDeleteRemote = async () => {
    setDeleteConfirmOpen(false);
    if (!remoteSelected || !currentHostId) return;
    try {
      await api.sftpDelete(currentHostId, remoteSelected.path, remoteSelected.isDir);
      setRemoteSelected(null);
      await loadRemoteFiles(currentHostId, remotePath);
    } catch (e) {
      setRemoteError(`Delete failed: ${e}`);
    }
  };

  // Create Remote Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    if (newFolderTarget === 'remote' && currentHostId) {
      const folderPath = `${remotePath.replace(/\/$/, '')}/${newFolderName.trim()}`;
      try {
        await api.sftpMkdir(currentHostId, folderPath);
        await loadRemoteFiles(currentHostId, remotePath);
      } catch (e) {
        setRemoteError(`Failed to create directory: ${e}`);
      }
    }
    setNewFolderTarget(null);
    setNewFolderName('');
  };

  const selectedHost = hosts.find((h) => h.id === currentHostId);

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-14 px-6 border-b border-[#2a2a2a] bg-[#19191a] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
            <Folder size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#f4f4f5]">SFTP Dual-Pane File Manager</h2>
            <p className="text-[11px] text-[#938a87]">
              Transfer files between your local system and remote SSH servers with streaming encryption.
            </p>
          </div>
        </div>

        {/* Remote Host Selector */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-[#938a87] flex items-center space-x-1">
            <Server size={13} className="text-[#938a87]" />
            <span>Remote Host:</span>
          </label>
          <select
            value={currentHostId}
            onChange={(e) => setCurrentHostId(e.target.value)}
            style={{ colorScheme: 'dark' }}
            className="px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
          >
            {hosts.map((h) => (
              <option key={h.id} value={h.id} className="bg-[#19191a] text-[#f4f4f5]">
                {h.name} ({h.username}@{h.hostname})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transfer Progress Status Banner */}
      {transferring && (
        <div className="bg-[#19191a] border-b border-[#363636] px-6 py-2 flex items-center justify-between text-xs text-[#f4f4f5]">
          <div className="flex items-center space-x-2">
            <Loader2 size={14} className="animate-spin text-[#938a87]" />
            <span className="font-medium">{transferring}</span>
          </div>
          <button
            onClick={() => setTransferring(null)}
            className="text-[11px] px-2 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Dual Panes Container */}
      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#2a2a2a] overflow-hidden">
        {/* LEFT PANE: LOCAL SYSTEM */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
          {/* Pane Header */}
          <div className="p-3 bg-[#19191a] border-b border-[#2a2a2a] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-[#f4f4f5] font-semibold truncate flex-1 mr-2">
              <HardDrive size={15} className="text-[#938a87] shrink-0" />
              <span className="font-mono text-[11px] truncate">{localPath}</span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={navigateLocalUp}
                title="Parent Directory"
                className="p-1.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => loadLocalFiles(localPath)}
                title="Refresh"
                className="p-1.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-2 bg-[#141415] border-b border-[#2a2a2a] flex items-center">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5e]" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setLocalSearch('');
                }}
                placeholder="Search local files..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] transition-colors"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto">
            {localLoading ? (
              <div className="h-48 flex items-center justify-center text-[#605e5e]">
                <Loader2 size={24} className="animate-spin text-[#938a87]" />
              </div>
            ) : localFiles.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[#605e5e] text-xs">
                Empty directory
              </div>
            ) : filteredLocalFiles.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-[#605e5e] text-center p-4">
                <Search size={22} className="text-[#363636] mb-2" />
                <p className="text-xs text-[#938a87]">No files matching "{localSearch}"</p>
                <button
                  onClick={() => setLocalSearch('')}
                  className="mt-2 text-[11px] text-[#f4f4f5] hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#19191a] text-[#938a87] text-[11px] sticky top-0 border-b border-[#2a2a2a]">
                  <tr>
                    <th className="py-2 px-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium w-20 text-right">Size</th>
                    <th className="py-2 px-3 font-medium w-24 hidden sm:table-cell">Perms</th>
                    <th className="py-2 px-3 font-medium w-28 text-right hidden sm:table-cell">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#19191a]">
                  {filteredLocalFiles.map((file) => {
                    const isSelected = localSelected?.path === file.path;
                    return (
                      <tr
                        key={file.path}
                        onClick={() => setLocalSelected(file)}
                        onDoubleClick={() => {
                          if (file.isDir) {
                            setLocalSearch('');
                            loadLocalFiles(file.path);
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#2a2a2a] text-[#f4f4f5]'
                            : 'hover:bg-[#19191a] text-[#938a87]'
                        }`}
                      >
                        <td className="py-1.5 px-3 flex items-center space-x-2 font-medium truncate max-w-[200px]">
                          {file.isDir ? (
                            <Folder size={14} className="text-[#938a87] shrink-0" />
                          ) : (
                            <File size={14} className="text-[#605e5e] shrink-0" />
                          )}
                          <span className="truncate">{file.name}</span>
                        </td>
                        <td className="py-1.5 px-3 text-right text-[11px] font-mono text-[#605e5e]">
                          {formatSize(file.size)}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[10px] text-[#605e5e] hidden sm:table-cell">
                          {file.permissions}
                        </td>
                        <td className="py-1.5 px-3 text-right text-[11px] text-[#605e5e] hidden sm:table-cell">
                          {formatDate(file.modified)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-2.5 bg-[#19191a] border-t border-[#2a2a2a] flex items-center justify-between text-xs">
            <span className="text-[#605e5e] text-[11px]">
              {localSelected
                ? `Selected: ${localSelected.name} (${formatSize(localSelected.size)})`
                : localSearch
                ? `Showing ${filteredLocalFiles.length} of ${localFiles.length} items`
                : `${localFiles.length} items`}
            </span>
            <button
              onClick={handleUpload}
              disabled={!localSelected || !currentHostId || !!transferring}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-40 text-[#f4f4f5] font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <UploadCloud size={14} />
              <span>Upload to Remote &rarr;</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANE: REMOTE SFTP */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
          {/* Pane Header */}
          <div className="p-3 bg-[#19191a] border-b border-[#2a2a2a] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-[#f4f4f5] font-semibold truncate flex-1 mr-2">
              <Server size={15} className="text-[#938a87] shrink-0" />
              <span className="font-mono text-[11px] truncate">
                {selectedHost ? `${selectedHost.hostname}:${remotePath}` : remotePath}
              </span>
            </div>
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => {
                  setNewFolderTarget('remote');
                  setNewFolderName('');
                }}
                title="New Remote Folder"
                className="p-1.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
              >
                <FolderPlus size={14} />
              </button>
              <button
                onClick={navigateRemoteUp}
                title="Parent Directory"
                className="p-1.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => loadRemoteFiles(currentHostId, remotePath)}
                title="Refresh"
                className="p-1.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-2 bg-[#141415] border-b border-[#2a2a2a] flex items-center">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5e]" />
              <input
                type="text"
                value={remoteSearch}
                onChange={(e) => setRemoteSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRemoteSearch('');
                }}
                placeholder="Search remote files..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] transition-colors"
              />
              {remoteSearch && (
                <button
                  onClick={() => setRemoteSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto">
            {remoteLoading ? (
              <div className="h-48 flex items-center justify-center text-[#605e5e]">
                <Loader2 size={24} className="animate-spin text-[#938a87]" />
              </div>
            ) : remoteError ? (
              <div className="p-6 flex flex-col items-center justify-center text-rose-400 text-center">
                <AlertCircle size={28} className="mb-2" />
                <p className="text-xs font-semibold">{remoteError}</p>
                <button
                  onClick={() => loadRemoteFiles(currentHostId, remotePath)}
                  className="mt-3 px-3 py-1 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs hover:bg-[#222223] cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : remoteFiles.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[#605e5e] text-xs">
                Empty directory
              </div>
            ) : filteredRemoteFiles.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-[#605e5e] text-center p-4">
                <Search size={22} className="text-[#363636] mb-2" />
                <p className="text-xs text-[#938a87]">No files matching "{remoteSearch}"</p>
                <button
                  onClick={() => setRemoteSearch('')}
                  className="mt-2 text-[11px] text-[#f4f4f5] hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#19191a] text-[#938a87] text-[11px] sticky top-0 border-b border-[#2a2a2a]">
                  <tr>
                    <th className="py-2 px-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium w-20 text-right">Size</th>
                    <th className="py-2 px-3 font-medium w-24 hidden sm:table-cell">Perms</th>
                    <th className="py-2 px-3 font-medium w-28 text-right hidden sm:table-cell">Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#19191a]">
                  {filteredRemoteFiles.map((file) => {
                    const isSelected = remoteSelected?.path === file.path;
                    return (
                      <tr
                        key={file.path}
                        onClick={() => setRemoteSelected(file)}
                        onDoubleClick={() => {
                          if (file.isDir) {
                            setRemoteSearch('');
                            loadRemoteFiles(currentHostId, file.path);
                          } else {
                            setEditorFile({ path: file.path, name: file.name });
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#2a2a2a] text-[#f4f4f5]'
                            : 'hover:bg-[#19191a] text-[#938a87]'
                        }`}
                      >
                        <td className="py-1.5 px-3 flex items-center space-x-2 font-medium truncate max-w-[200px]">
                          {file.isDir ? (
                            <Folder size={14} className="text-[#938a87] shrink-0" />
                          ) : (
                            <FileText size={14} className="text-[#f4f4f5] shrink-0" />
                          )}
                          <span className="truncate">{file.name}</span>
                        </td>
                        <td className="py-1.5 px-3 text-right text-[11px] font-mono text-[#605e5e]">
                          {formatSize(file.size)}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[10px] text-[#605e5e] hidden sm:table-cell">
                          {file.permissions}
                        </td>
                        <td className="py-1.5 px-3 text-right text-[11px] text-[#605e5e] hidden sm:table-cell">
                          {formatDate(file.modified)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-2.5 bg-[#19191a] border-t border-[#2a2a2a] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[#605e5e] text-[11px] mr-2">
                {remoteSelected
                  ? `Selected: ${remoteSelected.name} (${formatSize(remoteSelected.size)})`
                  : remoteSearch
                  ? `Showing ${filteredRemoteFiles.length} of ${remoteFiles.length} items`
                  : `${remoteFiles.length} items`}
              </span>
              {remoteSelected && !remoteSelected.isDir && (
                <button
                  onClick={() => setEditorFile({ path: remoteSelected.path, name: remoteSelected.name })}
                  className="px-2 py-1 rounded bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] flex items-center space-x-1 text-[11px] cursor-pointer"
                >
                  <Edit size={12} />
                  <span>Edit File</span>
                </button>
              )}
              {remoteSelected && (
                <button
                  onClick={handleDeleteRemote}
                  className="p-1 rounded bg-[#0a0a0a] hover:bg-rose-950 border border-[#2a2a2a] text-rose-400 cursor-pointer"
                  title="Delete File"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <button
              onClick={handleDownload}
              disabled={!remoteSelected || !currentHostId || !!transferring}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-40 text-[#f4f4f5] font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
            >
              <DownloadCloud size={14} />
              <span>&larr; Download to Local</span>
            </button>
          </div>
        </div>
      </div>

      {/* File Editor Modal */}
      {editorFile && (
        <FileEditorModal
          isOpen={true}
          onClose={() => setEditorFile(null)}
          hostId={currentHostId}
          remotePath={editorFile.path}
          fileName={editorFile.name}
        />
      )}

      {/* New Folder Modal */}
      {newFolderTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-[#363636] rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-[#f4f4f5] flex items-center space-x-2">
              <FolderPlus size={16} className="text-[#938a87]" />
              <span>Create New Directory</span>
            </h4>
            <input
              type="text"
              placeholder="Directory name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setNewFolderTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] text-[#f4f4f5] text-xs font-semibold cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Remote File"
        message={`Are you sure you want to permanently delete "${remoteSelected?.name}" from the remote server? This cannot be undone.`}
        confirmLabel="Delete File"
        onConfirm={executeDeleteRemote}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
