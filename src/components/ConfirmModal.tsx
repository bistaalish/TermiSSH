import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isAlert?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isAlert = false,
  onConfirm,
  onCancel,
}) => {
  const handleClose = onCancel || onConfirm;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`bg-[#19191a] border ${
          isDestructive
            ? 'border-rose-600/50 shadow-2xl'
            : 'border-[#363636] shadow-2xl'
        } rounded-2xl w-full max-w-md overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`h-14 px-6 border-b flex items-center justify-between ${
            isDestructive
              ? 'bg-[#19191a] border-rose-900/40 text-rose-300'
              : 'bg-[#19191a] border-[#2a2a2a] text-[#f4f4f5]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isDestructive
                  ? 'bg-rose-950/80 text-rose-400 border-rose-600/40'
                  : 'bg-[#2a2a2a] text-[#f4f4f5] border-[#363636]'
              }`}
            >
              {isDestructive ? (
                <Trash2 size={18} />
              ) : isAlert ? (
                <AlertCircle size={18} />
              ) : (
                <AlertTriangle size={18} />
              )}
            </div>
            <h3 className="font-bold text-sm tracking-wide">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-[#605e5e] hover:text-[#f4f4f5] rounded cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          <p className="text-[#938a87] leading-relaxed text-sm whitespace-pre-wrap font-sans">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#2a2a2a] flex items-center justify-end space-x-3">
            {!isAlert && (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-semibold cursor-pointer transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await onConfirm();
              }}
              autoFocus
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-lg ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
