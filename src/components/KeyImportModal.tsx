import React, { useState } from 'react';
import { X, UploadCloud, Shield, Loader2 } from 'lucide-react';

interface KeyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (name: string, content: string, passphrase?: string) => Promise<void>;
}

export const KeyImportModal: React.FC<KeyImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!name) setName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target?.result as string || '');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Key name is required');
      return;
    }
    if (!content.trim()) {
      setError('Private key content is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onImport(name.trim(), content.trim(), passphrase ? passphrase : undefined);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to import SSH key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center">
              <UploadCloud size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">Import Existing SSH Private Key</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs bg-[#0a0a0a]">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-medium text-[#938a87] mb-1">
              Key Name / Alias <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. AWS Production Bastion Key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-[#938a87]">
                Private Key Content (OpenSSH or PEM format) <span className="text-rose-400">*</span>
              </label>
              <label className="text-[11px] text-[#938a87] hover:text-[#f4f4f5] hover:underline cursor-pointer">
                <span>Browse File...</span>
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <textarea
              rows={6}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs font-mono text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
              <Shield size={12} className="text-[#938a87]" />
              <span>Passphrase (if key is encrypted)</span>
            </label>
            <input
              type="password"
              placeholder="Passphrase to decrypt this key..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
            />
          </div>

          <p className="text-[10px] text-[#605e5e]">
            Imported keys are never stored in SQLite in plaintext. They are encrypted and placed into the Linux Secret Service or secure hardware vault.
          </p>

          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-50 text-[#f4f4f5] font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>{loading ? 'Importing...' : 'Import Key'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
