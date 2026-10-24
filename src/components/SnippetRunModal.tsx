import React, { useState, useMemo } from 'react';
import { X, Play, Copy, Terminal, AlertCircle } from 'lucide-react';
import type { CommandSnippet } from '../types';

interface SnippetRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: CommandSnippet | null;
  hasActiveSession: boolean;
  onExecute: (interpolatedCommand: string) => void;
}

export const SnippetRunModal: React.FC<SnippetRunModalProps> = ({
  isOpen,
  onClose,
  snippet,
  hasActiveSession,
  onExecute,
}) => {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Parse variables like {{var_name}} or {{var_name:default}}
  const variables = useMemo(() => {
    if (!snippet) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: { name: string; defaultVal?: string }[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = regex.exec(snippet.command)) !== null) {
      const raw = match[1].trim();
      const parts = raw.split(':');
      const name = parts[0].trim();
      const defaultVal = parts.length > 1 ? parts.slice(1).join(':').trim() : undefined;
      if (!seen.has(name)) {
        seen.add(name);
        matches.push({ name, defaultVal });
      }
    }
    return matches;
  }, [snippet]);

  // Compute interpolated command
  const resolvedCommand = useMemo(() => {
    if (!snippet) return '';
    let cmd = snippet.command;
    variables.forEach(({ name, defaultVal }) => {
      const val = variableValues[name] !== undefined ? variableValues[name] : (defaultVal || '');
      // replace {{name}} or {{name:default}}
      const varRegex = new RegExp(`\\{\\{${name}(?::[^}]+)?\\}\\}`, 'g');
      cmd = cmd.replace(varRegex, val);
    });
    return cmd;
  }, [snippet, variables, variableValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasActiveSession) {
      onExecute(resolvedCommand);
      onClose();
    }
  };

  if (!isOpen || !snippet) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center">
              <Terminal size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f4f5]">{snippet.title}</h3>
              <p className="text-[11px] text-[#938a87]">{snippet.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs bg-[#0a0a0a]">
          {snippet.description && (
            <p className="text-[#605e5e] italic text-[11px]">{snippet.description}</p>
          )}

          {/* Variables Inputs */}
          {variables.length > 0 && (
            <div className="space-y-3 p-3.5 rounded-xl bg-[#19191a] border border-[#2a2a2a]">
              <span className="text-[11px] font-semibold text-[#938a87] block uppercase tracking-wider">
                Snippet Variables Required
              </span>
              {variables.map(({ name, defaultVal }, idx) => (
                <div key={name}>
                  <label className="block text-[#938a87] font-mono text-[11px] mb-1">
                    {name}
                  </label>
                  <input
                    type="text"
                    autoFocus={idx === 0}
                    placeholder={defaultVal || `Enter value for ${name}...`}
                    value={variableValues[name] ?? (defaultVal || '')}
                    onChange={(e) =>
                      setVariableValues((prev) => ({ ...prev, [name]: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636] placeholder-[#605e5e]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Resolved Command Preview */}
          <div>
            <label className="block font-medium text-[#938a87] mb-1">
              Command to Execute (Preview)
            </label>
            <div className="p-3 rounded-lg bg-[#19191a] border border-[#2a2a2a] font-mono text-[#f4f4f5] text-xs break-all select-all">
              {resolvedCommand}
            </div>
          </div>

          {!hasActiveSession && (
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-[11px] flex items-center space-x-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>No terminal tab is currently active. You can copy the command to clipboard.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(resolvedCommand);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium border border-[#2a2a2a] flex items-center space-x-1.5 cursor-pointer"
            >
              <Copy size={13} />
              <span>Copy to Clipboard</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!hasActiveSession}
                className="px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-40 text-[#f4f4f5] font-semibold flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <Play size={13} className="fill-current" />
                <span>Execute in Terminal</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
