import React, { useState, useEffect } from 'react';
import type { HostConfig, HostGroup, SSHKeyItem, AuthType, NetworkProtocol, SerialPortInfo } from '../types';
import { api } from '../services/api';
import {
  X,
  Server,
  Lock,
  KeyRound,
  Shield,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Clock,
  Radio,
  Cloud,
  FileCode,
  Cable,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface HostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (host: Partial<HostConfig>) => Promise<void> | void;
  initialData?: HostConfig | null;
  groups: HostGroup[];
  keys: SSHKeyItem[];
  allHosts: HostConfig[];
}

export const HostModal: React.FC<HostModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  groups,
  keys,
  allHosts,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [protocol, setProtocol] = useState<NetworkProtocol>('ssh');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [dataBits, setDataBits] = useState<number>(8);
  const [stopBits, setStopBits] = useState<number>(1);
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [flowControl, setFlowControl] = useState<'none' | 'hardware' | 'software'>('none');
  const [availablePorts, setAvailablePorts] = useState<SerialPortInfo[]>([]);
  const [isScanningPorts, setIsScanningPorts] = useState<boolean>(false);
  const [showAdvancedSerial, setShowAdvancedSerial] = useState<boolean>(false);
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [groupId, setGroupId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(15);
  const [keepaliveInterval, setKeepaliveInterval] = useState(30);
  const [jumpHostId, setJumpHostId] = useState('');
  const [proxyCommand, setProxyCommand] = useState('');
  const [identityFile, setIdentityFile] = useState('');
  const [terminalTheme, setTerminalTheme] = useState('dark');
  const [fontSize, setFontSize] = useState(14);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scanSerialPorts = async () => {
    setIsScanningPorts(true);
    try {
      const ports = await api.listSerialPorts();
      setAvailablePorts(ports);
      return ports;
    } catch (err) {
      console.warn('Failed to list serial ports:', err);
      return [];
    } finally {
      setIsScanningPorts(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setHostname(initialData.hostname || '');
      setPort(initialData.port || 22);
      setUsername(initialData.username || 'root');
      setProtocol(initialData.protocol || 'ssh');
      setBaudRate(initialData.baudRate || 9600);
      setDataBits(initialData.dataBits || 8);
      setStopBits(initialData.stopBits || 1);
      setParity(initialData.parity || 'none');
      setFlowControl(initialData.flowControl || 'none');
      setAuthType(initialData.authType || 'password');
      setPassword(initialData.password || '');
      setKeyId(initialData.keyId || '');
      setKeyPassphrase(initialData.keyPassphrase || '');
      setGroupId(initialData.groupId || '');
      setTagsInput(initialData.tags?.join(', ') || '');
      setTimeoutSeconds(initialData.timeoutSeconds || 15);
      setKeepaliveInterval(initialData.keepaliveInterval || 30);
      setJumpHostId(initialData.jumpHostId || '');
      setProxyCommand(initialData.proxyCommand || '');
      setIdentityFile(initialData.identityFile || '');
      setTerminalTheme(initialData.terminalTheme || 'dark');
      setFontSize(initialData.fontSize || 14);

      if (initialData.protocol === 'serial') {
        scanSerialPorts();
      }
    } else {
      setName('');
      setDescription('');
      setHostname('');
      setPort(22);
      setUsername('root');
      setProtocol('ssh');
      setBaudRate(9600);
      setDataBits(8);
      setStopBits(1);
      setParity('none');
      setFlowControl('none');
      setShowAdvancedSerial(false);
      setAuthType('password');
      setPassword('');
      setKeyId(keys.length > 0 ? keys[0].id : '');
      setKeyPassphrase('');
      setGroupId('');
      setTagsInput('');
      setTimeoutSeconds(15);
      setKeepaliveInterval(30);
      setJumpHostId('');
      setProxyCommand('');
      setIdentityFile('');
      setTerminalTheme('dark');
      setFontSize(14);
    }
    setErrors({});
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Host / Device label is required';

    if (protocol === 'serial') {
      if (!hostname.trim()) errs.hostname = 'Serial port device path is required (e.g. /dev/ttyUSB0)';
      if (!baudRate || baudRate <= 0) errs.baudRate = 'Valid baud rate is required';
    } else {
      if (!hostname.trim()) errs.hostname = 'Hostname or IP is required';
      if (!username.trim()) errs.username = 'Username is required';
      if (port <= 0 || port > 65535) errs.port = 'Invalid port (1-65535)';
      if (protocol === 'ssh' && authType === 'private_key' && !keyId && !identityFile.trim()) {
        errs.keyId = 'Select an SSH key or specify an IdentityFile';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await onSave({
        id: initialData?.id || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        hostname: hostname.trim(),
        port: protocol === 'serial' ? (baudRate > 65535 ? 9600 : Number(baudRate)) : Number(port),
        username: protocol === 'serial' ? (username.trim() || 'console') : username.trim(),
        protocol,
        baudRate: protocol === 'serial' ? Number(baudRate) : undefined,
        dataBits: protocol === 'serial' ? Number(dataBits) : undefined,
        stopBits: protocol === 'serial' ? Number(stopBits) : undefined,
        parity: protocol === 'serial' ? parity : undefined,
        flowControl: protocol === 'serial' ? flowControl : undefined,
        authType: protocol === 'serial' ? 'none' : authType,
        password: protocol === 'ssh' && authType === 'password' ? password : undefined,
        keyId: protocol === 'ssh' && authType === 'private_key' ? keyId : undefined,
        keyPassphrase: protocol === 'ssh' && authType === 'private_key' && keyPassphrase ? keyPassphrase : undefined,
        groupId: groupId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        timeoutSeconds: Number(timeoutSeconds),
        keepaliveInterval: Number(keepaliveInterval),
        jumpHostId: jumpHostId || undefined,
        proxyCommand: proxyCommand.trim() || undefined,
        identityFile: identityFile.trim() || undefined,
        terminalTheme,
        fontSize: Number(fontSize),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save host:', err);
      setErrors({ form: typeof err === 'string' ? err : 'Failed to save host configuration' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#19191a] border border-[#363636] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-[#2a2a2a] flex items-center justify-between bg-[#19191a]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] text-[#f4f4f5] border border-[#363636] flex items-center justify-center shadow-xs">
              <Server size={18} />
            </div>
            <h2 className="text-base font-bold text-[#f4f4f5]">
              {initialData ? 'Edit Host Configuration' : 'New Host Configuration'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#605e5e] hover:text-[#f4f4f5] hover:bg-[#2a2a2a] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#2a2a2a] bg-[#19191a] px-6">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'basic'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Connection Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'advanced'
                ? 'border-[#f4f4f5] text-[#f4f4f5]'
                : 'border-transparent text-[#605e5e] hover:text-[#938a87]'
            }`}
          >
            Advanced &amp; Terminal Settings
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'basic' ? (
            <>
              {/* Host Label & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1">
                    Host Label <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Production Web 01"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] focus:ring-1 focus:ring-[#938a87]"
                  />
                  {errors.name && <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1">Group</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="" className="bg-[#19191a] text-[#f4f4f5]">(No Group)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#19191a] text-[#f4f4f5]">
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Protocol Selector: SSH vs Telnet vs Serial */}
              <div>
                <label className="block text-xs font-medium text-[#938a87] mb-1.5">
                  Connection Protocol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProtocol('ssh');
                      if (port === 23) setPort(22);
                      if (hostname.startsWith('/dev/')) setHostname('');
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                      protocol === 'ssh'
                        ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] shadow-xs'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                    }`}
                  >
                    <Shield size={14} className={protocol === 'ssh' ? 'text-[#f4f4f5]' : 'text-[#605e5e]'} />
                    <span>SSH Protocol</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProtocol('telnet');
                      if (port === 22) setPort(23);
                      if (hostname.startsWith('/dev/')) setHostname('');
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                      protocol === 'telnet'
                        ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] shadow-xs'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                    }`}
                  >
                    <Radio size={14} className={protocol === 'telnet' ? 'text-[#f4f4f5]' : 'text-[#605e5e]'} />
                    <span>Telnet Protocol</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProtocol('serial');
                      const ports = await scanSerialPorts();
                      if ((!hostname || !hostname.startsWith('/dev/')) && ports.length > 0) {
                        setHostname(ports[0].path);
                      } else if (!hostname) {
                        setHostname('/dev/ttyUSB0');
                      }
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-all ${
                      protocol === 'serial'
                        ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5] shadow-xs'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                    }`}
                  >
                    <Cable size={14} className={protocol === 'serial' ? 'text-[#f4f4f5]' : 'text-[#605e5e]'} />
                    <span>Serial Console</span>
                  </button>
                </div>
              </div>

              {protocol === 'serial' ? (
                /* Serial Console Interface */
                <div className="space-y-4">
                  {/* Serial Port Path and Scanner */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-[#938a87] flex items-center space-x-1.5">
                        <Cable size={13} className="text-[#938a87]" />
                        <span>Serial Device Port</span>
                        <span className="text-rose-400">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={scanSerialPorts}
                        disabled={isScanningPorts}
                        className="text-[11px] text-[#f4f4f5] hover:text-white bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center space-x-1"
                      >
                        <RefreshCw size={11} className={isScanningPorts ? 'animate-spin' : ''} />
                        <span>{isScanningPorts ? 'Scanning...' : 'Scan Ports'}</span>
                      </button>
                    </div>

                    {availablePorts.length > 0 && (
                      <div className="mb-2">
                        <select
                          value={availablePorts.some((p) => p.path === hostname) ? hostname : ''}
                          onChange={(e) => {
                            if (e.target.value) setHostname(e.target.value);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        >
                          <option value="" className="bg-[#19191a] text-[#938a87]">
                            -- Select detected serial device ({availablePorts.length} found) --
                          </option>
                          {availablePorts.map((p) => (
                            <option key={p.path} value={p.path} className="bg-[#19191a] text-[#f4f4f5]">
                              {p.path} {p.description ? `— ${p.description}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="e.g. /dev/ttyUSB0, /dev/ttyACM0, /dev/ttyS0, COM1..."
                      value={hostname}
                      onChange={(e) => setHostname(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] focus:ring-1 focus:ring-[#938a87] font-mono"
                    />
                    {errors.hostname && <p className="text-[11px] text-rose-400 mt-1">{errors.hostname}</p>}

                    {/* Common Port Presets */}
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-[10px] text-[#605e5e]">Quick paths:</span>
                      {['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0', '/dev/ttyS0'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setHostname(p)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer font-mono transition-colors ${
                            hostname === p
                              ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                              : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                          }`}
                        >
                          {p.replace('/dev/', '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Baud Rate & Data Bits */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#938a87] mb-1">
                        Baud Rate (Speed) <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={baudRate}
                        onChange={(e) => setBaudRate(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        <option value={9600} className="bg-[#19191a] text-[#f4f4f5]">9600 baud (Cisco default)</option>
                        <option value={115200} className="bg-[#19191a] text-[#f4f4f5]">115200 baud (Embedded / Linux)</option>
                        <option value={57600} className="bg-[#19191a] text-[#f4f4f5]">57600 baud</option>
                        <option value={38400} className="bg-[#19191a] text-[#f4f4f5]">38400 baud</option>
                        <option value={19200} className="bg-[#19191a] text-[#f4f4f5]">19200 baud</option>
                        <option value={230400} className="bg-[#19191a] text-[#f4f4f5]">230400 baud</option>
                        <option value={460800} className="bg-[#19191a] text-[#f4f4f5]">460800 baud</option>
                        <option value={921600} className="bg-[#19191a] text-[#f4f4f5]">921600 baud</option>
                      </select>
                      {errors.baudRate && <p className="text-[11px] text-rose-400 mt-1">{errors.baudRate}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#938a87] mb-1">
                        Device Name / Prompt
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cisco Switch / Router Console"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] font-mono"
                      />
                    </div>
                  </div>

                  {/* Collapsible Advanced Line Parameters (8N1) */}
                  <div className="border border-[#2a2a2a] rounded-xl overflow-hidden bg-[#19191a]">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedSerial(!showAdvancedSerial)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-medium text-[#938a87] hover:text-[#f4f4f5] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <Sliders size={13} className="text-[#938a87]" />
                        <span>
                          Serial Line Settings ({dataBits}{parity === 'none' ? 'N' : parity[0].toUpperCase()}{stopBits}, Flow: {flowControl})
                        </span>
                      </div>
                      {showAdvancedSerial ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showAdvancedSerial && (
                      <div className="p-3 border-t border-[#2a2a2a] grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#0a0a0a]">
                        <div>
                          <label className="block text-[11px] text-[#938a87] mb-1">Data Bits</label>
                          <select
                            value={dataBits}
                            onChange={(e) => setDataBits(Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded bg-[#19191a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value={8} className="bg-[#19191a] text-[#f4f4f5]">8 bits (Standard)</option>
                            <option value={7} className="bg-[#19191a] text-[#f4f4f5]">7 bits</option>
                            <option value={6} className="bg-[#19191a] text-[#f4f4f5]">6 bits</option>
                            <option value={5} className="bg-[#19191a] text-[#f4f4f5]">5 bits</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#938a87] mb-1">Stop Bits</label>
                          <select
                            value={stopBits}
                            onChange={(e) => setStopBits(Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded bg-[#19191a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value={1} className="bg-[#19191a] text-[#f4f4f5]">1 stop bit</option>
                            <option value={2} className="bg-[#19191a] text-[#f4f4f5]">2 stop bits</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#938a87] mb-1">Parity</label>
                          <select
                            value={parity}
                            onChange={(e) => setParity(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-[#19191a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="none" className="bg-[#19191a] text-[#f4f4f5]">None (N)</option>
                            <option value="even" className="bg-[#19191a] text-[#f4f4f5]">Even (E)</option>
                            <option value="odd" className="bg-[#19191a] text-[#f4f4f5]">Odd (O)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-[#938a87] mb-1">Flow Control</label>
                          <select
                            value={flowControl}
                            onChange={(e) => setFlowControl(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-[#19191a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                            style={{ colorScheme: 'dark' }}
                          >
                            <option value="none" className="bg-[#19191a] text-[#f4f4f5]">None</option>
                            <option value="hardware" className="bg-[#19191a] text-[#f4f4f5]">RTS/CTS</option>
                            <option value="software" className="bg-[#19191a] text-[#f4f4f5]">XON/XOFF</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Serial Info Banner */}
                  <div className="p-3.5 bg-[#2a2a2a] border border-[#363636] rounded-xl text-xs text-[#938a87] flex items-start space-x-3 shadow-xs">
                    <Cable size={18} className="mt-0.5 shrink-0 text-[#938a87]" />
                    <div>
                      <p className="font-semibold text-[#f4f4f5]">
                        Serial Console Mode ({hostname || '/dev/ttyUSB0'} @ {baudRate} baud, {dataBits}{parity === 'none' ? 'N' : parity[0].toUpperCase()}{stopBits})
                      </p>
                      <p className="text-[11px] text-[#938a87] mt-1 leading-relaxed">
                        Direct hardware UART connection to networking switches, routers, firewalls, and embedded single-board computers (FTDI, CH340, CP2102, PL2303, Cisco RJ45-to-USB). Terminal session connects directly to character stream.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hostname & Port */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-[#938a87] mb-1">
                        Hostname or IP Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="192.168.1.100 or server.domain.com"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] focus:ring-1 focus:ring-[#938a87] font-mono"
                      />
                      {errors.hostname && <p className="text-[11px] text-rose-400 mt-1">{errors.hostname}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#938a87] mb-1">
                        Port <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(parseInt(e.target.value) || (protocol === 'telnet' ? 23 : 22))}
                        className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                      />
                      {errors.port && <p className="text-[11px] text-rose-400 mt-1">{errors.port}</p>}
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-xs font-medium text-[#938a87] mb-1">
                      Username <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="root, admin, debian..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] font-mono"
                    />
                    {errors.username && <p className="text-[11px] text-rose-400 mt-1">{errors.username}</p>}
                  </div>

                  {protocol === 'telnet' ? (
                    /* Telnet Info Banner */
                    <div className="p-3.5 bg-[#2a2a2a] border border-[#363636] rounded-xl text-xs text-[#938a87] flex items-start space-x-3 shadow-xs">
                      <Radio size={18} className="mt-0.5 shrink-0 text-[#938a87]" />
                      <div>
                        <p className="font-semibold text-[#f4f4f5]">Telnet Terminal Mode (Port {port})</p>
                        <p className="text-[11px] text-[#938a87] mt-1 leading-relaxed">
                          Telnet communicates directly with the network device using RFC 854 option negotiation. Interactive authentication (login prompt, username, and password) is handled directly inside the terminal session upon connection.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Authentication Type Selector */}
                      <div>
                        <label className="block text-xs font-medium text-[#938a87] mb-1.5">
                          Authentication Method
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setAuthType('password')}
                            className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors ${
                              authType === 'password'
                                ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                                : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                            }`}
                          >
                            <Lock size={13} />
                            <span>Password</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthType('private_key')}
                            className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors ${
                              authType === 'private_key'
                                ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                                : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                            }`}
                          >
                            <KeyRound size={13} />
                            <span>SSH Key</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthType('agent')}
                            className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 cursor-pointer transition-colors ${
                              authType === 'agent'
                                ? 'bg-[#2a2a2a] border-[#363636] text-[#f4f4f5]'
                                : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#605e5e] hover:text-[#938a87]'
                            }`}
                          >
                            <Shield size={13} />
                            <span>SSH Agent</span>
                          </button>
                        </div>
                      </div>

                      {/* Auth Credentials Inputs */}
                      {authType === 'password' && (
                        <div>
                          <label className="block text-xs font-medium text-[#938a87] mb-1">
                            Server Password
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter server password..."
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full pl-3 pr-10 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#605e5e] hover:text-[#f4f4f5]"
                            >
                              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                          <p className="text-[10px] text-[#605e5e] mt-1">
                            Passwords are saved securely into the Linux System Keyring (GNOME Keyring / Secret Service).
                          </p>
                        </div>
                      )}

                      {authType === 'private_key' && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-[#938a87]">
                                SSH Key Selection <span className="text-rose-400">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setIdentityFile('~/.ssh/id_ed25519');
                                  setKeyId('');
                                }}
                                className="text-[10px] text-[#f4f4f5] hover:text-white bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] px-2 py-0.5 rounded cursor-pointer transition-colors shadow-xs"
                              >
                                Use ~/.ssh/id_ed25519
                              </button>
                            </div>
                            <select
                              value={keyId}
                              onChange={(e) => {
                                setKeyId(e.target.value);
                                if (e.target.value) setIdentityFile('');
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
                              style={{ colorScheme: 'dark' }}
                            >
                              <option value="" className="bg-[#19191a] text-[#938a87]">
                                {identityFile ? `Using Custom Key (${identityFile})` : 'Select a Vault Key or enter IdentityFile below...'}
                              </option>
                              {keys.map((k) => (
                                <option key={k.id} value={k.id} className="bg-[#19191a] text-[#f4f4f5]">
                                  {k.name} ({k.keyType.toUpperCase()} - {k.fingerprintSha256.substring(0, 16)}...)
                                </option>
                              ))}
                            </select>
                            {identityFile && (
                              <p className="text-[11px] font-mono text-[#938a87] mt-1 flex items-center space-x-1">
                                <span>Using IdentityFile:</span>
                                <span className="font-semibold text-[#f4f4f5]">{identityFile}</span>
                              </p>
                            )}
                            {errors.keyId && <p className="text-[11px] text-rose-400 mt-1">{errors.keyId}</p>}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#938a87] mb-1">
                              Key Passphrase (Optional)
                            </label>
                            <input
                              type="password"
                              placeholder="Passphrase if private key is encrypted..."
                              value={keyPassphrase}
                              onChange={(e) => setKeyPassphrase(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Description & Tags */}
              <div>
                <label className="block text-xs font-medium text-[#938a87] mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. prod, web, aws, database"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                />
              </div>
            </>
          ) : (
            <>
              {/* Advanced Settings Tab */}
              {/* ProxyCommand / Cloudflare Tunnel */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#938a87] flex items-center space-x-1.5">
                    <Cloud size={13} className="text-[#938a87]" />
                    <span>ProxyCommand (Cloudflare Tunnel / Custom Proxy)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setProxyCommand('/usr/local/bin/cloudflared access ssh --hostname %h')}
                    className="text-[10px] text-[#f4f4f5] hover:text-white bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    + Use cloudflared
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. /usr/local/bin/cloudflared access ssh --hostname %h"
                  value={proxyCommand}
                  onChange={(e) => setProxyCommand(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] font-mono"
                />
                <p className="text-[10px] text-[#605e5e] mt-1">
                  Connects through Cloudflare Zero Trust, netcat, or local command pipe (%h = host, %p = port). If left empty, automatically inherits from ~/.ssh/config.
                </p>
              </div>

              {/* Custom IdentityFile Path */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#938a87] flex items-center space-x-1.5">
                    <FileCode size={13} className="text-[#938a87]" />
                    <span>OpenSSH Identity File (Private Key)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIdentityFile('~/.ssh/id_ed25519')}
                    className="text-[10px] text-[#f4f4f5] hover:text-white bg-[#2a2a2a] hover:bg-[#363636] border border-[#363636] px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    + ~/.ssh/id_ed25519
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. ~/.ssh/id_ed25519"
                  value={identityFile}
                  onChange={(e) => setIdentityFile(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636] font-mono"
                />
                <p className="text-[10px] text-[#605e5e] mt-1">
                  Direct filesystem path to an OpenSSH private key. If empty, automatically checks ~/.ssh/config and default user keys.
                </p>
              </div>

              {/* ProxyJump / Jump Host */}
              <div>
                <label className="block text-xs font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
                  <Layers size={13} className="text-[#938a87]" />
                  <span>SSH Jump Host / Bastion Proxy</span>
                </label>
                <select
                  value={jumpHostId}
                  onChange={(e) => setJumpHostId(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
                >
                  <option value="" className="bg-[#19191a] text-[#f4f4f5]">Direct Connection (No Jump Host)</option>
                  {allHosts
                    .filter((h) => h.id !== initialData?.id)
                    .map((h) => (
                      <option key={h.id} value={h.id} className="bg-[#19191a] text-[#f4f4f5]">
                        {h.name} ({h.username}@{h.hostname}:{h.port})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-[#605e5e] mt-1">
                  Routes traffic transparently through a bastion server (equivalent to OpenSSH ProxyJump).
                </p>
              </div>

              {/* Timeouts and Keepalive */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
                    <Clock size={13} className="text-[#938a87]" />
                    <span>Connection Timeout (sec)</span>
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 15)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
                    <Radio size={13} className="text-[#938a87]" />
                    <span>Keepalive Interval (sec)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={keepaliveInterval}
                    onChange={(e) => setKeepaliveInterval(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                  />
                </div>
              </div>

              {/* Terminal Appearance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1 flex items-center space-x-1.5">
                    <Palette size={13} className="text-[#938a87]" />
                    <span>Terminal Theme</span>
                  </label>
                  <select
                    value={terminalTheme}
                    onChange={(e) => setTerminalTheme(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636]"
                  >
                    <option value="dark" className="bg-[#19191a] text-[#f4f4f5]">Dark Navigation (Default)</option>
                    <option value="matrix" className="bg-[#19191a] text-[#f4f4f5]">Matrix Hacker</option>
                    <option value="monokai" className="bg-[#19191a] text-[#f4f4f5]">Monokai Pro</option>
                    <option value="dracula" className="bg-[#19191a] text-[#f4f4f5]">Dracula</option>
                    <option value="nord" className="bg-[#19191a] text-[#f4f4f5]">Nordic Frost</option>
                    <option value="onedark" className="bg-[#19191a] text-[#f4f4f5]">One Dark</option>
                    <option value="light" className="bg-[#19191a] text-[#f4f4f5]">Solarized Light</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#938a87] mb-1">
                    Font Size (pt)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={28}
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] focus:outline-none focus:border-[#363636] font-mono"
                  />
                </div>
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-xs font-medium text-[#938a87] mb-1">
                  Host Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes, architecture role, environment details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] text-xs text-[#f4f4f5] placeholder-[#605e5e] focus:outline-none focus:border-[#363636]"
                />
              </div>
            </>
          )}

          {/* Form Level Error */}
          {errors.form && (
            <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-lg">
              {errors.form}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#2a2a2a] flex items-center justify-end space-x-3">
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
              {initialData ? 'Update Host' : 'Save Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
