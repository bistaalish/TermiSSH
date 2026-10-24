import React, { useState } from 'react';
import { X, Settings, Palette, Shield, Save, Database } from 'lucide-react';
import type { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onOpenBackupRestore?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  onOpenBackupRestore,
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'terminal' | 'security' | 'appearance' | 'backup'>('terminal');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
              <Settings size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">Application Preferences</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] bg-[#19191a] px-6">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'terminal'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'appearance'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'security'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Security &amp; Network
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'backup'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Backup &amp; Restore
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh] bg-[#0a0a0a]">
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Font Family</label>
                  <input
                    type="text"
                    value={settings.fontFamily}
                    onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Font Size (pt)</label>
                  <input
                    type="number"
                    min={10}
                    max={28}
                    value={settings.fontSize}
                    onChange={(e) =>
                      setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Cursor Style</label>
                  <select
                    value={settings.cursorStyle}
                    onChange={(e) =>
                      setSettings({ ...settings, cursorStyle: e.target.value as any })
                    }
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
                  >
                    <option value="block" className="bg-[#19191a] text-[#f4f4f5]">Block</option>
                    <option value="underline" className="bg-[#19191a] text-[#f4f4f5]">Underline</option>
                    <option value="bar" className="bg-[#19191a] text-[#f4f4f5]">Bar (I-Beam)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Scrollback Buffer Lines</label>
                  <input
                    type="number"
                    min={1000}
                    max={100000}
                    step={1000}
                    value={settings.scrollbackLines}
                    onChange={(e) =>
                      setSettings({ ...settings, scrollbackLines: parseInt(e.target.value) || 10000 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.cursorBlink}
                    onChange={(e) => setSettings({ ...settings, cursorBlink: e.target.checked })}
                    className="rounded accent-[#938a87]"
                  />
                  <span className="text-[#f4f4f5] font-medium">Blinking cursor</span>
                </label>
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.copyOnSelect}
                    onChange={(e) => setSettings({ ...settings, copyOnSelect: e.target.checked })}
                    className="rounded accent-[#938a87]"
                  />
                  <span className="text-[#f4f4f5] font-medium">
                    Automatically copy text to clipboard on selection
                  </span>
                </label>
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundBell}
                    onChange={(e) => setSettings({ ...settings, soundBell: e.target.checked })}
                    className="rounded accent-[#938a87]"
                  />
                  <span className="text-[#f4f4f5] font-medium">Audio bell notification</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-[#938a87] mb-1.5 flex items-center space-x-1.5">
                  <Palette size={14} className="text-[#938a87]" />
                  <span>Color Theme Preset</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dark', 'amoled', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSettings({ ...settings, theme: t })}
                      className={`py-3 px-3 rounded-lg border text-center capitalize transition-colors cursor-pointer ${
                        settings.theme === t
                          ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                      }`}
                    >
                      {t} Theme
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">
                    Default Connection Timeout (sec)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={settings.defaultTimeoutSeconds}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultTimeoutSeconds: parseInt(e.target.value) || 15 })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">
                    Default Keepalive Interval (sec)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={settings.keepaliveIntervalDefault}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        keepaliveIntervalDefault: parseInt(e.target.value) || 30,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#19191a] border border-[#2a2a2a] text-[11px] text-[#938a87] space-y-1">
                <span className="font-semibold text-[#f4f4f5] flex items-center space-x-1.5">
                  <Shield size={12} className="text-[#938a87]" />
                  <span>Credential Vault Architecture</span>
                </span>
                <p>
                  Passwords, private keys, and passphrases are safeguarded using the Linux System Keyring (GNOME Keyring / Secret Service).
                  Opaque identifier tokens are referenced in SQLite with zero plaintext secrets at rest.
                </p>
              </div>

              <div className="pt-2 border-t border-[#2a2a2a]">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.confirmBeforeClosingActiveTab}
                    onChange={(e) =>
                      setSettings({ ...settings, confirmBeforeClosingActiveTab: e.target.checked })
                    }
                    className="rounded accent-[#938a87]"
                  />
                  <span className="text-[#f4f4f5] font-medium">
                    Confirm before closing active terminal session tabs
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-[#19191a] border border-[#2a2a2a] space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]">
                    <Database size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#f4f4f5] text-sm">
                      Database &amp; Secrets Backup Archive
                    </h4>
                    <p className="text-[11px] text-[#605e5e] font-mono">
                      Export or restore hosts, SSH keys, passwords, and tunnels
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#938a87] leading-relaxed">
                  TermiSSH backups allow full cross-machine portability. You can protect your archive with industry-standard AES-256-GCM encryption, or restore an existing backup with full replace or safe merge.
                </p>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBackupRestore?.();
                    }}
                    className="px-4 py-2.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-2 cursor-pointer transition-all"
                  >
                    <Database size={15} />
                    <span>Launch Backup &amp; Restore Manager</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Save size={13} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
