import React, { useState } from 'react';
import type { WorkspaceItem, HostConfig } from '../types';
import {
  LayoutGrid,
  Plus,
  Play,
  Trash2,
  Server,
  X,
  Columns,
  Rows,
} from 'lucide-react';

interface WorkspacesManagerProps {
  workspaces: WorkspaceItem[];
  hosts: HostConfig[];
  onLaunch: (workspace: WorkspaceItem) => void;
  onSave: (workspace: Partial<WorkspaceItem>) => void;
  onDelete: (id: string) => void;
}

export const WorkspacesManager: React.FC<WorkspacesManagerProps> = ({
  workspaces,
  hosts,
  onLaunch,
  onSave,
  onDelete,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<WorkspaceItem['environment']>('production');
  const [layout, setLayout] = useState<WorkspaceItem['layout']>('split-vertical');
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleToggleHost = (id: string) => {
    if (selectedHostIds.includes(id)) {
      setSelectedHostIds(selectedHostIds.filter((h) => h !== id));
    } else {
      setSelectedHostIds([...selectedHostIds, id]);
    }
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    if (selectedHostIds.length === 0) {
      setError('Select at least one host for this workspace');
      return;
    }

    onSave({
      name: name.trim(),
      environment,
      layout,
      panes: selectedHostIds.map((hostId) => ({ hostId })),
    });

    setShowModal(false);
    setName('');
    setSelectedHostIds([]);
    setError(null);
  };

  const getEnvBadge = (env: WorkspaceItem['environment']) => {
    switch (env) {
      case 'production':
        return (
          <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
            Production
          </span>
        );
      case 'staging':
        return (
          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            Staging
          </span>
        );
      case 'development':
        return (
          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            Development
          </span>
        );
      default:
        return (
          <span className="text-[10px] uppercase font-bold text-[#938a87] bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#363636]">
            General
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#363636] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <LayoutGrid className="text-[#938a87]" size={22} />
            <span>Productivity Workspaces</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Group multi-server environments and launch coordinated split terminal layouts with one click.
          </p>
        </div>

        <button
          onClick={() => {
            setName('');
            setSelectedHostIds([]);
            setShowModal(true);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>New Workspace</span>
        </button>
      </div>

      {/* Workspaces Grid */}
      <div className="p-6 flex-1">
        {workspaces.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <LayoutGrid size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#f4f4f5]">No workspaces configured</p>
            <p className="text-xs text-[#938a87] mt-1">
              Create a workspace to group related servers (e.g. database cluster or microservices).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="bg-[#19191a] border border-[#363636] hover:border-[#605e5e] rounded-xl p-4 flex flex-col justify-between shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#f4f4f5]">{ws.name}</h3>
                      <div className="mt-1 flex items-center space-x-2">
                        {getEnvBadge(ws.environment)}
                        <span className="text-[11px] text-[#938a87] flex items-center space-x-1">
                          {ws.layout === 'split-vertical' ? <Columns size={12} /> : <Rows size={12} />}
                          <span className="capitalize">{ws.layout.replace('-', ' ')}</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(ws.id)}
                      className="p-1 rounded text-[#605e5e] hover:text-rose-400 hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Panes / Host list */}
                  <div className="mt-4 space-y-1.5">
                    <span className="text-[10px] text-[#938a87] font-semibold uppercase tracking-wider block">
                      Associated Hosts ({ws.panes.length})
                    </span>
                    <div className="space-y-1">
                      {ws.panes.map((pane) => {
                        const h = hosts.find((host) => host.id === pane.hostId);
                        return (
                          <div
                            key={pane.hostId}
                            className="p-1.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] flex items-center space-x-2"
                          >
                            <Server size={12} className="text-[#938a87] shrink-0" />
                            <span className="font-medium truncate">{h ? h.name : 'Unknown Host'}</span>
                            {h && (
                              <span className="text-[10px] text-[#605e5e] truncate font-mono">
                                ({h.username}@{h.hostname})
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Launch Button */}
                <div className="mt-5 pt-3 border-t border-[#2a2a2a]">
                  <button
                    onClick={() => onLaunch(ws)}
                    className="w-full py-2 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] text-xs font-bold flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Play size={13} className="fill-current" />
                    <span>Launch Workspace</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Workspace Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl shadow-black overflow-hidden flex flex-col">
            <div className="h-14 px-6 border-b border-[#363636] flex items-center justify-between bg-[#19191a]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#938a87] border border-[#363636] flex items-center justify-center shadow-xs">
                  <LayoutGrid size={18} />
                </div>
                <h3 className="text-sm font-bold text-[#f4f4f5]">Create New Workspace</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-medium text-[#938a87] mb-1">
                  Workspace Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Web Cluster Production"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#363636] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#938a87] transition-colors"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Environment</label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as any)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#363636] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#938a87] transition-colors"
                  >
                    <option value="production" className="bg-[#19191a] text-[#f4f4f5]">Production</option>
                    <option value="staging" className="bg-[#19191a] text-[#f4f4f5]">Staging</option>
                    <option value="development" className="bg-[#19191a] text-[#f4f4f5]">Development</option>
                    <option value="general" className="bg-[#19191a] text-[#f4f4f5]">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#938a87] mb-1">Terminal Layout</label>
                  <select
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as any)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#363636] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#938a87] transition-colors"
                  >
                    <option value="split-vertical" className="bg-[#19191a] text-[#f4f4f5]">Split Vertical (Columns)</option>
                    <option value="split-horizontal" className="bg-[#19191a] text-[#f4f4f5]">Split Horizontal (Rows)</option>
                    <option value="single" className="bg-[#19191a] text-[#f4f4f5]">Single Tabs</option>
                  </select>
                </div>
              </div>

              {/* Host Selector */}
              <div>
                <label className="block font-medium text-[#938a87] mb-1.5">
                  Select Hosts to Launch in Workspace <span className="text-rose-400">*</span>
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-lg bg-[#0a0a0a] border border-[#363636]">
                  {hosts.map((h) => {
                    const isChecked = selectedHostIds.includes(h.id);
                    return (
                      <div
                        key={h.id}
                        onClick={() => handleToggleHost(h.id)}
                        className={`p-2 rounded-md flex items-center justify-between cursor-pointer transition-colors ${
                          isChecked ? 'bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636]' : 'hover:bg-[#19191a] text-[#938a87]'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Server size={13} className={isChecked ? 'text-[#f4f4f5]' : 'text-[#605e5e]'} />
                          <span className="font-medium truncate">{h.name}</span>
                          <span className="text-[10px] text-[#605e5e] truncate font-mono">
                            ({h.username}@{h.hostname})
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded accent-[#938a87]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#363636] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#0a0a0a] hover:bg-[#2a2a2a] border border-[#363636] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
