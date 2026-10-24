import React, { useState, useMemo, useCallback } from 'react';
import type { TerminalTab, HostConfig, CommandSnippet } from '../types';
import { TerminalView } from './TerminalView';
import { SnippetRunModal } from './SnippetRunModal';
import { SnippetModal } from './SnippetModal';
import {
  X,
  Plus,
  Columns,
  Rows,
  Radio,
  RotateCw,
  AlertTriangle,
  Server,
  Activity,
  Maximize2,
  Minimize2,
  Terminal,
  Cable,
  Code2,
  Play,
  Copy,
  Check,
  Search,
  ArrowDownToLine,
  Variable,
} from 'lucide-react';

interface TerminalManagerProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  hosts: HostConfig[];
  snippets?: CommandSnippet[];
  onExecuteSnippet?: (command: string, sendNewline?: boolean) => void;
  onSaveSnippet?: (snippet: Partial<CommandSnippet>) => Promise<void> | void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onReconnectTab: (id: string) => void;
  onNewTab: () => void;
  onNewLocalTab?: () => void;
  splitLayout: 'single' | 'split-vertical' | 'split-horizontal';
  onSetSplitLayout: (layout: 'single' | 'split-vertical' | 'split-horizontal') => void;
  syncInput: boolean;
  onToggleSyncInput: (enabled: boolean) => void;
}

