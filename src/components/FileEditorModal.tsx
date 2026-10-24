import React, { useState, useEffect } from 'react';
import { X, Save, FileCode, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface FileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostId: string;
  remotePath: string;
  fileName: string;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  onClose,
  hostId,
  remotePath,
  fileName,
}) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    api.sftpReadFile(hostId, remotePath)
      .then((data) => {
        setContent(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(typeof err === 'string' ? err : 'Failed to read file from remote server');
        setLoading(false);
      });
  }, [isOpen, hostId, remotePath]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.sftpWriteFile(hostId, remotePath, content);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]">
              <FileCode size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center space-x-2">
                <span>{fileName}</span>
                {success && (
                  <span className="text-[10px] text-[#f4f4f5] bg-[#2a2a2a] border border-[#363636] px-1.5 py-0.5 rounded font-mono">
                    Saved!
                  </span>
                )}
              </h3>
              <p className="text-[11px] font-mono text-[#938a87] truncate max-w-md">
                {remotePath}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] disabled:opacity-50 text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{saving ? 'Saving...' : 'Save Remote'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#605e5e]">
              <Loader2 size={28} className="animate-spin text-[#938a87] mb-2" />
              <p className="text-xs">Loading remote file content...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-rose-400 bg-rose-950/20 border border-rose-900/40 m-6 rounded-xl text-xs">
              <p className="font-bold mb-1">Error reading file:</p>
              <p className="font-mono">{error}</p>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-4 bg-[#0a0a0a] text-[#f4f4f5] font-mono text-xs focus:outline-none resize-none selection:bg-[#2a2a2a] leading-relaxed"
              spellCheck={false}
            />
          )}
        </div>

        {/* Status bar */}
        <div className="h-7 px-4 bg-[#19191a] border-t border-[#2a2a2a] flex items-center justify-between text-[11px] text-[#605e5e] font-mono shrink-0">
          <span>Lines: {content.split('\n').length}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
};
