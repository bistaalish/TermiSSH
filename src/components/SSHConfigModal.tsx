import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  FileCode,
  Loader2,
  RefreshCw,
  Download,
  Upload,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import type { HostConfig, SSHConfigFileInfo } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SSHConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  hosts: HostConfig[];
  onHostsImported: (imported: HostConfig[]) => void;
}

export const SSHConfigModal: React.FC<SSHConfigModalProps> = ({
  isOpen,
  onClose,
  hosts,
  onHostsImported,
}) => {
  const [configInfo, setConfigInfo] = useState<SSHConfigFileInfo | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const isDirty = content !== originalContent;

  const loadConfig = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const info = await api.getSSHConfig();
      setConfigInfo(info);
      setContent(info.content);
      setOriginalContent(info.content);
    } catch (err) {
      setStatusMessage({
        text: `Failed to load ~/.ssh/config: ${err}`,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  // Sync scrolling between line numbers and textarea
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Update cursor position
  const handleCursorUpdate = () => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value.substring(0, textareaRef.current.selectionStart);
    const lines = text.split('\n');
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Keyboard shortcuts (Ctrl+S to save, Tab for indentation)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: Unindent
        const before = content.substring(0, start);
        const lastNewLine = before.lastIndexOf('\n');
        const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
        const linePrefix = content.substring(lineStart, lineStart + 4);

        if (linePrefix === '    ') {
          const newContent = content.substring(0, lineStart) + content.substring(lineStart + 4);
          setContent(newContent);
          setTimeout(() => {
            textarea.selectionStart = Math.max(lineStart, start - 4);
            textarea.selectionEnd = Math.max(lineStart, end - 4);
          }, 0);
        }
      } else {
        // Tab: Insert 4 spaces
        const newContent = content.substring(0, start) + '    ' + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        }, 0);
      }
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const msg = await api.saveSSHConfig(content, createBackup);
      setOriginalContent(content);
      setStatusMessage({
        text: msg,
        type: 'success',
      });
      // Refresh file info metadata
      const updated = await api.getSSHConfig();
      setConfigInfo(updated);
    } catch (err) {
      setStatusMessage({
        text: `Failed to save: ${err}`,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImportToTermiSSH = async () => {
    setImporting(true);
    setStatusMessage(null);
    try {
      const imported = await api.importOpenSSHConfig(content);
      onHostsImported(imported);
      setStatusMessage({
        text: `Successfully imported ${imported.length} hosts into TermiSSH!`,
        type: 'success',
      });
    } catch (err) {
      setStatusMessage({
        text: `Failed to import hosts: ${err}`,
        type: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExportHosts = async (hostIds: string[]) => {
    setShowExportMenu(false);
    try {
      const generated = await api.formatHostsAsSSHConfig(hostIds);
      const separator = content.endsWith('\n') || content.trim().length === 0 ? '' : '\n';
      const newContent = content + separator + generated + '\n';
      setContent(newContent);
      setStatusMessage({
        text: `Exported ${hostIds.length > 0 ? hostIds.length : 'all'} hosts into config editor! Review and click Save.`,
        type: 'info',
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      setStatusMessage({
        text: `Export error: ${err}`,
        type: 'error',
      });
    }
  };

  const insertTemplate = (template: string) => {
    setShowTemplatesMenu(false);
    const separator = content.endsWith('\n') || content.trim().length === 0 ? '' : '\n\n';
    setContent(content + separator + template + '\n');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        textareaRef.current.focus();
      }
    }, 50);
  };

  const handleCopyPath = () => {
    if (!configInfo) return;
    navigator.clipboard.writeText(configInfo.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const linesCount = Math.max(content.split('\n').length, 1);
  const hostBlocksCount = (content.match(/^[ \t]*Host\s+/gim) || []).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden text-[#f4f4f5]"
        onClick={() => {
          if (showExportMenu) setShowExportMenu(false);
          if (showTemplatesMenu) setShowTemplatesMenu(false);
        }}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a] shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]">
              <FileCode size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-bold text-[#f4f4f5] tracking-tight">
                  OpenSSH Client Configuration
                </h3>
                {isDirty ? (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>Unsaved Changes</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#938a87] bg-[#2a2a2a] border border-[#363636] px-2 py-0.5 rounded-full">
                    Up to date
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-[#938a87] mt-0.5 font-mono">
                <span className="text-[#f4f4f5] flex items-center space-x-1">
                  <span>{configInfo?.path || '~/.ssh/config'}</span>
                  <button
                    onClick={handleCopyPath}
                    title="Copy path"
                    className="text-[#938a87] hover:text-[#f4f4f5] p-0.5 transition-colors cursor-pointer"
                  >
                    {copiedPath ? <Check size={12} className="text-[#f4f4f5]" /> : <Copy size={12} />}
                  </button>
                </span>
                <span className="text-[#363636]">•</span>
                <span className="flex items-center space-x-1 text-[#938a87]">
                  <ShieldCheck size={13} />
                  <span>Permissions: {configInfo?.permissions || '0600'}</span>
                </span>
                {configInfo?.backupPath && (
                  <>
                    <span className="text-[#363636]">•</span>
                    <span className="text-[#605e5e]">Backup available</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadConfig}
              disabled={loading}
              title="Reload from disk"
              className="p-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] border border-[#363636] transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 border-b border-[#2a2a2a] bg-[#19191a] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            {/* Insert Template Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTemplatesMenu(!showTemplatesMenu);
                  setShowExportMenu(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} className="text-[#938a87]" />
                <span>Insert Template</span>
                <ChevronDown size={12} className="text-[#605e5e]" />
              </button>

              {showTemplatesMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#19191a] border border-[#363636] rounded-xl shadow-2xl py-1.5 z-20">
                  <button
                    onClick={() =>
                      insertTemplate(`Host my-server
    HostName 192.168.1.100
    User admin
    Port 22
    # IdentityFile ~/.ssh/id_ed25519`)
                    }
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a2a] text-xs text-[#f4f4f5] transition-colors"
                  >
                    <div className="font-semibold text-[#f4f4f5]">Standard SSH Host</div>
                    <div className="text-[11px] text-[#938a87]">Host, HostName, User, Port</div>
                  </button>

                  <button
                    onClick={() =>
                      insertTemplate(`Host internal-service
    HostName 10.0.1.50
    User sysadmin
    ProxyJump bastion-host`)
                    }
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a2a] text-xs text-[#f4f4f5] transition-colors border-t border-[#2a2a2a]"
                  >
                    <div className="font-semibold text-[#f4f4f5]">ProxyJump (JumpHost / Bastion)</div>
                    <div className="text-[11px] text-[#938a87]">Route through intermediate host</div>
                  </button>

                  <button
                    onClick={() =>
                      insertTemplate(`Host cf-protected.domain.com
    ProxyCommand /usr/local/bin/cloudflared access ssh --hostname %h
    User root`)
                    }
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a2a] text-xs text-[#f4f4f5] transition-colors border-t border-[#2a2a2a]"
                  >
                    <div className="font-semibold text-[#f4f4f5]">Cloudflare Access Proxy</div>
                    <div className="text-[11px] text-[#938a87]">ProxyCommand with cloudflared</div>
                  </button>

                  <button
                    onClick={() =>
                      insertTemplate(`Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes`)
                    }
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a2a] text-xs text-[#f4f4f5] transition-colors border-t border-[#2a2a2a]"
                  >
                    <div className="font-semibold text-[#f4f4f5]">Git / Identity Specific</div>
                    <div className="text-[11px] text-[#938a87]">Specify identity key for Git</div>
                  </button>
                </div>
              )}
            </div>

            {/* Export TermiSSH Hosts into Config Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu(!showExportMenu);
                  setShowTemplatesMenu(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download size={14} className="text-[#938a87]" />
                <span>Export Hosts to Config</span>
                <ChevronDown size={12} className="text-[#605e5e]" />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#19191a] border border-[#363636] rounded-xl shadow-2xl py-1.5 z-20 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#938a87] border-b border-[#2a2a2a]">
                    Append hosts into ~/.ssh/config
                  </div>
                  <button
                    onClick={() => handleExportHosts([])}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2a2a2a] text-xs font-medium text-[#f4f4f5] flex items-center justify-between transition-colors"
                  >
                    <span>Export All Saved Hosts ({hosts.length})</span>
                    <Download size={13} />
                  </button>
                  {hosts.length > 0 && <div className="border-t border-[#2a2a2a] my-1" />}
                  {hosts.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleExportHosts([h.id])}
                      className="w-full text-left px-3.5 py-1.5 hover:bg-[#2a2a2a] text-xs text-[#938a87] hover:text-[#f4f4f5] flex items-center justify-between transition-colors"
                    >
                      <span className="truncate max-w-[180px]">{h.name}</span>
                      <span className="text-[11px] text-[#605e5e] font-mono">{h.hostname}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Import Config Hosts into TermiSSH */}
            <button
              onClick={handleImportToTermiSSH}
              disabled={importing || loading}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] disabled:opacity-50 text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Parse this configuration and register hosts in TermiSSH"
            >
              {importing ? <Loader2 size={14} className="animate-spin text-[#938a87]" /> : <Upload size={14} className="text-[#938a87]" />}
              <span>Import to TermiSSH Hosts</span>
            </button>

            {/* Find in Config */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5e] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  if (q.trim() && textareaRef.current) {
                    const idx = content.toLowerCase().indexOf(q.toLowerCase());
                    if (idx >= 0) {
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(idx, idx + q.length);
                    }
                  }
                }}
                placeholder="Find in config..."
                className="pl-7 pr-3 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-hidden focus:border-[#363636] w-32 sm:w-36 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Backup Checkbox */}
            <label className="flex items-center space-x-2 text-xs text-[#938a87] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={(e) => setCreateBackup(e.target.checked)}
                className="rounded border-[#363636] bg-[#0a0a0a] accent-[#938a87] focus:ring-0 cursor-pointer"
              />
              <span>Create .bak backup on save</span>
            </label>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                isDirty
                  ? 'bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] shadow-xs'
                  : 'bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87]'
              }`}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                : 'bg-[#19191a] border-[#2a2a2a] text-[#938a87]'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' && <CheckCircle2 size={15} className="shrink-0 text-[#938a87]" />}
              {statusMessage.type === 'error' && <AlertCircle size={15} className="shrink-0 text-rose-400" />}
              {statusMessage.type === 'info' && <HelpCircle size={15} className="shrink-0 text-[#938a87]" />}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-[#605e5e] hover:text-[#f4f4f5] transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden bg-[#0a0a0a]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-[#605e5e]">
              <Loader2 size={32} className="animate-spin text-[#938a87]" />
              <p className="text-xs font-medium">Loading ~/.ssh/config...</p>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Line Numbers Gutter */}
              <div
                ref={lineNumbersRef}
                className="w-12 py-3 bg-[#0a0a0a] border-r border-[#2a2a2a] text-right pr-3 select-none font-mono text-xs text-[#605e5e] overflow-hidden leading-6 shrink-0"
              >
                {Array.from({ length: linesCount }, (_, i) => (
                  <div key={i + 1}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea Code Editor */}
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onScroll={handleScroll}
                  onSelect={handleCursorUpdate}
                  onClick={handleCursorUpdate}
                  onKeyUp={handleCursorUpdate}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                  placeholder="# OpenSSH client configuration file (~/.ssh/config)&#10;Host example&#10;    HostName 192.168.1.1&#10;    User root"
                  className="w-full h-full p-3 font-mono text-xs sm:text-sm text-[#f4f4f5] bg-transparent resize-none focus:outline-hidden leading-6 whitespace-pre font-normal"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer / Status Bar */}
        <div className="h-9 px-6 bg-[#19191a] border-t border-[#2a2a2a] flex items-center justify-between text-[11px] font-mono text-[#605e5e] shrink-0 select-none">
          <div className="flex items-center space-x-4">
            <span className="text-[#938a87]">
              {hostBlocksCount} {hostBlocksCount === 1 ? 'Host block' : 'Host blocks'}
            </span>
            <span className="text-[#2a2a2a]">|</span>
            <span>
              Line {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span className="text-[#2a2a2a]">|</span>
            <span>
              {linesCount} {linesCount === 1 ? 'line' : 'lines'}, {content.length} characters
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[#605e5e]">
            <span>Encoding: UTF-8</span>
            <span className="text-[#363636]">•</span>
            <span>Format: OpenSSH Config</span>
            <span className="text-[#363636]">•</span>
            <span className="text-[#938a87] font-medium">Tab = 4 spaces</span>
          </div>
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmModal
          isOpen={showDiscardConfirm}
          title="Unsaved Changes"
          message="You have unsaved changes in ~/.ssh/config. Discard changes and close?"
          confirmLabel="Discard & Close"
          cancelLabel="Keep Editing"
          isDestructive={true}
          onConfirm={() => {
            setShowDiscardConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
};
