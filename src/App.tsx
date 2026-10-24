import React, { useState, useEffect, useCallback } from 'react';
import type {
  HostConfig,
  HostGroup,
  SSHKeyItem,
  SSHTunnel,
  CommandSnippet,
  WorkspaceItem,
  ConnectionHistoryEntry,
  AppSettings,
  TerminalTab,
  HostKeyPromptData,
} from './types';
import { api } from './services/api';
import { Sidebar, type NavItem } from './components/Sidebar';
import { TerminalManager } from './components/TerminalManager';
import { HostList } from './components/HostList';
import { HostModal } from './components/HostModal';
import { SFTPManager } from './components/SFTPManager';
import { KeyManager } from './components/KeyManager';
import { TunnelManager } from './components/TunnelManager';
import { SnippetManager } from './components/SnippetManager';
import { WorkspacesManager } from './components/WorkspacesManager';
import { GroupManager } from './components/GroupManager';
import { HistoryManager } from './components/HistoryManager';
import { SettingsModal } from './components/SettingsModal';
import { CommandPalette } from './components/CommandPalette';
import { HostKeyModal } from './components/HostKeyModal';
import { SSHConfigModal } from './components/SSHConfigModal';
import { ConfirmModal, type ConfirmModalProps } from './components/ConfirmModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';

