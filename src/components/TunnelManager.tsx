import React, { useState } from 'react';
import type { SSHTunnel, HostConfig } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  Network,
  Plus,
  Play,
  Square,
  Trash2,
  Edit2,
  Server,
  ArrowRight,
  AlertCircle,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { TunnelModal } from './TunnelModal';

interface TunnelManagerProps {
  tunnels: SSHTunnel[];
  hosts: HostConfig[];
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onSave: (tunnel: Partial<SSHTunnel>) => Promise<void>;
  onDelete: (id: string) => void;
}

export const TunnelManager: React.FC<TunnelManagerProps> = ({
  tunnels,
  hosts,
  onStart,
  onStop,
  onSave,
  onDelete,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<SSHTunnel | null>(null);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggle = async (tunnel: SSHTunnel) => {
    setOperatingId(tunnel.id);
    try {
      if (tunnel.status === 'active') {
        await onStop(tunnel.id);
      } else {
        await onStart(tunnel.id);
      }
    } catch (e) {
      setErrorMessage(`Tunnel operation error: ${e}`);
    } finally {
      setOperatingId(null);
    }
  };

  const getTunnelTypeBadge = (type: SSHTunnel['tunnelType']) => {
    switch (type) {
      case 'local':
        return (
          <span className="text-[10px] uppercase font-bold text-[#f4f4f5] bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#363636]">
            Local (-L)
          </span>
        );
      case 'remote':
        return (
          <span className="text-[10px] uppercase font-bold text-amber-300 bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#363636]">
            Remote (-R)
          </span>
        );
      case 'dynamic':
        return (
          <span className="text-[10px] uppercase font-bold text-purple-300 bg-[#2a2a2a] px-2 py-0.5 rounded border border-[#363636]">
            SOCKS5 (-D)
          </span>
        );
    }
  };

  const getStatusBadge = (status: SSHTunnel['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-[#f4f4f5] font-semibold">
            <CheckCircle2 size={13} className="text-[#938a87]" />
            <span>Active</span>
          </span>
        );
      case 'starting':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-amber-400 font-semibold animate-pulse">
            <Activity size={13} />
            <span>Connecting...</span>
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center space-x-1.5 text-xs text-rose-400 font-semibold">
            <AlertCircle size={13} />
            <span>Error</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1.5 text-xs text-[#605e5e] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#363636]" />
            <span>Inactive</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#2a2a2a] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <Network className="text-[#938a87]" size={22} />
            <span>SSH Port Forwarding &amp; Tunnels</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Establish secure encrypted tunnels (Local, Remote, and SOCKS5 dynamic proxies) over SSH.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTunnel(null);
            setShowModal(true);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5] text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>New Tunnel</span>
        </button>
      </div>

      {/* Tunnel Cards */}
      <div className="p-6 flex-1">
        {tunnels.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <Network size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#938a87]">No SSH Tunnels configured</p>
            <p className="text-xs text-[#605e5e] mt-1">
              Add a tunnel to forward local ports, expose services, or establish a SOCKS5 proxy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tunnels.map((tunnel) => {
              const host = hosts.find((h) => h.id === tunnel.hostId);
              const isOperating = operatingId === tunnel.id;

              return (
                <div
                  key={tunnel.id}
                  className={`border rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all ${
                    tunnel.status === 'active'
                      ? 'bg-[#19191a] border-[#363636]'
                      : 'bg-[#19191a] border-[#2a2a2a]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-[#f4f4f5]">{tunnel.name}</h3>
                        <div className="mt-1 flex items-center space-x-2">
                          {getTunnelTypeBadge(tunnel.tunnelType)}
                          {getStatusBadge(tunnel.status)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingTunnel(tunnel);
                            setShowModal(true);
                          }}
                          className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#222223] cursor-pointer"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(tunnel.id)}
                          className="p-1 rounded text-[#605e5e] hover:text-rose-400 hover:bg-[#222223] cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Tunnel Routing Details */}
                    <div className="mt-3.5 p-2.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] space-y-1.5 font-mono text-xs">
                      <div className="flex items-center justify-between text-[#f4f4f5]">
                        <span className="text-[#f4f4f5]">
                          {tunnel.localHost}:{tunnel.localPort}
                        </span>
                        {tunnel.tunnelType !== 'dynamic' && (
                          <>
                            <ArrowRight size={13} className="text-[#605e5e] shrink-0 mx-1" />
                            <span className="text-[#938a87] truncate">
                              {tunnel.remoteHost}:{tunnel.remotePort}
                            </span>
                          </>
                        )}
                        {tunnel.tunnelType === 'dynamic' && (
                          <span className="text-purple-300 text-[11px] font-sans font-semibold">
                            (Dynamic SOCKS5)
                          </span>
                        )}
                      </div>

                      {host && (
                        <div className="text-[10px] text-[#605e5e] flex items-center space-x-1 pt-1 border-t border-[#2a2a2a]">
                          <Server size={10} />
                          <span className="truncate">
                            via {host.name} ({host.hostname})
                          </span>
                        </div>
                      )}
                    </div>

                    {tunnel.errorMessage && (
                      <p className="text-[11px] text-rose-400 mt-2 font-mono break-all">
                        {tunnel.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* Toggle Button */}
                  <div className="mt-4 pt-3 border-t border-[#2a2a2a] flex items-center justify-between">
                    <span className="text-[11px] text-[#605e5e]">
                      {tunnel.status === 'active' ? 'Tunnel running' : 'Ready to start'}
                    </span>
                    <button
                      onClick={() => handleToggle(tunnel)}
                      disabled={isOperating}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                        tunnel.status === 'active'
                          ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
                          : 'bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] hover:border-[#938a87] text-[#f4f4f5]'
                      }`}
                    >
                      {tunnel.status === 'active' ? (
                        <>
                          <Square size={12} className="fill-current" />
                          <span>Stop Tunnel</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} className="fill-current" />
                          <span>Start Tunnel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tunnel Edit / Create Modal */}
      <TunnelModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={async (tun) => {
          await onSave(tun);
        }}
        initialData={editingTunnel}
        hosts={hosts}
      />

      {/* Error Alert Modal */}
      {errorMessage && (
        <ConfirmModal
          isOpen={!!errorMessage}
          title="Tunnel Error"
          message={errorMessage}
          confirmLabel="Close"
          isAlert={true}
          isDestructive={false}
          onConfirm={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
};