export const TerminalManager: React.FC<TerminalManagerProps> = ({
  tabs,
  activeTabId,
  hosts,
  snippets = [],
  onExecuteSnippet,
  onSaveSnippet,
  onSelectTab,
  onCloseTab,
  onReconnectTab,
  onNewTab,
  onNewLocalTab,
  splitLayout,
  onSetSplitLayout,
  syncInput,
  onToggleSyncInput,
}) => {
  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSnippetsSection, setShowSnippetsSection] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [runningSnippet, setRunningSnippet] = useState<CommandSnippet | null>(null);
  const [showNewSnippetModal, setShowNewSnippetModal] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [executedSnippetId, setExecutedSnippetId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeHost = activeTab ? hosts.find((h) => h.id === activeTab.hostId) : null;
  const hostDisplayName = activeTab
    ? activeTab.isLocal || activeTab.hostId === 'local'
      ? 'Local Shell'
      : activeHost?.name || activeTab.title
    : 'None';

  const categories = useMemo(() => {
    if (!snippets) return ['All'];
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['All', ...Array.from(set)];
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    if (!snippets) return [];
    return snippets.filter((s) => {
      const matchSearch =
        s.title.toLowerCase().includes(snippetSearch.toLowerCase()) ||
        s.command.toLowerCase().includes(snippetSearch.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(snippetSearch.toLowerCase())) ||
        (s.tags && s.tags.some((t) => t.toLowerCase().includes(snippetSearch.toLowerCase())));
      const matchCategory = selectedCategory === 'All' || s.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [snippets, snippetSearch, selectedCategory]);

  const hasVariables = (cmd: string) => /\{\{([^}]+)\}\}/.test(cmd);

  const handleRunSnippet = (snip: CommandSnippet) => {
    if (hasVariables(snip.command)) {
      setRunningSnippet(snip);
    } else {
      if (onExecuteSnippet) {
        onExecuteSnippet(snip.command, true);
        setExecutedSnippetId(snip.id);
        setTimeout(() => setExecutedSnippetId(null), 1500);
      }
    }
  };

  const handleInsertSnippet = (snip: CommandSnippet) => {
    if (hasVariables(snip.command)) {
      setRunningSnippet(snip);
    } else {
      if (onExecuteSnippet) {
        onExecuteSnippet(snip.command, false);
        setExecutedSnippetId(snip.id);
        setTimeout(() => setExecutedSnippetId(null), 1500);
      }
    }
  };

  const handleCopySnippet = (id: string, command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedSnippetId(id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const handleExit = useCallback(
    (tabId: string) => {
      onReconnectTab(tabId);
    },
    [onReconnectTab]
  );

  const getStatusColor = (status: TerminalTab['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-400 shadow-emerald-400/50';
      case 'connecting':
        return 'bg-amber-400 animate-ping';
      case 'error':
        return 'bg-rose-500 shadow-rose-500/50';
      default:
        return 'bg-slate-500';
    }
  };

  const handleSyncToggle = () => {
    if (!syncInput) {
      setShowSyncWarning(true);
    } else {
      onToggleSyncInput(false);
    }
  };

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] text-[#938a87] p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#19191a] border border-[#2a2a2a] flex items-center justify-center text-[#f4f4f5] mb-4 shadow-xl shadow-black">
          <Terminal size={32} />
        </div>
        <h3 className="text-base font-semibold text-[#f4f4f5] mb-1">Local & Remote Terminal Sessions</h3>
        <p className="text-xs text-[#605e5e] max-w-sm text-center mb-6">
          Open a local Linux shell or connect to saved remote SSH & Telnet servers.
        </p>
        <div className="flex items-center space-x-3">
          {onNewLocalTab && (
            <button
              onClick={onNewLocalTab}
              className="px-4 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
            >
              <Terminal size={15} />
              <span>Open Local Terminal</span>
            </button>
          )}
          <button
            onClick={onNewTab}
            className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] border border-[#2a2a2a] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Connect Remote Host</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Top Session Tab Bar */}
      <div className="h-10 bg-[#19191a] border-b border-[#2a2a2a] flex items-center justify-between px-2 select-none shrink-0">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-1 py-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-[#2a2a2a] text-[#f4f4f5] border-[#363636] shadow-xs'
                    : 'text-[#605e5e] hover:text-[#938a87] hover:bg-[#222223] border-transparent'
                }`}
              >
                {/* Status Dot */}
                <span className={`w-2 h-2 rounded-full ${getStatusColor(tab.status)} shadow-xs`} />
                {tab.isLocal || tab.hostId === 'local' ? (
                  <Terminal size={12} className="text-[#f4f4f5] shrink-0" />
                ) : tab.protocol === 'serial' ? (
                  <Cable size={12} className="text-amber-400 shrink-0" />
                ) : (
                  <Server size={12} className="text-[#938a87] shrink-0" />
                )}
                <span className="truncate max-w-[130px]">{tab.title}</span>

                {/* Tab Controls */}
                <div className="flex items-center space-x-1 opacity-70 group-hover:opacity-100">
                  {tab.status === 'disconnected' || tab.status === 'error' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReconnectTab(tab.id);
                      }}
                      title="Reconnect Session"
                      className="p-0.5 hover:text-[#f4f4f5] rounded transition-colors"
                    >
                      <RotateCw size={11} />
                    </button>
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    title="Close Tab"
                    className="p-0.5 hover:text-rose-400 rounded transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {onNewLocalTab && (
            <button
              onClick={onNewLocalTab}
              title="Open Local Shell Tab"
              className="px-2.5 py-1 text-xs font-semibold text-[#f4f4f5] bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] rounded-md transition-all cursor-pointer flex items-center space-x-1 shadow-xs"
            >
              <Terminal size={12} />
              <span>+ Local</span>
            </button>
          )}

          <button
            onClick={onNewTab}
            title="Open Remote Host Tab"
            className="p-1.5 text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center space-x-1.5 pl-2 shrink-0">
          {/* Synchronized Input Toggle */}
          <button
            onClick={handleSyncToggle}
            title={syncInput ? 'Synchronized Input ON (Broadcasting keys)' : 'Synchronized Input OFF'}
            className={`p-1.5 rounded-md text-xs flex items-center space-x-1 transition-all cursor-pointer ${
              syncInput
                ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 animate-pulse'
                : 'text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a]'
            }`}
          >
            <Radio size={13} className={syncInput ? 'text-rose-400' : 'text-[#938a87]'} />
            <span className="text-[11px] font-semibold">{syncInput ? 'Sync ON' : 'Sync'}</span>
          </button>

          <div className="h-4 w-[1px] bg-[#2a2a2a] mx-1" />

          {/* Split Panes Toggle */}
          <div className="flex items-center bg-[#0a0a0a] p-0.5 rounded-md border border-[#2a2a2a]">
            <button
              onClick={() => onSetSplitLayout('single')}
              title="Single Pane"
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                splitLayout === 'single' ? 'bg-[#2a2a2a] text-[#f4f4f5]' : 'text-[#605e5e] hover:text-[#938a87]'
              }`}
            >
              <span className="text-[10px] font-bold px-0.5">1x</span>
            </button>
            <button
              onClick={() => onSetSplitLayout('split-vertical')}
              title="Split Vertical (Columns)"
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                splitLayout === 'split-vertical' ? 'bg-[#2a2a2a] text-[#f4f4f5]' : 'text-[#605e5e] hover:text-[#938a87]'
              }`}
            >
              <Columns size={12} />
            </button>
            <button
              onClick={() => onSetSplitLayout('split-horizontal')}
              title="Split Horizontal (Rows)"
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                splitLayout === 'split-horizontal' ? 'bg-[#2a2a2a] text-[#f4f4f5]' : 'text-[#605e5e] hover:text-[#938a87]'
              }`}
            >
              <Rows size={12} />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[#2a2a2a] mx-1" />

          {/* Snippets Section Toggle Button */}
          <button
            onClick={() => setShowSnippetsSection((prev) => !prev)}
            title={showSnippetsSection ? 'Hide Snippets Section' : 'Open Snippets Section to run commands on this host'}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              showSnippetsSection
                ? 'bg-[#2a2a2a] text-[#f4f4f5] border-[#363636] shadow-xs'
                : 'text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] border-transparent'
            }`}
          >
            <Code2 size={13} className={showSnippetsSection ? 'text-[#f4f4f5]' : 'text-[#938a87]'} />
            <span>Snippets</span>
            {snippets.length > 0 && (
              <span className="text-[10px] bg-[#0a0a0a] text-[#938a87] px-1.5 py-0.2 rounded font-mono border border-[#2a2a2a]">
                {snippets.length}
              </span>
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Synchronized Input Safety Warning Modal */}
      {showSyncWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-[#363636] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle size={22} />
              </div>
              <h4 className="text-base font-semibold text-[#f4f4f5]">Broadcast Input Warning</h4>
            </div>
            <p className="text-xs text-[#938a87] leading-relaxed">
              Synchronized input sends every keystroke simultaneously to <span className="text-rose-400 font-bold">ALL</span> open terminal panes.
              Commands like <code className="bg-[#0a0a0a] border border-[#2a2a2a] px-1 py-0.5 rounded text-rose-300">rm</code>, <code className="bg-[#0a0a0a] border border-[#2a2a2a] px-1 py-0.5 rounded text-rose-300">reboot</code>, or database modifications will execute on multiple servers at once.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowSyncWarning(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#0a0a0a] hover:bg-[#222223] text-[#938a87] hover:text-[#f4f4f5] border border-[#2a2a2a] text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSyncWarning(false);
                  onToggleSyncInput(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                Enable Broadcast Input
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Terminal View Area with Collapsible Snippets Drawer */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0 min-w-0">
        {/* Terminal Work Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[#0a0a0a] min-h-0 min-w-0">
          {/* Status Overlays */}
          {activeTab && activeTab.status === 'connecting' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-[#19191a]/95 border border-[#363636] text-[#f4f4f5] text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center space-x-2.5 backdrop-blur-md pointer-events-none">
              <div className="w-3 h-3 border-2 border-[#f4f4f5] border-t-transparent rounded-full animate-spin" />
              <span>Connecting to {activeTab.title}...</span>
            </div>
          )}

          {activeTab && activeTab.status === 'error' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-3 backdrop-blur-md">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              <span>{activeTab.error || 'Connection failed'}</span>
              <button
                onClick={() => onReconnectTab(activeTab.id)}
                className="px-2.5 py-1 rounded-md bg-rose-800 hover:bg-rose-700 text-white font-medium text-[11px] cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {splitLayout === 'single' ? (
            // Single Tab View
            tabs.map((tab) => (
              <TerminalView
                key={tab.id}
                sessionId={tab.sessionId || tab.id}
                isActive={tab.id === activeTabId}
                theme={activeHost?.terminalTheme || 'dark'}
                fontSize={activeHost?.fontSize || 14}
                onExit={() => handleExit(tab.id)}
              />
            ))
          ) : splitLayout === 'split-vertical' ? (
            // Split Vertical View (2 Panes side-by-side)
            <div className="flex-1 flex flex-row divide-x divide-[#2a2a2a] h-full min-h-0 min-w-0">
              {tabs.slice(0, 2).map((tab) => (
                <div
                  key={tab.id}
                  className={`flex-1 h-full relative min-h-0 min-w-0 ${
                    tab.id === activeTabId ? 'ring-1 ring-[#938a87] z-10' : ''
                  }`}
                  onClick={() => onSelectTab(tab.id)}
                >
                  <TerminalView
                    key={tab.id}
                    sessionId={tab.sessionId || tab.id}
                    isActive={true}
                    theme={activeHost?.terminalTheme || 'dark'}
                    fontSize={activeHost?.fontSize || 13}
                    onExit={() => handleExit(tab.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            // Split Horizontal View (2 Panes stacked)
            <div className="flex-1 flex flex-col divide-y divide-[#2a2a2a] h-full min-h-0 min-w-0">
              {tabs.slice(0, 2).map((tab) => (
                <div
                  key={tab.id}
                  className={`flex-1 h-full relative min-h-0 min-w-0 ${
                    tab.id === activeTabId ? 'ring-1 ring-[#938a87] z-10' : ''
                  }`}
                  onClick={() => onSelectTab(tab.id)}
                >
                  <TerminalView
                    key={tab.id}
                    sessionId={tab.sessionId || tab.id}
                    isActive={true}
                    theme={activeHost?.terminalTheme || 'dark'}
                    fontSize={activeHost?.fontSize || 13}
                    onExit={() => handleExit(tab.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Snippets Drawer Panel */}
        {showSnippetsSection && (
          <aside className="w-80 md:w-96 border-l border-[#2a2a2a] bg-[#19191a] flex flex-col h-full z-20 shrink-0">
            {/* Header */}
            <div className="h-12 px-3.5 border-b border-[#2a2a2a] flex items-center justify-between shrink-0 bg-[#19191a]">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#2a2a2a] border border-[#363636] flex items-center justify-center text-[#938a87] shrink-0">
                  <Code2 size={14} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="text-xs font-bold text-[#f4f4f5]">Snippets</h4>
                    <span className="text-[10px] font-mono text-[#938a87] bg-[#0a0a0a] px-1.5 py-0.2 rounded border border-[#2a2a2a]">
                      {filteredSnippets.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#605e5e] truncate">
                    Target: <span className="text-[#938a87] font-medium">{hostDisplayName}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {onSaveSnippet && (
                  <button
                    onClick={() => setShowNewSnippetModal(true)}
                    title="Create New Snippet"
                    className="p-1 text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] rounded cursor-pointer transition-colors"
                  >
                    <Plus size={15} />
                  </button>
                )}
                <button
                  onClick={() => setShowSnippetsSection(false)}
                  title="Close Snippets Section"
                  className="p-1 text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] rounded cursor-pointer transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Search & Categories */}
            <div className="p-2.5 border-b border-[#2a2a2a] space-y-2 shrink-0 bg-[#19191a]">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#605e5e]" />
                <input
                  type="text"
                  placeholder="Filter snippets..."
                  value={snippetSearch}
                  onChange={(e) => setSnippetSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#0a0a0a] border border-[#2a2a2a] rounded-md text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] transition-colors"
                />
                {snippetSearch && (
                  <button
                    onClick={() => setSnippetSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors border ${
                      selectedCategory === cat
                        ? 'bg-[#2a2a2a] text-[#f4f4f5] border-[#363636]'
                        : 'text-[#605e5e] hover:text-[#938a87] border-transparent hover:bg-[#222223]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Snippet Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {filteredSnippets.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                  <Code2 size={28} className="text-[#363636] mb-2" />
                  <p className="text-xs text-[#938a87] font-medium">No snippets found</p>
                  <p className="text-[11px] text-[#605e5e] mt-1">
                    {snippetSearch ? 'Try a different search term.' : 'Create reusable commands for this host.'}
                  </p>
                  {onSaveSnippet && (
                    <button
                      onClick={() => setShowNewSnippetModal(true)}
                      className="mt-3 px-3 py-1.5 rounded-md bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={13} />
                      <span>Create Snippet</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredSnippets.map((snip) => {
                  const hasVars = hasVariables(snip.command);
                  const isExecuted = executedSnippetId === snip.id;
                  const isCopied = copiedSnippetId === snip.id;

                  return (
                    <div
                      key={snip.id}
                      className="group rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] hover:border-[#363636] p-2.5 transition-all shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-semibold text-[#f4f4f5] truncate">
                              {snip.title}
                            </h5>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="text-[9px] text-[#938a87] bg-[#19191a] px-1.5 py-0.2 rounded border border-[#2a2a2a]">
                                {snip.category}
                              </span>
                              {hasVars && (
                                <span className="text-[9px] text-amber-400/90 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40 flex items-center space-x-0.5">
                                  <Variable size={9} />
                                  <span>Parameterized</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick copy */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySnippet(snip.id, snip.command);
                            }}
                            title="Copy command to clipboard"
                            className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#19191a] transition-colors cursor-pointer"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>

                        {snip.description && (
                          <p className="text-[10px] text-[#605e5e] italic mt-1 line-clamp-2">
                            {snip.description}
                          </p>
                        )}

                        {/* Code Preview */}
                        <div className="mt-2 p-1.5 rounded bg-[#141415] border border-[#222224] font-mono text-[11px] text-[#938a87] group-hover:text-[#f4f4f5] overflow-x-auto no-scrollbar max-h-20 select-text">
                          <code>{snip.command}</code>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-2.5 pt-2 border-t border-[#1c1c1e] flex items-center justify-between">
                        <span className="text-[10px] text-[#605e5e] truncate max-w-[130px]">
                          Target: {hostDisplayName}
                        </span>

                        <div className="flex items-center space-x-1.5">
                          {/* Insert without enter */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInsertSnippet(snip);
                            }}
                            disabled={!activeTab || activeTab.status !== 'connected'}
                            title="Insert into terminal prompt without pressing Enter"
                            className="px-2 py-1 rounded bg-[#19191a] hover:bg-[#2a2a2a] disabled:opacity-40 text-[#938a87] hover:text-[#f4f4f5] border border-[#2a2a2a] text-[10px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                          >
                            <ArrowDownToLine size={10} />
                            <span>Insert</span>
                          </button>

                          {/* Run button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunSnippet(snip);
                            }}
                            disabled={!activeTab || activeTab.status !== 'connected'}
                            title={hasVars ? 'Configure variables and run on host' : `Run on ${hostDisplayName}`}
                            className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1 cursor-pointer transition-all border shadow-xs ${
                              isExecuted
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : 'bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border-[#363636] hover:border-[#938a87] disabled:opacity-40'
                            }`}
                          >
                            {isExecuted ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span>Sent!</span>
                              </>
                            ) : (
                              <>
                                <Play size={10} className="fill-current text-[#f4f4f5]" />
                                <span>Run</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Terminal Status Footer */}
      {activeTab && (
        <div className="h-6 bg-[#19191a] border-t border-[#2a2a2a] px-3 flex items-center justify-between text-[11px] text-[#605e5e] select-none shrink-0">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1.5">
              <Activity size={11} className={activeTab.status === 'connected' ? 'text-[#f4f4f5]' : 'text-amber-400'} />
              <span className="capitalize text-[#938a87]">{activeTab.status}</span>
            </span>
            {activeTab.isLocal || activeTab.hostId === 'local' ? (
              <>
                <span className="text-[#363636]">|</span>
                <span className="font-mono text-[10px] text-[#f4f4f5]">
                  localhost (Local Linux Shell)
                </span>
                <span className="text-[#363636]">|</span>
                <span className="text-[10px] text-[#938a87] uppercase tracking-wider font-semibold">
                  PTY: $SHELL
                </span>
              </>
            ) : activeHost?.protocol === 'serial' || activeTab.protocol === 'serial' ? (
              <>
                <span className="text-[#363636]">|</span>
                <span className="font-mono text-[10px] text-amber-300 flex items-center space-x-1">
                  <Cable size={11} className="text-amber-400" />
                  <span>Serial: {activeHost?.hostname || 'UART'}</span>
                </span>
                <span className="text-[#363636]">|</span>
                <span className="text-[10px] text-[#938a87] uppercase tracking-wider font-semibold">
                  UART: {activeHost?.baudRate || activeTab.baudRate || 9600} baud (8{activeHost?.parity ? activeHost.parity[0].toUpperCase() : 'N'}{activeHost?.stopBits || 1})
                </span>
              </>
            ) : activeHost ? (
              <>
                <span className="text-[#363636]">|</span>
                <span className="font-mono text-[10px] text-[#f4f4f5]">
                  {activeHost.username}@{activeHost.hostname}:{activeHost.port}
                </span>
                <span className="text-[#363636]">|</span>
                <span className="text-[10px] text-[#938a87] uppercase tracking-wider font-semibold">
                  {activeHost.protocol === 'telnet' ? 'Proto: TELNET' : `Auth: ${activeHost.authType}`}
                </span>
              </>
            ) : null}
          </div>
          <div className="flex items-center space-x-3 text-[10px] text-[#605e5e] font-mono">
            <span>UTF-8</span>
            <span>xterm-256color</span>
          </div>
        </div>
      )}

      {/* Parameterized Snippet Execution Modal */}
      {runningSnippet && (
        <SnippetRunModal
          isOpen={!!runningSnippet}
          onClose={() => setRunningSnippet(null)}
          snippet={runningSnippet}
          hasActiveSession={!!activeTab && activeTab.status === 'connected'}
          onExecute={(cmd) => {
            if (onExecuteSnippet) {
              onExecuteSnippet(cmd, true);
              if (runningSnippet) {
                setExecutedSnippetId(runningSnippet.id);
                setTimeout(() => setExecutedSnippetId(null), 1500);
              }
            }
            setRunningSnippet(null);
          }}
        />
      )}

      {/* Quick Add Snippet Modal */}
      {showNewSnippetModal && onSaveSnippet && (
        <SnippetModal
          isOpen={showNewSnippetModal}
          onClose={() => setShowNewSnippetModal(false)}
          onSave={async (snip) => {
            await onSaveSnippet(snip);
            setShowNewSnippetModal(false);
          }}
        />
      )}
    </div>
  );
};
