import React, { useState, useMemo } from 'react';
import type { HostConfig, HostGroup } from '../types';
import {
  Server,
  Plus,
  Search,
  Play,
  FolderSync,
  MoreVertical,
  Copy,
  Trash2,
  Edit2,
  Tag,
  Shield,
  Layers,
  FileCode,
  Cloud,
  Radio,
  FolderTree,
  Database,
  Cable,
} from 'lucide-react';

interface HostListProps {
  hosts: HostConfig[];
  groups: HostGroup[];
  onConnect: (host: HostConfig) => void;
  onOpenSFTP: (host: HostConfig) => void;
  onEdit: (host: HostConfig) => void;
  onDuplicate: (host: HostConfig) => void;
  onDelete: (id: string) => void;
  onNewHost: () => void;
  onOpenSSHConfig: () => void;
  onOpenBackupRestore: () => void;
}

export const HostList: React.FC<HostListProps> = ({
  hosts,
  groups,
  onConnect,
  onOpenSFTP,
  onEdit,
  onDuplicate,
  onDelete,
  onNewHost,
  onOpenSSHConfig,
  onOpenBackupRestore,
}) => {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredHosts = useMemo(() => {
    return hosts.filter((h) => {
      const matchSearch =
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.hostname.toLowerCase().includes(search.toLowerCase()) ||
        h.username.toLowerCase().includes(search.toLowerCase()) ||
        (h.tags && h.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));
      const matchGroup = selectedGroup === 'all' || h.groupId === selectedGroup;
      return matchSearch && matchGroup;
    });
  }, [hosts, search, selectedGroup]);

  return (
    <div
      className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto"
      onClick={() => {
        if (activeMenuId) setActiveMenuId(null);
      }}
    >
      {/* Header Bar */}
      <div className="p-6 pb-4 border-b border-[#2a2a2a] bg-[#19191a]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#f4f4f5] tracking-tight flex items-center space-x-2">
              <Server className="text-[#938a87]" size={22} />
              <span>SSH, Telnet &amp; Serial Hosts</span>
            </h1>
            <p className="text-xs text-[#938a87] mt-1">
              Manage, organize, and establish encrypted sessions, Telnet links, and hardware serial consoles.
            </p>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              onClick={onOpenBackupRestore}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Backup & Restore application data, hosts, keys, and credentials"
            >
              <Database size={14} className="text-[#938a87]" />
              <span>Backup / Restore</span>
            </button>
            <button
              onClick={onOpenSSHConfig}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] text-xs font-medium border border-[#363636] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="View & Edit ~/.ssh/config directly"
            >
              <FileCode size={14} className="text-[#938a87]" />
              <span>Edit ~/.ssh/config</span>
            </button>
            <button
              onClick={onNewHost}
              className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>Add Host</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#605e5e]" />
            <input
              type="text"
              placeholder="Search by name, IP, username, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] focus:ring-1 focus:ring-[#938a87] transition-all font-mono"
            />
          </div>

          {/* Group Filter Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <label className="text-xs text-[#938a87] flex items-center space-x-1.5 font-medium shrink-0">
              <FolderTree size={14} className="text-[#938a87]" />
              <span>Group:</span>
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs font-medium text-[#f4f4f5] focus:outline-none focus:border-[#363636] transition-all cursor-pointer min-w-[170px]"
            >
              <option value="all" className="bg-[#19191a] text-[#f4f4f5]">
                All Groups ({hosts.length} hosts)
              </option>
              {groups.map((group) => {
                const count = hosts.filter((h) => h.groupId === group.id).length;
                return (
                  <option key={group.id} value={group.id} className="bg-[#19191a] text-[#f4f4f5]">
                    {group.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Host Grid */}
      <div className="p-6 flex-1">
        {filteredHosts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <Server size={36} className="text-[#363636] mb-3" />
            <p className="text-sm font-medium text-[#938a87]">No hosts found</p>
            <p className="text-xs text-[#605e5e] mt-1">
              {search ? 'Try modifying your search query' : 'Get started by creating your first SSH or Telnet host'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHosts.map((host) => {
              const group = groups.find((g) => g.id === host.groupId);
              const isMenuOpen = activeMenuId === host.id;

              return (
                <div
                  key={host.id}
                  className="group relative bg-[#19191a] hover:bg-[#202022] border border-[#2a2a2a] hover:border-[#363636] rounded-xl p-4 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md"
                >
                  <div>
                    {/* Top Row: Name, Group Badge & Context Menu */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#2a2a2a] group-hover:bg-[#363636] flex items-center justify-center text-[#938a87] group-hover:text-[#f4f4f5] border border-[#363636] transition-colors shrink-0">
                          {host.protocol === 'serial' ? (
                            <Cable size={18} className="text-amber-400" />
                          ) : (
                            <Server size={18} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-bold text-[#f4f4f5] group-hover:text-white transition-colors">
                              {host.name}
                            </h3>
                            {host.protocol === 'serial' && (
                              <span className="inline-flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2a2a2a] text-amber-400 border border-amber-500/30 tracking-wider">
                                <Cable size={9} className="text-amber-400" />
                                <span>SERIAL</span>
                              </span>
                            )}
                            {host.protocol === 'telnet' && (
                              <span className="inline-flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#2a2a2a] text-sky-400 border border-sky-500/30 tracking-wider">
                                <Radio size={9} className="text-sky-400" />
                                <span>TELNET</span>
                              </span>
                            )}
                          </div>
                          {group && (
                            <span
                              className="inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full mt-0.5"
                              style={{
                                backgroundColor: `${group.color || '#938a87'}15`,
                                color: group.color || '#938a87',
                                border: `1px solid ${group.color || '#938a87'}30`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: group.color || '#938a87' }}
                              />
                              <span>{group.name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu Options Button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : host.id);
                          }}
                          className="p-1 rounded-md text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown Menu - Dark Navigation */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-7 z-20 bg-[#19191a] border border-[#363636] rounded-lg shadow-xl py-1 text-xs text-[#938a87] w-36"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                onEdit(host);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-[#f4f4f5] cursor-pointer"
                            >
                              <Edit2 size={13} />
                              <span>Edit Host</span>
                            </button>
                            <button
                              onClick={() => {
                                onDuplicate(host);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-[#f4f4f5] cursor-pointer"
                            >
                              <Copy size={13} />
                              <span>Duplicate</span>
                            </button>
                            <button
                              onClick={() => {
                                onOpenSSHConfig();
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-[#f4f4f5] cursor-pointer"
                            >
                              <FileCode size={13} />
                              <span>SSH Config</span>
                            </button>
                            <div className="h-[1px] bg-[#2a2a2a] my-1" />
                            <button
                              onClick={() => {
                                onDelete(host.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] text-rose-400 cursor-pointer"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Host Connection Info */}
                    <div className="mt-3.5 space-y-1.5 text-xs">
                      {host.protocol === 'serial' ? (
                        <div className="font-mono text-[#f4f4f5] bg-[#0a0a0a] px-2.5 py-1.5 rounded-md border border-[#2a2a2a] flex items-center justify-between">
                          <span className="truncate flex items-center space-x-1.5">
                            <Cable size={12} className="text-amber-400 shrink-0" />
                            <span>{host.hostname}</span>
                          </span>
                          <span className="text-amber-400 font-bold shrink-0 ml-1">
                            {host.baudRate || 9600} baud
                          </span>
                        </div>
                      ) : (
                        <div className="font-mono text-[#f4f4f5] bg-[#0a0a0a] px-2.5 py-1.5 rounded-md border border-[#2a2a2a] flex items-center justify-between">
                          <span className="truncate">
                            {host.username}@{host.hostname}
                          </span>
                          <span className="text-[#938a87] shrink-0 ml-1">:{host.port}</span>
                        </div>
                      )}

                      {host.description && (
                        <p className="text-[11px] text-[#938a87] line-clamp-1 italic px-1 font-mono">
                          {host.description}
                        </p>
                      )}
                    </div>

                    {/* Security & Protocol Chip */}
                    {host.protocol === 'serial' ? (
                      <div className="mt-3 flex items-center space-x-2 text-[11px] text-[#938a87]">
                        <Cable size={13} className="text-amber-400 shrink-0" />
                        <span className="font-medium text-[#f4f4f5]">
                          UART Console ({host.baudRate || 9600} 8{host.parity ? host.parity[0].toUpperCase() : 'N'}{host.stopBits || 1})
                        </span>
                      </div>
                    ) : host.protocol === 'telnet' ? (
                      <div className="mt-3 flex items-center space-x-2 text-[11px] text-[#938a87]">
                        <Radio size={13} className="text-sky-400 shrink-0" />
                        <span className="font-medium text-[#f4f4f5]">Telnet Terminal (RFC 854)</span>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center space-x-2 text-[11px] text-[#938a87]">
                        <Shield size={13} className="text-[#938a87] shrink-0" />
                        <span className="capitalize">{host.authType} auth</span>
                        {host.jumpHostId && (
                          <span className="flex items-center space-x-1 text-amber-400 font-medium">
                            <Layers size={11} />
                            <span>JumpHost</span>
                          </span>
                        )}
                        {host.proxyCommand && (
                          <span className="flex items-center space-x-1 text-[#f4f4f5] font-medium bg-[#2a2a2a] px-1.5 py-0.5 rounded border border-[#363636]">
                            <Cloud size={11} />
                            <span>{host.proxyCommand.includes('cloudflared') ? 'Cloudflare' : 'Proxy'}</span>
                          </span>
                        )}
                        {host.identityFile && (
                          <span className="flex items-center space-x-1 text-[#f4f4f5] font-medium bg-[#2a2a2a] px-1.5 py-0.5 rounded border border-[#363636]">
                            <FileCode size={11} />
                            <span>Key File</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {host.tags && host.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {host.tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center space-x-1 text-[10px] bg-[#2a2a2a] text-[#938a87] px-2 py-0.5 rounded border border-[#363636]"
                          >
                            <Tag size={9} className="text-[#605e5e]" />
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#2a2a2a] flex items-center space-x-2">
                    <button
                      onClick={() => onConnect(host)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Play size={13} className="fill-current text-[#938a87]" />
                      <span>Connect Terminal</span>
                    </button>
                    {host.protocol === 'telnet' || host.protocol === 'serial' ? (
                      <button
                        disabled
                        title={host.protocol === 'serial' ? 'SFTP is not supported over Serial Console' : 'SFTP is not supported over Telnet protocol'}
                        className="py-1.5 px-2.5 rounded-lg bg-[#141414] text-[#404040] border border-[#222222] cursor-not-allowed opacity-40"
                      >
                        <FolderSync size={15} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenSFTP(host)}
                        title="Open SFTP File Browser"
                        className="py-1.5 px-2.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] text-[#938a87] hover:text-[#f4f4f5] border border-[#363636] transition-colors cursor-pointer"
                      >
                        <FolderSync size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
