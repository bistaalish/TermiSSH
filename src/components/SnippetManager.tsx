import React, { useState, useMemo } from 'react';
import type { CommandSnippet } from '../types';
import {
  Code,
  Plus,
  Search,
  Play,
  Copy,
  Trash2,
  Edit2,
  Check,
  Tag,
} from 'lucide-react';
import { SnippetModal } from './SnippetModal';
import { SnippetRunModal } from './SnippetRunModal';

interface SnippetManagerProps {
  snippets: CommandSnippet[];
  hasActiveSession: boolean;
  onExecuteSnippet: (command: string) => void;
  onSaveSnippet: (snippet: Partial<CommandSnippet>) => void;
  onDeleteSnippet: (id: string) => void;
}

export const SnippetManager: React.FC<SnippetManagerProps> = ({
  snippets,
  hasActiveSession,
  onExecuteSnippet,
  onSaveSnippet,
  onDeleteSnippet,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<CommandSnippet | null>(null);
  const [runningSnippet, setRunningSnippet] = useState<CommandSnippet | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => set.add(s.category));
    return ['All', ...Array.from(set)];
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      const matchSearch =
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.command.toLowerCase().includes(search.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(search.toLowerCase())) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [snippets, search, selectedCategory]);

  const handleCopy = (id: string, command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#2a2a2a] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <Code className="text-[#938a87]" size={22} />
            <span>Command Snippets Library</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Store, parameterize with variables, and insert frequently used commands into active terminal sessions.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingSnippet(null);
            setShowEditModal(true);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>New Snippet</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-6 pb-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#605e5e]" />
            <input
              type="text"
              placeholder="Search snippet by title, script, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-[#2a2a2a] border border-[#363636] text-[#f4f4f5]'
                    : 'bg-[#0a0a0a] text-[#605e5e] hover:text-[#938a87] border border-[#2a2a2a]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Snippet Grid */}
      <div className="p-6 flex-1">
        {filteredSnippets.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <Code size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#938a87]">No snippets found</p>
            <p className="text-xs text-[#605e5e] mt-1">
              Add your first script snippet with parameters like {'{{variable}}'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="bg-[#19191a] border border-[#2a2a2a] hover:border-[#363636] rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#f4f4f5]">{snippet.title}</h3>
                      <span className="text-[10px] uppercase font-semibold text-[#f4f4f5] bg-[#2a2a2a] px-1.5 py-0.5 rounded border border-[#363636]">
                        {snippet.category}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingSnippet(snippet);
                          setShowEditModal(true);
                        }}
                        className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDeleteSnippet(snippet.id)}
                        className="p-1 rounded text-[#605e5e] hover:text-rose-400 hover:bg-[#222223] cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {snippet.description && (
                    <p className="text-[11px] text-[#605e5e] italic mt-2 line-clamp-1">
                      {snippet.description}
                    </p>
                  )}

                  {/* Command box */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] font-mono text-[#f4f4f5] text-xs overflow-x-auto select-all">
                    <code>{snippet.command}</code>
                  </div>

                  {/* Tags */}
                  {snippet.tags && snippet.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {snippet.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center space-x-1 text-[10px] bg-[#0a0a0a] text-[#938a87] px-1.5 py-0.5 rounded border border-[#2a2a2a]"
                        >
                          <Tag size={9} />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-[#2a2a2a] flex items-center space-x-2">
                  <button
                    onClick={() => setRunningSnippet(snippet)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Play size={12} className="fill-current" />
                    <span>Run Snippet</span>
                  </button>

                  <button
                    onClick={() => handleCopy(snippet.id, snippet.command)}
                    className="py-1.5 px-2.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium border border-[#2a2a2a] transition-colors cursor-pointer"
                    title="Copy Command"
                  >
                    {copiedId === snippet.id ? (
                      <Check size={14} className="text-[#f4f4f5]" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit / New Modal */}
      <SnippetModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={(s) => onSaveSnippet(s)}
        initialData={editingSnippet}
      />

      {/* Parameterized Run Modal */}
      <SnippetRunModal
        isOpen={!!runningSnippet}
        onClose={() => setRunningSnippet(null)}
        snippet={runningSnippet}
        hasActiveSession={hasActiveSession}
        onExecute={onExecuteSnippet}
      />
    </div>
  );
};
