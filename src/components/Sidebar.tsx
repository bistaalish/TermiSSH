import React from 'react';
import {
  Server,
  Terminal,
  FolderSync,
  Network,
  Code,
  KeyRound,
  LayoutGrid,
  History,
  Settings,
  Plus,
  FolderTree,
  Command,
} from 'lucide-react';

export type NavItem =
  | 'hosts'
  | 'terminal'
  | 'sftp'
  | 'tunnels'
  | 'snippets'
  | 'keys'
  | 'workspaces'
  | 'groups'
  | 'history'
  | 'settings';

interface SidebarProps {
  currentTab: NavItem;
  onSelectTab: (tab: NavItem) => void;
  activeSessionCount: number;
  activeTunnelCount: number;
  onQuickConnect: () => void;
  onNewHost: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeSessionCount,
  activeTunnelCount,
  onQuickConnect,
  onNewHost,
}) => {
  const navItems: { id: NavItem; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'hosts', label: 'Hosts', icon: <Server size={18} /> },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <Terminal size={18} />,
      badge: activeSessionCount > 0 ? activeSessionCount : undefined,
    },
    { id: 'sftp', label: 'SFTP Files', icon: <FolderSync size={18} /> },
    {
      id: 'tunnels',
      label: 'Port Tunnels',
      icon: <Network size={18} />,
      badge: activeTunnelCount > 0 ? activeTunnelCount : undefined,
    },
    { id: 'snippets', label: 'Snippets', icon: <Code size={18} /> },
    { id: 'keys', label: 'SSH Keys', icon: <KeyRound size={18} /> },
    { id: 'workspaces', label: 'Workspaces', icon: <LayoutGrid size={18} /> },
    { id: 'groups', label: 'Host Groups', icon: <FolderTree size={18} /> },
    { id: 'history', label: 'History', icon: <History size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="w-64 bg-[#19191a] border-r border-[#2a2a2a] flex flex-col justify-between select-none h-screen shrink-0">
      <div>
        {/* App Branding */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#2a2a2a] bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#363636] flex items-center justify-center shadow-xs text-[#f4f4f5] font-black text-sm tracking-tighter">
              &gt;_
            </div>
            <div>
              <span className="font-bold text-[#f4f4f5] text-sm tracking-wide">TermiSSH</span>
              <span className="ml-1.5 text-[10px] uppercase font-semibold text-[#938a87] bg-[#2a2a2a] px-1.5 py-0.5 rounded border border-[#363636]">
                Pro
              </span>
            </div>
          </div>
        </div>

        {/* Quick Connect / New Host Quick Bar */}
        <div className="p-3 space-y-2">
          <button
            onClick={onQuickConnect}
            className="w-full py-1.5 px-3 rounded-md bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] text-xs text-[#938a87] hover:text-[#f4f4f5] flex items-center justify-between transition-colors shadow-xs cursor-pointer group"
          >
            <span className="flex items-center space-x-2">
              <Command size={13} className="text-[#938a87] group-hover:text-[#f4f4f5] transition-colors" />
              <span>Quick Connect</span>
            </span>
            <kbd className="text-[10px] bg-[#19191a] text-[#605e5e] px-1.5 py-0.5 rounded border border-[#363636]">
              Ctrl+K
            </kbd>
          </button>

          <button
            onClick={onNewHost}
            className="w-full py-1.5 px-3 rounded-md bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>New Host</span>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="px-2 py-1 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] shadow-xs font-semibold'
                    : 'text-[#938a87] hover:text-[#f4f4f5] hover:bg-[#222223] border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? 'text-[#f4f4f5]' : 'text-[#605e5e] group-hover:text-[#938a87] transition-colors'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-[#363636] text-[#f4f4f5] border border-[#605e5e]'
                        : 'bg-[#2a2a2a] text-[#938a87] border border-[#363636]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#2a2a2a] bg-[#19191a]">
        <div className="flex items-center justify-between text-[11px] text-[#605e5e]">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span className="text-[#938a87]">Security Vault Active</span>
          </div>
          <span className="font-mono text-[10px] text-[#605e5e]">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
