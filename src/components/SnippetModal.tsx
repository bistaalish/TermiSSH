import React, { useState, useEffect } from 'react';
import { X, Code } from 'lucide-react';
import type { CommandSnippet } from '../types';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snippet: Partial<CommandSnippet>) => Promise<void> | void;
  initialData?: CommandSnippet | null;
}

export const SnippetModal: React.FC<SnippetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('Sysadmin');
  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    'Sysadmin',
    'Docker & Containers',
    'Git & Version Control',
    'Network & Diagnostics',
    'Security & Audit',
    'Database Maintenance',
    'Custom Scripts',
  ];

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setCommand(initialData.command || '');
      setCategory(initialData.category || 'Sysadmin');
      setTagsInput(initialData.tags?.join(', ') || '');
    } else {
      setTitle('');
      setDescription('');
      setCommand('');
      setCategory('Sysadmin');
      setTagsInput('');
    }
    setErrors({});
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!command.trim()) errs.command = 'Command script is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        command: command.trim(),
        category,
        tags,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save snippet:', err);
      setErrors({ form: typeof err === 'string' ? err : 'Failed to save snippet' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
              <Code size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">
              {initialData ? 'Edit Snippet' : 'New Command Snippet'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs bg-[#0a0a0a]">
          <div>
            <label className="block font-medium text-[#938a87] mb-1">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Restart Docker Nginx Container"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              autoFocus
            />
            {errors.title && <p className="text-[11px] text-rose-400 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#938a87] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-[#19191a] text-[#f4f4f5]">
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#938a87] mb-1">Tags</label>
              <input
                type="text"
                placeholder="docker, nginx, reload"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-[#938a87]">
                Command Script <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-[#938a87] font-mono">
                Support variables: {'{{var_name:default}}'}
              </span>
            </div>
            <textarea
              rows={5}
              placeholder="docker restart {{container:web_app}} && docker logs -f --tail {{lines:100}} {{container:web_app}}"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs font-mono text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
            />
            {errors.command && <p className="text-[11px] text-rose-400 mt-1">{errors.command}</p>}
          </div>

          <div>
            <label className="block font-medium text-[#938a87] mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="What this command does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
            />
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
              className="px-5 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              {initialData ? 'Update Snippet' : 'Save Snippet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