export const App: React.FC = () => {
  // Navigation
  const [currentTab, setCurrentTab] = useState<NavItem>('hosts');

  // Application Data
  const [hosts, setHosts] = useState<HostConfig[]>([]);
  const [groups, setGroups] = useState<HostGroup[]>([]);
  const [keys, setKeys] = useState<SSHKeyItem[]>([]);
  const [tunnels, setTunnels] = useState<SSHTunnel[]>([]);
  const [snippets, setSnippets] = useState<CommandSnippet[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [history, setHistory] = useState<ConnectionHistoryEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    fontSize: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    scrollbackLines: 10000,
    copyOnSelect: true,
    keepaliveIntervalDefault: 30,
    defaultTimeoutSeconds: 15,
    confirmBeforeClosingActiveTab: true,
    soundBell: false,
  });

  // Terminal & Session State
  const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [splitLayout, setSplitLayout] = useState<'single' | 'split-vertical' | 'split-horizontal'>('single');
  const [syncInput, setSyncInput] = useState(false);

  // Modals & Overlays
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostConfig | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPromptData | null>(null);
  const [sftpTargetHostId, setSftpTargetHostId] = useState<string | undefined>(undefined);
  const [sshConfigModalOpen, setSshConfigModalOpen] = useState(false);
  const [backupRestoreModalOpen, setBackupRestoreModalOpen] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalProps | null>(null);

  const confirmAction = ({
    title,
    message,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    isDestructive = true,
    action,
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    action: () => Promise<void> | void;
  }) => {
    setConfirmModalState({
      isOpen: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      isDestructive,
      onConfirm: async () => {
        setConfirmModalState(null);
        await action();
      },
      onCancel: () => setConfirmModalState(null),
    });
  };

  const showAlert = (title: string, message: string) => {
    setConfirmModalState({
      isOpen: true,
      title,
      message,
      confirmLabel: 'OK',
      isAlert: true,
      isDestructive: false,
      onConfirm: () => setConfirmModalState(null),
      onCancel: () => setConfirmModalState(null),
    });
  };

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [h, g, k, t, s, w, hist, sett] = await Promise.all([
        api.getHosts().catch(() => []),
        api.getGroups().catch(() => []),
        api.getSSHKeys().catch(() => []),
        api.getTunnels().catch(() => []),
        api.getSnippets().catch(() => []),
        api.getWorkspaces().catch(() => []),
        api.getHistory().catch(() => []),
        api.getSettings().catch(() => null),
      ]);

      setHosts(h);
      setGroups(g);
      setKeys(k);
      setTunnels(t);
      setSnippets(s);
      setWorkspaces(w);
      setHistory(hist);
      if (sett) setSettings(sett);
    } catch (e) {
      console.warn('Initial data load notice:', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Listen for Host Key Verification Prompts
    let unlistenHostKey: (() => void) | undefined;
    api.onHostKeyPrompt((prompt) => {
      setHostKeyPrompt(prompt);
    }).then((unlisten) => {
      unlistenHostKey = unlisten;
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (unlistenHostKey) unlistenHostKey();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [loadData]);

  // Open Local Shell Session
  const handleOpenLocalTerminal = useCallback(async () => {
    const tabId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTab: TerminalTab = {
      id: tabId,
      hostId: 'local',
      title: 'Local Terminal',
      status: 'connecting',
      isLocal: true,
    };

    setTerminalTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    setCurrentTab('terminal');

    try {
      const session = await api.openLocalSession(80, 24);
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, sessionId: session.sessionId, status: 'connected' } : t))
      );
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : 'Failed to launch local terminal';
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, status: 'error', error: errorMsg } : t))
      );
    }
  }, []);

  // Connect to SSH Host
  const handleConnectHost = async (host: HostConfig) => {
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTab: TerminalTab = {
      id: tabId,
      hostId: host.id,
      title: host.name,
      status: 'connecting',
      protocol: host.protocol,
      baudRate: host.baudRate,
    };

    setTerminalTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    setCurrentTab('terminal');

    try {
      const session = await api.startSSHSession(host.id, 80, 24);
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, sessionId: session.sessionId, status: 'connected' } : t))
      );
      // Reload history
      api.getHistory().then(setHistory).catch(() => {});
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : 'Connection failed';
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, status: 'error', error: errorMsg } : t))
      );
      // Reload history
      api.getHistory().then(setHistory).catch(() => {});
    }
  };

  // Reconnect Tab
  const handleReconnectTab = async (tabId: string) => {
    const tab = terminalTabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.isLocal || tab.hostId === 'local') {
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, status: 'connecting', error: undefined } : t))
      );
      try {
        const session = await api.openLocalSession(80, 24);
        setTerminalTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, sessionId: session.sessionId, status: 'connected' } : t))
        );
      } catch (err) {
        setTerminalTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, status: 'error', error: String(err) } : t))
        );
      }
      return;
    }

    const host = hosts.find((h) => h.id === tab.hostId);
    if (!host) return;

    setTerminalTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, status: 'connecting', error: undefined } : t))
    );

    try {
      const session = await api.startSSHSession(host.id, 80, 24);
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, sessionId: session.sessionId, status: 'connected' } : t))
      );
    } catch (err) {
      setTerminalTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, status: 'error', error: String(err) } : t))
      );
    }
  };

  // Close Tab
  const handleCloseTab = async (tabId: string) => {
    const tab = terminalTabs.find((t) => t.id === tabId);
    if (tab?.sessionId) {
      api.closeSSHSession(tab.sessionId).catch(() => {});
    }

    setTerminalTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  // Host Key Resolution (Trust / Reject)
  const handleResolveHostKey = async (accept: boolean) => {
    if (!hostKeyPrompt) return;
    try {
      await api.resolveHostKey(
        hostKeyPrompt.host,
        hostKeyPrompt.port,
        hostKeyPrompt.fingerprint,
        accept
      );
    } catch (e) {
      console.error('Failed to resolve host key prompt:', e);
    } finally {
      setHostKeyPrompt(null);
    }
  };

  // Open SFTP for Host
  const handleOpenSFTP = (host: HostConfig) => {
    setSftpTargetHostId(host.id);
    setCurrentTab('sftp');
  };

  // Execute Snippet into active terminal
  const handleExecuteSnippet = async (command: string, sendNewline: boolean = true) => {
    const activeTab = terminalTabs.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.sessionId) {
      showAlert('No Active Session', 'Please connect to an active terminal session first before executing a snippet.');
      return;
    }

    // In terminals (PTYs, SSH, Serial, Telnet), Carriage Return (\r) is the canonical Enter keystroke.
    // Sending bare \n without \r causes readline to wait, fail to submit, or create staircased output.
    const normalizedCmd = command.replace(/\r\n|\n/g, '\r');
    const payload = sendNewline
      ? (normalizedCmd.endsWith('\r') ? normalizedCmd : normalizedCmd + '\r')
      : normalizedCmd;

    // If synchronized input is enabled, send to all sessions!
    if (syncInput) {
      terminalTabs.forEach((tab) => {
        if (tab.sessionId && tab.status === 'connected') {
          api.sendTerminalData(tab.sessionId, payload);
        }
      });
    } else {
      api.sendTerminalData(activeTab.sessionId, payload);
    }
    setCurrentTab('terminal');
  };

  const handleSaveSnippet = async (snip: Partial<CommandSnippet>) => {
    const saved = await api.saveSnippet(snip);
    setSnippets((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  // Launch Workspace
  const handleLaunchWorkspace = (ws: WorkspaceItem) => {
    setSplitLayout(ws.layout as any);
    ws.panes.forEach((pane) => {
      const host = hosts.find((h) => h.id === pane.hostId);
      if (host) {
        handleConnectHost(host);
      }
    });
    setCurrentTab('terminal');
  };

  // Host CRUD
  const handleSaveHost = async (hostData: Partial<HostConfig>) => {
    try {
      const saved = await api.saveHost(hostData);
      setHosts((prev) => {
        const idx = prev.findIndex((h) => h.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
    } catch (err) {
      console.error('Failed to save host:', err);
      showAlert('Host Error', `Failed to save host configuration: ${err}`);
      throw err;
    }
  };

  // Default terminal page should be local terminal: auto-spawn local terminal if empty
  useEffect(() => {
    if (currentTab === 'terminal' && terminalTabs.length === 0) {
      handleOpenLocalTerminal();
    }
  }, [currentTab, terminalTabs.length, handleOpenLocalTerminal]);

  const handleDeleteHost = (id: string) => {
    const hostToDelete = hosts.find((h) => h.id === id);
    const hostName = hostToDelete?.name || hostToDelete?.hostname || 'this host';
    confirmAction({
      title: 'Delete Host',
      message: `Are you sure you want to delete host "${hostName}"? All saved credentials and connection settings for this host will be permanently removed.`,
      confirmLabel: 'Delete Host',
      action: async () => {
        try {
          await api.deleteHost(id);
          setHosts((prev) => prev.filter((h) => h.id !== id));
        } catch (err) {
          console.error('Failed to delete host:', err);
          showAlert('Delete Failed', `Failed to delete host: ${err}`);
        }
      },
    });
  };

  const handleDuplicateHost = async (host: HostConfig) => {
    const copy: Partial<HostConfig> = {
      ...host,
      id: undefined,
      name: `${host.name} (Copy)`,
    };
    await handleSaveHost(copy);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#f4f4f5] font-sans select-none">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'settings') {
            setSettingsModalOpen(true);
          } else if (tab === 'terminal') {
            setCurrentTab('terminal');
            if (terminalTabs.length === 0) {
              handleOpenLocalTerminal();
            }
          } else {
            setCurrentTab(tab);
          }
        }}
        activeSessionCount={terminalTabs.filter((t) => t.status === 'connected').length}
        activeTunnelCount={tunnels.filter((t) => t.status === 'active').length}
        onQuickConnect={() => setCommandPaletteOpen(true)}
        onNewHost={() => {
          setEditingHost(null);
          setHostModalOpen(true);
        }}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentTab === 'hosts' && (
          <HostList
            hosts={hosts}
            groups={groups}
            onConnect={handleConnectHost}
            onOpenSFTP={handleOpenSFTP}
            onEdit={(h) => {
              setEditingHost(h);
              setHostModalOpen(true);
            }}
            onDuplicate={handleDuplicateHost}
            onDelete={handleDeleteHost}
            onNewHost={() => {
              setEditingHost(null);
              setHostModalOpen(true);
            }}
            onOpenSSHConfig={() => setSshConfigModalOpen(true)}
            onOpenBackupRestore={() => setBackupRestoreModalOpen(true)}
          />
        )}

        {currentTab === 'terminal' && (
          <TerminalManager
            tabs={terminalTabs}
            activeTabId={activeTabId}
            hosts={hosts}
            snippets={snippets}
            onExecuteSnippet={handleExecuteSnippet}
            onSaveSnippet={handleSaveSnippet}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
            onReconnectTab={handleReconnectTab}
            onNewTab={() => setCurrentTab('hosts')}
            onNewLocalTab={handleOpenLocalTerminal}
            splitLayout={splitLayout}
            onSetSplitLayout={setSplitLayout}
            syncInput={syncInput}
            onToggleSyncInput={setSyncInput}
          />
        )}

        {currentTab === 'sftp' && (
          <SFTPManager hosts={hosts} selectedHostId={sftpTargetHostId} />
        )}

        {currentTab === 'keys' && (
          <KeyManager
            keys={keys}
            onRefresh={loadData}
            onGenerate={async (name, keyType, passphrase, bits) => {
              const newKey = await api.generateSSHKey(name, keyType, passphrase, bits);
              setKeys((prev) => [...prev, newKey]);
            }}
            onImport={async (name, content, passphrase) => {
              const imported = await api.importSSHKey(name, content, passphrase);
              setKeys((prev) => [...prev, imported]);
            }}
            onDelete={(id) => {
              const keyToDelete = keys.find((k) => k.id === id);
              const keyName = keyToDelete?.name || 'this SSH key';
              confirmAction({
                title: 'Delete SSH Key',
                message: `Are you sure you want to delete SSH key "${keyName}"? Hosts configured to use this key may fail to authenticate.`,
                confirmLabel: 'Delete Key',
                action: async () => {
                  await api.deleteSSHKey(id);
                  setKeys((prev) => prev.filter((k) => k.id !== id));
                },
              });
            }}
          />
        )}

        {currentTab === 'tunnels' && (
          <TunnelManager
            tunnels={tunnels}
            hosts={hosts}
            onStart={async (id) => {
              await api.startTunnel(id);
              setTunnels(await api.getTunnels());
            }}
            onStop={async (id) => {
              await api.stopTunnel(id);
              setTunnels(await api.getTunnels());
            }}
            onSave={async (tun) => {
              const saved = await api.saveTunnel(tun);
              setTunnels((prev) => {
                const idx = prev.findIndex((t) => t.id === saved.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = saved;
                  return next;
                }
                return [...prev, saved];
              });
            }}
            onDelete={(id) => {
              const tunToDelete = tunnels.find((t) => t.id === id);
              const tunName = tunToDelete?.name || 'this tunnel rule';
              confirmAction({
                title: 'Delete Tunnel Rule',
                message: `Are you sure you want to delete tunnel rule "${tunName}"?`,
                confirmLabel: 'Delete Tunnel',
                action: async () => {
                  await api.deleteTunnel(id);
                  setTunnels((prev) => prev.filter((t) => t.id !== id));
                },
              });
            }}
          />
        )}

        {currentTab === 'snippets' && (
          <SnippetManager
            snippets={snippets}
            hasActiveSession={terminalTabs.some((t) => t.status === 'connected')}
            onExecuteSnippet={handleExecuteSnippet}
            onSaveSnippet={handleSaveSnippet}
            onDeleteSnippet={(id) => {
              const snipToDelete = snippets.find((s) => s.id === id);
              const snipName = snipToDelete?.title || 'this snippet';
              confirmAction({
                title: 'Delete Command Snippet',
                message: `Are you sure you want to delete snippet "${snipName}"?`,
                confirmLabel: 'Delete Snippet',
                action: async () => {
                  await api.deleteSnippet(id);
                  setSnippets((prev) => prev.filter((s) => s.id !== id));
                },
              });
            }}
          />
        )}

        {currentTab === 'workspaces' && (
          <WorkspacesManager
            workspaces={workspaces}
            hosts={hosts}
            onLaunch={handleLaunchWorkspace}
            onSave={async (ws) => {
              const saved = await api.saveWorkspace(ws);
              setWorkspaces((prev) => [...prev, saved]);
            }}
            onDelete={(id) => {
              const wsToDelete = workspaces.find((w) => w.id === id);
              const wsName = wsToDelete?.name || 'this workspace';
              confirmAction({
                title: 'Delete Workspace',
                message: `Are you sure you want to delete workspace "${wsName}"?`,
                confirmLabel: 'Delete Workspace',
                action: async () => {
                  await api.deleteWorkspace(id);
                  setWorkspaces((prev) => prev.filter((w) => w.id !== id));
                },
              });
            }}
          />
        )}

        {currentTab === 'groups' && (
          <GroupManager
            groups={groups}
            hosts={hosts}
            onSaveGroup={async (grp) => {
              const saved = await api.saveGroup(grp);
              setGroups((prev) => {
                const idx = prev.findIndex((g) => g.id === saved.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = saved;
                  return next;
                }
                return [...prev, saved];
              });
            }}
            onDeleteGroup={(id) => {
              const grpToDelete = groups.find((g) => g.id === id);
              const grpName = grpToDelete?.name || 'this group';
              confirmAction({
                title: 'Delete Group',
                message: `Are you sure you want to delete group "${grpName}"? Hosts in this group will remain unassigned.`,
                confirmLabel: 'Delete Group',
                action: async () => {
                  await api.deleteGroup(id);
                  setGroups((prev) => prev.filter((g) => g.id !== id));
                },
              });
            }}
          />
        )}

        {currentTab === 'history' && (
          <HistoryManager
            history={history}
            hosts={hosts}
            onReconnect={handleConnectHost}
            onClear={() => {
              confirmAction({
                title: 'Clear Session History',
                message: 'Are you sure you want to clear all SSH session logs and history? This cannot be undone.',
                confirmLabel: 'Clear All History',
                action: async () => {
                  await api.clearHistory();
                  setHistory([]);
                },
              });
            }}
          />
        )}
      </main>

      {/* Host Edit / Create Modal */}
      <HostModal
        isOpen={hostModalOpen}
        onClose={() => setHostModalOpen(false)}
        onSave={handleSaveHost}
        initialData={editingHost}
        groups={groups}
        keys={keys}
        allHosts={hosts}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSave={async (newSettings) => {
          setSettings(newSettings);
          await api.saveSettings(newSettings);
        }}
        onOpenBackupRestore={() => setBackupRestoreModalOpen(true)}
      />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        hosts={hosts}
        snippets={snippets}
        onSelectHost={handleConnectHost}
        onSelectNav={(tab) => {
          if (tab === 'settings') setSettingsModalOpen(true);
          else setCurrentTab(tab);
        }}
        onSelectSnippet={(s) => {
          handleExecuteSnippet(s.command);
        }}
        onOpenSSHConfig={() => setSshConfigModalOpen(true)}
        onOpenLocalTerminal={handleOpenLocalTerminal}
        onOpenBackupRestore={() => setBackupRestoreModalOpen(true)}
      />

      {/* Host Key Verification / MITM Warning Modal */}
      <HostKeyModal
        prompt={hostKeyPrompt}
        onResolve={handleResolveHostKey}
      />

      {/* OpenSSH ~/.ssh/config Editor Modal */}
      <SSHConfigModal
        isOpen={sshConfigModalOpen}
        onClose={() => setSshConfigModalOpen(false)}
        hosts={hosts}
        onHostsImported={(newHosts) => {
          setHosts((prev) => {
            const existingIds = new Set(prev.map((h) => h.id));
            const updated = prev.map((h) => {
              const match = newHosts.find((nh) => nh.id === h.id);
              return match || h;
            });
            const added = newHosts.filter((nh) => !existingIds.has(nh.id));
            return [...updated, ...added];
          });
        }}
      />

      {/* Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={backupRestoreModalOpen}
        onClose={() => setBackupRestoreModalOpen(false)}
        hosts={hosts}
        groups={groups}
        keys={keys}
        tunnels={tunnels}
        snippets={snippets}
        workspaces={workspaces}
        onRestored={loadData}
      />
      {/* Global Themed Confirmation & Warning Modal */}
      {confirmModalState && <ConfirmModal {...confirmModalState} />}
    </div>
  );
};
