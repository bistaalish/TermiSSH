import React, { useState } from 'react';
import type { HostGroup, HostConfig } from '../types';
import { FolderTree, Plus, Trash2, Edit2, Server, X } from 'lucide-react';

interface GroupManagerProps {
  groups: HostGroup[];
  hosts: HostConfig[];
  onSaveGroup: (group: Partial<HostGroup>) => void;
  onDeleteGroup: (id: string) => void;
}

export const GroupManager: React.FC<GroupManagerProps> = ({
  groups,
  hosts,
  onSaveGroup,
  onDeleteGroup,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<HostGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);

  const colors = [
    '#3b82f6', // blue
    '#00e5ff', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // rose
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#64748b', // slate
  ];

  const handleOpenModal = (g?: HostGroup) => {
    if (g) {
      setEditingGroup(g);
      setName(g.name);
      setDescription(g.description || '');
      setColor(g.color || '#3b82f6');
    } else {
      setEditingGroup(null);
      setName('');
      setDescription('');
      setColor('#3b82f6');
    }
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    onSaveGroup({
      id: editingGroup?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
    setShowModal(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#363636] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <FolderTree className="text-[#938a87]" size={22} />
            <span>Host Groups & Categorization</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Organize servers by department, infrastructure layer, geographic region, or client environment.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>New Group</span>
        </button>
      </div>

      {/* Grid */}
      <div className="p-6 flex-1">
        {groups.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <FolderTree size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#f4f4f5]">No host groups configured</p>
            <p className="text-xs text-[#938a87] mt-1">
              Create a group to organize your servers into functional clusters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const assignedHosts = hosts.filter((h) => h.groupId === group.id);

              return (
                <div
                  key={group.id}
                  className="bg-[#19191a] border border-[#363636] hover:border-[#605e5e] rounded-xl p-4 flex flex-col justify-between shadow-lg transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: `${group.color || '#3b82f6'}25`, border: `1px solid ${group.color || '#3b82f6'}50` }}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: group.color || '#3b82f6' }}
                          />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#f4f4f5]">{group.name}</h3>
                          <span className="text-[11px] text-[#938a87]">
                            {assignedHosts.length} {assignedHosts.length === 1 ? 'host' : 'hosts'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenModal(group)}
                          className="p-1 rounded text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteGroup(group.id)}
                          className="p-1 rounded text-[#938a87] hover:text-rose-400 hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-[11px] text-[#938a87] italic mt-2.5">
                        {group.description}
                      </p>
                    )}

                    {/* Assigned Hosts Preview */}
                    <div className="mt-3.5 space-y-1">
                      {assignedHosts.slice(0, 3).map((h) => (
                        <div
                          key={h.id}
                          className="p-1.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] flex items-center space-x-2"
                        >
                          <Server size={11} className="text-[#938a87] shrink-0" />
                          <span className="truncate">{h.name}</span>
                        </div>
                      ))}
                      {assignedHosts.length > 3 && (
                        <div className="text-[10px] text-[#605e5e] pl-1">
                          +{assignedHosts.length - 3} more hosts
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="h-14 px-6 border-b border-[#363636] flex items-center justify-between bg-[#19191a]">
              <h3 className="text-sm font-bold text-[#f4f4f5] flex items-center space-x-2">
                <FolderTree size={16} className="text-[#938a87]" />
                <span>{editingGroup ? 'Edit Host Group' : 'New Host Group'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-medium text-[#938a87] mb-1">
                  Group Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. AWS Production Cluster"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#363636] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#938a87] transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-medium text-[#938a87] mb-1.5">Group Color Badge</label>
                <div className="flex items-center space-x-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#938a87] mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Description of this host group..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#363636] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#938a87] transition-colors"
                />
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
                  {editingGroup ? 'Update Group' : 'Save Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
