import React, { useState, useEffect, useMemo } from 'react';
import type { HostConfig, CommandSnippet } from '../types';
import type { NavItem } from './Sidebar';
import {
  Search,
  Server,
  Terminal,
  FolderSync,
  Network,
  Code,
  KeyRound,
  LayoutGrid,
  History,
  Settings,
  FolderTree,
  FileCode,
  Database,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  hosts: HostConfig[];
  snippets: CommandSnippet[];
  onSelectHost: (host: HostConfig) => void;
  onSelectNav: (tab: NavItem) => void;
  onSelectSnippet: (snippet: CommandSnippet) => void;
  onOpenSSHConfig?: () => void;
  onOpenLocalTerminal?: () => void;
  onOpenBackupRestore?: () => void;
}

interface PaletteItem {
  id: string;
  type: 'host' | 'nav' | 'snippet';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  hosts,
  snippets,
  onSelectHost,
  onSelectNav,
  onSelectSnippet,
  onOpenSSHConfig,
  onOpenLocalTerminal,
  onOpenBackupRestore,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];

    // Local Terminal Action
    if (onOpenLocalTerminal) {
      list.push({
        id: 'action-local-terminal',
        type: 'nav',
        title: 'Open Local Terminal',
        subtitle: 'Launch an interactive local Linux PTY shell ($SHELL)',
        icon: <Terminal size={14} className="text-[#f4f4f5]" />,
        action: () => {
          onClose();
          onOpenLocalTerminal();
        },
      });
    }

    // SSH Config Direct Editor
    if (onOpenSSHConfig) {
      list.push({
        id: 'action-ssh-config',
        type: 'nav',
        title: 'Open ~/.ssh/config Editor',
        subtitle: 'View, edit, backup, and manage OpenSSH host configuration',
        icon: <FileCode size={14} className="text-[#938a87]" />,
        action: () => {
          onClose();
          onOpenSSHConfig();
        },
      });
    }

    // Backup & Restore
    if (onOpenBackupRestore) {
      list.push({
        id: 'action-backup-restore',
        type: 'nav',
        title: 'Backup & Restore Application Data',
        subtitle: 'Export encrypted archive or restore hosts, keys, and credentials',
        icon: <Database size={14} className="text-[#938a87]" />,
        action: () => {
          onClose();
          onOpenBackupRestore();
        },
      });
    }

    // Navigation Pages
    const navItems: { tab: NavItem; title: string; desc: string; icon: React.ReactNode }[] = [
      { tab: 'hosts', title: 'Go to Hosts', desc: 'Browse and manage SSH servers', icon: <Server size={14} /> },
      { tab: 'terminal', title: 'Go to Active Terminals', desc: 'View running interactive shells', icon: <Terminal size={14} /> },
      { tab: 'sftp', title: 'Go to SFTP File Manager', desc: 'Browse and transfer remote files', icon: <FolderSync size={14} /> },
      { tab: 'tunnels', title: 'Go to Port Forwarding', desc: 'Configure SSH tunnels & SOCKS5', icon: <Network size={14} /> },
      { tab: 'snippets', title: 'Go to Command Snippets', desc: 'Script library and templates', icon: <Code size={14} /> },
      { tab: 'keys', title: 'Go to SSH Keys', desc: 'Manage private/public keys', icon: <KeyRound size={14} /> },
      { tab: 'workspaces', title: 'Go to Workspaces', desc: 'Multi-server split layouts', icon: <LayoutGrid size={14} /> },
      { tab: 'groups', title: 'Go to Host Groups', desc: 'Organize hosts into groups', icon: <FolderTree size={14} /> },
      { tab: 'history', title: 'Go to History', desc: 'Connection audit history', icon: <History size={14} /> },
      { tab: 'settings', title: 'Go to Settings', desc: 'Configure client preferences', icon: <Settings size={14} /> },
    ];

    navItems.forEach((n) => {
      list.push({
        id: `nav-${n.tab}`,
        type: 'nav',
        title: n.title,
        subtitle: n.desc,
        icon: n.icon,
        action: () => onSelectNav(n.tab),
      });
    });

    // Hosts
    hosts.forEach((h) => {
      list.push({
        id: `host-${h.id}`,
        type: 'host',
        title: `Connect to ${h.name}`,
        subtitle: `${h.username}@${h.hostname}:${h.port} (${h.authType} auth)`,
        icon: <Server size={14} className="text-cyan-400" />,
        action: () => onSelectHost(h),
      });
    });

    // Snippets
    snippets.forEach((s) => {
      list.push({
        id: `snippet-${s.id}`,
        type: 'snippet',
        title: `Run: ${s.title}`,
        subtitle: s.command,
        icon: <Code size={14} className="text-amber-400" />,
        action: () => onSelectSnippet(s),
      });
    });

    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(
      (item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    );
  }, [hosts, snippets, query, onSelectHost, onSelectNav, onSelectSnippet]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);


  // Modal key navigation
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleModalKeyDown}
      >
        {/* Search input */}
        <div className="p-3 border-b border-[#2a2a2a] flex items-center space-x-3 bg-[#19191a]">
          <Search size={18} className="text-[#938a87] ml-2" />
          <input
            type="text"
            placeholder="Type a command, host name, IP, or search snippets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] bg-[#2a2a2a] text-[#938a87] px-1.5 py-0.5 rounded border border-[#363636]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5 bg-[#0a0a0a]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-[#605e5e] text-xs">
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#2a2a2a] border border-[#363636] text-[#f4f4f5]'
                      : 'hover:bg-[#19191a] text-[#938a87] border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="p-1.5 rounded bg-[#19191a] text-[#f4f4f5] shrink-0 border border-[#2a2a2a]">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[#f4f4f5] truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-[#605e5e] font-mono truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-[#605e5e] uppercase font-bold shrink-0 ml-2">
                    {item.type}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
