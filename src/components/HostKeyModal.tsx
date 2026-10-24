import React from 'react';
import type { HostKeyPromptData } from '../types';
import { AlertTriangle, ShieldAlert, ShieldCheck, X } from 'lucide-react';

interface HostKeyModalProps {
  prompt: HostKeyPromptData | null;
  onResolve: (accept: boolean) => void;
}

export const HostKeyModal: React.FC<HostKeyModalProps> = ({ prompt, onResolve }) => {
  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`rounded-2xl max-w-lg w-full border shadow-2xl overflow-hidden ${
          prompt.isMismatch
            ? 'bg-[#19191a] border-rose-500/50 shadow-2xl'
            : 'bg-[#19191a] border-[#363636] shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`h-14 px-6 border-b flex items-center justify-between ${
            prompt.isMismatch
              ? 'bg-[#19191a] border-rose-900/50 text-rose-300'
              : 'bg-[#19191a] border-[#2a2a2a] text-[#f4f4f5]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {prompt.isMismatch ? (
              <div className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/40">
                <ShieldAlert size={20} />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]">
                <ShieldCheck size={20} />
              </div>
            )}
            <h3 className="font-bold text-sm tracking-wide">
              {prompt.isMismatch
                ? 'CRITICAL SECURITY WARNING: HOST KEY CHANGED'
                : 'Unknown Host Key Verification'}
            </h3>
          </div>
          <button
            onClick={() => onResolve(false)}
            className="p-1 text-[#605e5e] hover:text-[#f4f4f5] rounded cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-xs bg-[#0a0a0a]">
          {prompt.isMismatch ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-200 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-rose-400">
                  <AlertTriangle size={16} />
                  <span>POTENTIAL MAN-IN-THE-MIDDLE ATTACK DETECTED</span>
                </div>
                <p className="leading-relaxed text-[11px] text-[#938a87]">
                  The host key received for <span className="font-mono font-bold text-white">{prompt.host}:{prompt.port}</span> does NOT match the previously recorded key.
                  This could mean the server was reinstalled, or an attacker is intercepting your connection!
                </p>
              </div>

              {/* Fingerprint Comparison */}
              <div className="space-y-2 font-mono text-[11px]">
                <div className="p-2.5 rounded bg-[#19191a] border border-rose-900/30">
                  <span className="text-[#605e5e] block text-[10px] uppercase font-sans font-semibold">
                    Offered Host Key ({prompt.keyType})
                  </span>
                  <span className="text-rose-400 font-bold break-all">{prompt.fingerprint}</span>
                </div>
                {prompt.oldFingerprint && (
                  <div className="p-2.5 rounded bg-[#19191a] border border-rose-900/30">
                    <span className="text-[#605e5e] block text-[10px] uppercase font-sans font-semibold">
                      Previously Trusted Key
                    </span>
                    <span className="text-[#938a87] break-all">{prompt.oldFingerprint}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[#938a87] leading-relaxed">
                The authenticity of host <span className="font-mono font-bold text-[#f4f4f5]">{prompt.host}:{prompt.port}</span> cannot be established.
                Do you want to trust this key and add it to your known hosts database?
              </p>

              <div className="p-3 rounded-lg bg-[#19191a] border border-[#2a2a2a] space-y-1.5 font-mono">
                <div className="flex justify-between text-[#605e5e] text-[11px]">
                  <span>Key Type:</span>
                  <span className="text-[#f4f4f5] uppercase font-semibold">{prompt.keyType}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-[#605e5e] block">SHA256 Fingerprint:</span>
                  <span className="text-[#f4f4f5] break-all font-bold">{prompt.fingerprint}</span>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-end space-x-3">
            <button
              onClick={() => onResolve(false)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                prompt.isMismatch
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                  : 'bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5]'
              }`}
            >
              {prompt.isMismatch ? 'Reject & Disconnect (Recommended)' : 'Cancel'}
            </button>
            <button
              onClick={() => onResolve(true)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                prompt.isMismatch
                  ? 'bg-[#2a2a2a] hover:bg-rose-950 text-rose-300 border border-rose-800/40'
                  : 'bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5]'
              }`}
            >
              {prompt.isMismatch ? 'Override & Accept New Key' : 'Trust & Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
