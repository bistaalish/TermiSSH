import React, { useState } from 'react';
import { X, KeyRound, Shield, Loader2 } from 'lucide-react';
import type { KeyAlgorithm } from '../types';

interface KeyGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (name: string, keyType: KeyAlgorithm, passphrase?: string, bits?: number) => Promise<void>;
}

export const KeyGenerateModal: React.FC<KeyGenerateModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
}) => {
  const [name, setName] = useState('');
  const [keyType, setKeyType] = useState<KeyAlgorithm>('ed25519');
  const [rsaBits, setRsaBits] = useState(4096);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Key name is required');
      return;
    }
    if (passphrase && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onGenerate(
        name.trim(),
        keyType,
        passphrase ? passphrase : undefined,
        keyType === 'rsa' ? rsaBits : undefined
      );
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to generate key pair');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
              <KeyRound size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">Generate New SSH Key Pair</h3>
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
              placeholder="e.g. Work Laptop Ed25519"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-medium text-[#938a87] mb-1.5">Key Algorithm</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setKeyType('ed25519')}
                className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  keyType === 'ed25519'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                Ed25519 (Fastest)
              </button>
              <button
                type="button"
                onClick={() => setKeyType('rsa')}
                className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  keyType === 'rsa'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                RSA
              </button>
              <button
                type="button"
                onClick={() => setKeyType('ecdsa')}
                className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                  keyType === 'ecdsa'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                ECDSA
              </button>
            </div>
          </div>

          {keyType === 'rsa' && (
            <div>
              <label className="block font-medium text-[#938a87] mb-1">Key Size (bits)</label>
              <select
                value={rsaBits}
                onChange={(e) => setRsaBits(parseInt(e.target.value))}
                style={{ colorScheme: 'dark' }}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
              >
                <option value={4096} className="bg-[#19191a] text-[#f4f4f5]">4096 bits (Recommended)</option>
                <option value={2048} className="bg-[#19191a] text-[#f4f4f5]">2048 bits</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label className="block font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
                <Shield size={12} className="text-[#938a87]" />
                <span>Passphrase (Optional)</span>
              </label>
              <input
                type="password"
                placeholder="Passphrase to encrypt private key..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              />
            </div>
            {passphrase && (
              <div>
                <label className="block font-medium text-[#938a87] mb-1">Confirm Passphrase</label>
                <input
                  type="password"
                  placeholder="Repeat passphrase..."
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-50 text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>{loading ? 'Generating...' : 'Generate Key Pair'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
