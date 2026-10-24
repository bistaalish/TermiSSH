import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { api } from '../services/api';
import { Search, X, Copy, Clipboard, RotateCcw } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string;
  isActive: boolean;
  fontSize?: number;
  fontFamily?: string;
  theme?: string;
  onExit?: () => void;
}

export const TerminalViewComponent: React.FC<TerminalViewProps> = ({
  sessionId,
  isActive,
  fontSize = 14,
  fontFamily = 'Menlo, Monaco, "Courier New", monospace',
  theme = 'dark',
  onExit,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Theme palettes
  const getThemeColors = (t: string) => {
    switch (t) {
      case 'monokai':
        return {
          background: '#272822',
          foreground: '#f8f8f2',
          cursor: '#f8f8f0',
          selectionBackground: 'rgba(255, 255, 255, 0.25)',
          black: '#272822',
          red: '#f92672',
          green: '#a6e22e',
          yellow: '#f4bf75',
          blue: '#66d9ef',
          magenta: '#ae81ff',
          cyan: '#a1efe4',
          white: '#f8f8f2',
        };
      case 'dracula':
        return {
          background: '#282a36',
          foreground: '#f8f8f2',
          cursor: '#50fa7b',
          selectionBackground: '#44475a',
          black: '#21222c',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#bd93f9',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#f8f8f2',
        };
      case 'nord':
        return {
          background: '#2e3440',
          foreground: '#d8dee9',
          cursor: '#eceff4',
          selectionBackground: '#434c5e',
          black: '#3b4252',
          red: '#bf616a',
          green: '#a3be8c',
          yellow: '#ebcb8b',
          blue: '#81a1c1',
          magenta: '#b48ead',
          cyan: '#88c0d0',
          white: '#e5e9f0',
        };
      case 'onedark':
        return {
          background: '#1e222a',
          foreground: '#abb2bf',
          cursor: '#528bff',
          selectionBackground: '#3e4451',
          black: '#1e222a',
          red: '#e06c75',
          green: '#98c379',
          yellow: '#e5c07b',
          blue: '#61afef',
          magenta: '#c678dd',
          cyan: '#56b6c2',
          white: '#abb2bf',
        };
      case 'light':
        return {
          background: '#f8fafc',
          foreground: '#0f172a',
          cursor: '#0284c7',
          selectionBackground: '#cbd5e1',
          black: '#000000',
          red: '#dc2626',
          green: '#16a34a',
          yellow: '#ca8a04',
          blue: '#2563eb',
          magenta: '#9333ea',
          cyan: '#0891b2',
          white: '#ffffff',
        };
      case 'matrix':
        return {
          background: '#040705',
          foreground: '#00ff66',
          cursor: '#00ff66',
          cursorAccent: '#040705',
          selectionBackground: 'rgba(0, 255, 102, 0.3)',
          black: '#070c09',
          red: '#f87171',
          green: '#00ff66',
          yellow: '#facc15',
          blue: '#38bdf8',
          magenta: '#c084fc',
          cyan: '#2dd4bf',
          white: '#d1fae5',
          brightGreen: '#5cff8a',
        };
      case 'dark':
      default: // Octet Dark Navigation Theme
        return {
          background: '#0a0a0a',
          foreground: '#f4f4f5',
          cursor: '#938a87',
          cursorAccent: '#0a0a0a',
          selectionBackground: 'rgba(147, 138, 135, 0.3)',
          black: '#19191a',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#facc15',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#38bdf8',
          white: '#f4f4f5',
          brightBlack: '#605e5e',
          brightRed: '#ef4444',
          brightGreen: '#22c55e',
          brightYellow: '#eab308',
          brightBlue: '#3b82f6',
          brightMagenta: '#a855f7',
          brightCyan: '#06b6d4',
          brightWhite: '#ffffff',
        };
    }
  };

  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !termInstanceRef.current || !sessionId) return;
    try {
      fitAddonRef.current.fit();
      const cols = termInstanceRef.current.cols;
      const rows = termInstanceRef.current.rows;
      if (cols > 0 && rows > 0) {
        api.resizeTerminal(sessionId, cols, rows).catch(() => {});
      }
      termInstanceRef.current.scrollToBottom();
    } catch {
      // ignore fit errors during transitions
    }
  }, [sessionId]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize,
      fontFamily,
      lineHeight: 1.2,
      scrollback: 10000,
      theme: getThemeColors(theme),
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Send initial size
    if (term.cols > 0 && term.rows > 0) {
      api.resizeTerminal(sessionId, term.cols, term.rows).catch(() => {});
    }

    // User typing listener -> send to Tauri backend
    const dataDisposable = term.onData((data) => {
      api.sendTerminalData(sessionId, data).catch((err) => {
        console.error('Failed to send terminal data:', err);
      });
    });

    // Tauri backend incoming stream listener
    let unlistenData: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    api.onTerminalData(sessionId, (data) => {
      term.write(data);
    }).then((unlisten) => {
      unlistenData = unlisten;
    });

    api.onTerminalExit(sessionId, (code) => {
      term.writeln(`\r\n\x1b[33m[Session disconnected: process exited with code ${code}]\x1b[0m\r\n`);
      if (onExitRef.current) onExitRef.current();
    }).then((unlisten) => {
      unlistenExit = unlisten;
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      term.dispose();
    };
  }, [sessionId, handleResize]);

  // Dynamically update theme, font size, and font family without disposing the terminal
  useEffect(() => {
    if (termInstanceRef.current) {
      termInstanceRef.current.options.theme = getThemeColors(theme);
      termInstanceRef.current.options.fontSize = fontSize;
      termInstanceRef.current.options.fontFamily = fontFamily;
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // ignore fit errors during transitions
        }
      }
    }
  }, [theme, fontSize, fontFamily]);

  // Focus term when active
  useEffect(() => {
    if (isActive && termInstanceRef.current) {
      termInstanceRef.current.focus();
      handleResize();
      termInstanceRef.current.scrollToBottom();
    }
  }, [isActive, handleResize]);

  // Handle Search
  const handleSearchNext = () => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findNext(searchTerm);
    }
  };

  const handleSearchPrev = () => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findPrevious(searchTerm);
    }
  };

  // Context Menu Actions
  const handleCopy = () => {
    if (termInstanceRef.current) {
      const selection = termInstanceRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && termInstanceRef.current) {
        api.sendTerminalData(sessionId, text);
      }
    } catch (e) {
      console.warn('Clipboard read error', e);
    }
    setContextMenu(null);
  };

  const handleClear = () => {
    if (termInstanceRef.current) {
      termInstanceRef.current.clear();
    }
    setContextMenu(null);
  };

  return (
    <div
      className={`relative w-full h-full flex flex-col flex-1 min-h-0 ${isActive ? 'flex' : 'hidden'}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => {
        if (contextMenu) setContextMenu(null);
      }}
    >
      {/* Search Overlay */}
      {searchOpen && (
        <div className="absolute top-2 right-4 z-30 bg-[#19191a] border border-[#363636] rounded-lg shadow-2xl p-1.5 flex items-center space-x-2">
          <Search size={14} className="text-[#938a87] ml-1" />
          <input
            type="text"
            placeholder="Search terminal..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (searchAddonRef.current) {
                searchAddonRef.current.findNext(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) handleSearchPrev();
                else handleSearchNext();
              } else if (e.key === 'Escape') {
                setSearchOpen(false);
              }
            }}
            autoFocus
            className="bg-[#0a0a0a] text-xs text-[#f4f4f5] px-2 py-1 rounded outline-none border border-[#2a2a2a] focus:border-[#363636] w-48 font-mono placeholder-[#605e5e]"
          />
          <button
            onClick={handleSearchPrev}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] cursor-pointer"
          >
            Prev
          </button>
          <button
            onClick={handleSearchNext}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#363636] text-[#f4f4f5] border border-[#363636] cursor-pointer"
          >
            Next
          </button>
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 text-[#605e5e] hover:text-[#f4f4f5] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Terminal Viewport */}
      <div ref={terminalRef} className="w-full h-full flex-1 min-h-0 terminal-pane" />

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#19191a] border border-[#363636] rounded-lg shadow-2xl py-1 text-xs text-[#f4f4f5] w-40"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={handleCopy}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
          >
            <Copy size={13} className="text-[#938a87]" />
            <span>Copy</span>
          </button>
          <button
            onClick={handlePaste}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
          >
            <Clipboard size={13} className="text-[#938a87]" />
            <span>Paste</span>
          </button>
          <div className="h-[1px] bg-[#2a2a2a] my-1" />
          <button
            onClick={handleClear}
            className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-[#2a2a2a] hover:text-white cursor-pointer"
          >
            <RotateCcw size={13} className="text-[#938a87]" />
            <span>Clear Buffer</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const TerminalView = React.memo(TerminalViewComponent);
