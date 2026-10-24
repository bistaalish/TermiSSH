import React, { useState, useEffect } from 'react';
import { X, Network, Server } from 'lucide-react';
import type { SSHTunnel, HostConfig, TunnelType } from '../types';

interface TunnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tunnel: Partial<SSHTunnel>) => Promise<void> | void;
  initialData?: SSHTunnel | null;
  hosts: HostConfig[];
}

export const TunnelModal: React.FC<TunnelModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  hosts,
}) => {
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState('');
  const [tunnelType, setTunnelType] = useState<TunnelType>('local');
  const [localHost, setLocalHost] = useState('127.0.0.1');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(80);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || '');
      setHostId(initialData.hostId || (hosts[0]?.id ?? ''));
      setTunnelType(initialData.tunnelType || 'local');
      setLocalHost(initialData.localHost || '127.0.0.1');
      setLocalPort(initialData.localPort || 8080);
      setRemoteHost(initialData.remoteHost || '127.0.0.1');
      setRemotePort(initialData.remotePort || 80);
    } else {
      setName('');
      setHostId(hosts[0]?.id ?? '');
      setTunnelType('local');
      setLocalHost('127.0.0.1');
      setLocalPort(8080);
      setRemoteHost('127.0.0.1');
      setRemotePort(80);
    }
    setErrors({});
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Tunnel name is required';
    if (!hostId) errs.hostId = 'SSH host is required';
    if (localPort <= 0 || localPort > 65535) errs.localPort = 'Invalid local port';
    if (tunnelType !== 'dynamic' && (remotePort <= 0 || remotePort > 65535)) {
      errs.remotePort = 'Invalid remote port';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSave({
        id: initialData?.id,
        name: name.trim(),
        hostId,
        tunnelType,
        localHost: localHost.trim(),
        localPort: Number(localPort),
        remoteHost: tunnelType !== 'dynamic' ? remoteHost.trim() : undefined,
        remotePort: tunnelType !== 'dynamic' ? Number(remotePort) : undefined,
        status: initialData?.status || 'inactive',
      });
      onClose();
    } catch (err) {
      console.error('Failed to save tunnel:', err);
      setErrors({ form: typeof err === 'string' ? err : 'Failed to save tunnel' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
              <Network size={18} />
            </div>
            <h3 className="text-sm font-bold text-[#f4f4f5]">
              {initialData ? 'Edit SSH Tunnel' : 'Create SSH Port Forwarding Tunnel'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs bg-[#0a0a0a]">
          {/* Tunnel Name */}
          <div>
            <label className="block font-medium text-[#938a87] mb-1">
              Tunnel Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Remote PostgreSQL (5432)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
              autoFocus
            />
            {errors.name && <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>}
          </div>

          {/* SSH Host Association */}
          <div>
            <label className="block font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
              <Server size={12} className="text-[#938a87]" />
              <span>Through SSH Host</span> <span className="text-rose-400">*</span>
            </label>
            <select
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id} className="bg-[#19191a] text-[#f4f4f5]">
                  {h.name} ({h.username}@{h.hostname}:{h.port})
                </option>
              ))}
            </select>
          </div>

          {/* Forwarding Type Selection */}
          <div>
            <label className="block font-medium text-[#938a87] mb-1.5">Forwarding Mode</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTunnelType('local')}
                className={`py-2 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  tunnelType === 'local'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                Local (-L)
              </button>
              <button
                type="button"
                onClick={() => setTunnelType('remote')}
                className={`py-2 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  tunnelType === 'remote'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                Remote (-R)
              </button>
              <button
                type="button"
                onClick={() => setTunnelType('dynamic')}
                className={`py-2 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                  tunnelType === 'dynamic'
                    ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] font-bold shadow-xs'
                    : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                }`}
              >
                Dynamic SOCKS5 (-D)
              </button>
            </div>
            <p className="text-[10px] text-[#605e5e] mt-1.5">
              {tunnelType === 'local' &&
                'Local Forwarding: Opens a port on your machine and forwards traffic through SSH to the remote target.'}
              {tunnelType === 'remote' &&
                'Remote Forwarding: Opens a port on the remote SSH server and routes traffic back to your machine.'}
              {tunnelType === 'dynamic' &&
                'Dynamic Forwarding: Turns the SSH connection into a local SOCKS5 proxy for all network applications.'}
            </p>
          </div>

          {/* Local Binding */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-medium text-[#938a87] mb-1">Local Bind Address</label>
              <input
                type="text"
                value={localHost}
                onChange={(e) => setLocalHost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#938a87] mb-1">Local Port</label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(parseInt(e.target.value) || 8080)}
                className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
              />
            </div>
          </div>

          {/* Remote Destination (not used in Dynamic) */}
          {tunnelType !== 'dynamic' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block font-medium text-[#938a87] mb-1">Remote Target Host</label>
                <input
                  type="text"
                  placeholder="127.0.0.1 or internal.db"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#938a87] mb-1">Remote Port</label>
                <input
                  type="number"
                  value={remotePort}
                  onChange={(e) => setRemotePort(parseInt(e.target.value) || 80)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] font-mono focus:outline-none focus:border-[#363636]"
                />
              </div>
            </div>
          )}

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
              {initialData ? 'Update Tunnel' : 'Create Tunnel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
