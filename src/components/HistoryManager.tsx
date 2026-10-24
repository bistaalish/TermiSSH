import React from 'react';
import type { ConnectionHistoryEntry, HostConfig } from '../types';
import {
  History,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
} from 'lucide-react';

interface HistoryManagerProps {
  history: ConnectionHistoryEntry[];
  hosts: HostConfig[];
  onReconnect: (host: HostConfig) => void;
  onClear: () => void;
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  history,
  hosts,
  onReconnect,
  onClear,
}) => {
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#363636] bg-[#19191a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f5] flex items-center space-x-2">
            <History className="text-[#938a87]" size={22} />
            <span>Connection History & Audit Log</span>
          </h1>
          <p className="text-xs text-[#938a87] mt-1">
            Audit trail of past SSH sessions, connection durations, timestamps, and error diagnostics.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClear}
            className="px-3.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* History Table */}
      <div className="p-6 flex-1">
        {history.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-[#605e5e]">
            <Clock size={36} className="text-[#605e5e] mb-3" />
            <p className="text-sm font-medium text-[#f4f4f5]">No session history yet</p>
            <p className="text-xs text-[#938a87] mt-1">
              Sessions will be automatically logged here whenever you connect to a host.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#363636] overflow-hidden bg-[#19191a] shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#19191a] text-[#938a87] border-b border-[#363636]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Host Name</th>
                  <th className="py-2.5 px-4 font-semibold">Started At</th>
                  <th className="py-2.5 px-4 font-semibold">Closed At</th>
                  <th className="py-2.5 px-4 font-semibold">Notes / Diagnostics</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {history.map((item) => {
                  const host = hosts.find((h) => h.id === item.hostId);
                  return (
                    <tr key={item.id} className="hover:bg-[#2a2a2a]/40 transition-colors">
                      <td className="py-2.5 px-4">
                        {item.status === 'connected' ? (
                          <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 size={13} />
                            <span>Connected</span>
                          </span>
                        ) : item.status === 'failed' ? (
                          <span className="flex items-center space-x-1.5 text-rose-400 font-medium">
                            <XCircle size={13} />
                            <span>Failed</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1.5 text-[#605e5e] font-medium">
                            <Clock size={13} />
                            <span>Closed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#f4f4f5]">
                        <div className="flex items-center space-x-2">
                          <Server size={13} className="text-[#938a87] shrink-0" />
                          <span>{item.hostName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#938a87]">
                        {formatDate(item.connectedAt)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#938a87]">
                        {item.disconnectedAt ? formatDate(item.disconnectedAt) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-[#938a87] font-mono text-[11px]">
                        {item.errorMessage ? (
                          <span className="text-rose-400">{item.errorMessage}</span>
                        ) : (
                          <span className="text-[#605e5e]">Normal disconnection</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {host && (
                          <button
                            onClick={() => onReconnect(host)}
                            className="px-2.5 py-1 rounded-md bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] text-[#f4f4f5] text-[11px] font-semibold inline-flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                          >
                            <Play size={11} className="fill-current" />
                            <span>Reconnect</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
