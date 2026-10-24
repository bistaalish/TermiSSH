import React, { useState } from 'react';
import type { SSHKeyItem } from '../types';
import {
  KeyRound,
  Plus,
  UploadCloud,
  Copy,
  Trash2,
  Shield,
  Download,
  AlertTriangle,
  Check,
  Eye,
  X,
} from 'lucide-react';
import { KeyGenerateModal } from './KeyGenerateModal';
import { KeyImportModal } from './KeyImportModal';
import { api } from '../services/api';

interface KeyManagerProps {
  keys: SSHKeyItem[];
  onRefresh: () => void;
  onGenerate: (name: string, keyType: any, passphrase?: string, bits?: number) => Promise<void>;
  onImport: (name: string, content: string, passphrase?: string) => Promise<void>;
  onDelete: (id: string) => void;
}

export const KeyManager: React.FC<KeyManagerProps> = ({
  keys,
  onRefresh: _onRefresh,
  onGenerate,
  onImport,
  onDelete,
}) => {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // View public key modal
  const [viewingKey, setViewingKey] = useState<SSHKeyItem | null>(null);

  // Export private key confirmation modal
  const [exportKey, setExportKey] = useState<SSHKeyItem | null>(null);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportedContent, setExportedContent] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleExportConfirm = async () => {
    if (!exportKey) return;
    setExportError(null);
    try {
      const privateKey = await api.getPrivateKey(exportKey.id, exportPassphrase || undefined);
      setExportedContent(privateKey);
    } catch (err) {
      setExportError(typeof err === 'string' ? err : 'Failed to retrieve private key');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#2a2a2a] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <KeyRound className="text-[#938a87]" size={22} />
            <span>SSH Keys &amp; Identities</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Generate, import, and assign cryptographic keys for passwordless authentication.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <UploadCloud size={14} className="text-[#938a87]" />
            <span>Import Key</span>
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Generate Key Pair</span>
          </button>
        </div>
      </div>

      {/* Keys List */}
      <div className="p-6 flex-1">
        {keys.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <KeyRound size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#938a87]">No SSH Keys stored</p>
            <p className="text-xs text-[#605e5e] mt-1">
              Generate a high-security Ed25519 key or import your existing OpenSSH key pair.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {keys.map((key) => (
              <div
                key={key.id}
                className="bg-[#19191a] border border-[#2a2a2a] hover:border-[#363636] rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shrink-0">
                        <KeyRound size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#f4f4f5]">{key.name}</h3>
                        <span className="text-[10px] uppercase font-bold text-[#f4f4f5] bg-[#2a2a2a] px-1.5 py-0.5 rounded border border-[#363636]">
                          {key.keyType}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(key.id)}
                      className="p-1 rounded text-[#605e5e] hover:text-rose-400 hover:bg-[#222223] transition-colors cursor-pointer"
                      title="Delete Key"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Fingerprint */}
                  <div className="mt-3.5 space-y-1 font-mono text-[11px]">
                    <span className="text-[10px] text-[#605e5e] font-sans font-semibold uppercase">
                      SHA256 Fingerprint
                    </span>
                    <div className="p-2 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[#f4f4f5] break-all text-[10px]">
                      {key.fingerprintSha256}
                    </div>
                  </div>

                  {/* Status chip */}
                  <div className="mt-3 flex items-center space-x-2 text-[11px]">
                    <span className="flex items-center space-x-1 text-[#938a87]">
                      <Shield size={12} className={key.hasPassphrase ? 'text-[#f4f4f5]' : 'text-[#605e5e]'} />
                      <span>{key.hasPassphrase ? 'Passphrase Protected' : 'No Passphrase'}</span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-[#2a2a2a] flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(key.id, key.publicKey)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKeyId === key.id ? (
                      <>
                        <Check size={13} className="text-[#f4f4f5]" />
                        <span className="text-[#f4f4f5]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Public</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setViewingKey(key)}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] border border-[#363636] transition-colors cursor-pointer"
                    title="View Public Key"
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    onClick={() => {
                      setExportKey(key);
                      setExportPassphrase('');
                      setExportedContent(null);
                      setExportError(null);
                    }}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] border border-[#363636] transition-colors cursor-pointer"
                    title="Export Private Key"
                  >
                    <Download size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Modal */}
      <KeyGenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={onGenerate}
      />

      {/* Import Modal */}
      <KeyImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={onImport}
      />

      {/* View Public Key Modal */}
      {viewingKey && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center space-x-2">
                <KeyRound size={16} className="text-[#938a87]" />
                <span>Public Key: {viewingKey.name}</span>
              </h3>
              <button
                onClick={() => setViewingKey(null)}
                className="p-1 text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              readOnly
              rows={5}
              value={viewingKey.publicKey}
              className="w-full p-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs font-mono text-[#f4f4f5] focus:outline-none select-all"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => handleCopy(viewingKey.id, viewingKey.publicKey)}
                className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Copy size={13} />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Private Key Modal with explicit Security Confirmation */}
      {exportKey && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <AlertTriangle size={18} />
                <span>Security Warning: Export Private Key</span>
              </div>
              <button onClick={() => setExportKey(null)} className="p-1 text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#938a87] leading-relaxed">
              Exporting private keys exposes sensitive cryptographic secrets. Never share this key or send it over untrusted communication channels.
            </p>

            {exportError && (
              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
                {exportError}
              </div>
            )}

            {!exportedContent ? (
              <div className="space-y-3">
                {exportKey.hasPassphrase && (
                  <div>
                    <label className="block text-xs font-medium text-[#938a87] mb-1">
                      Key Passphrase Required
                    </label>
                    <input
                      type="password"
                      placeholder="Enter passphrase to decrypt..."
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setExportKey(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExportConfirm}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm &amp; Reveal Private Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  readOnly
                  rows={7}
                  value={exportedContent}
                  className="w-full p-3 rounded-lg bg-[#0a0a0a] border border-amber-800/40 text-xs font-mono text-amber-200 select-all"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => setExportKey(null)}
                    className="px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] text-[#f4f4f5] text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
