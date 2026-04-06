import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, File, Moon, Sun, Monitor, PanelLeft, TerminalSquare, Play, Plus, FolderPlus, Palette, ArrowLeft } from 'lucide-react';
import { useIdeStore } from '../store/useIdeStore';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  onRunProject: () => void;
  onBackToProjects: () => void;
}

export function CommandPalette({ onRunProject, onBackToProjects }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { 
    files, openFile, setCommandPaletteOpen, toggleSidebar, 
    setTheme, theme, setSidebarView, createFile
  } = useIdeStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands: Command[] = useMemo(() => {
    const cmds: Command[] = [
      { id: 'run', label: 'Run Project', description: 'Open live preview', icon: <Play size={16} />, action: () => { onRunProject(); setCommandPaletteOpen(false); }, shortcut: 'Ctrl+R' },
      { id: 'new-file', label: 'New File', icon: <Plus size={16} />, action: () => { 
        const name = prompt('File name:'); 
        if (name) { const id = createFile(name, 'root', 'file'); openFile(id); } 
        setCommandPaletteOpen(false); 
      }, shortcut: 'Ctrl+N' },
      { id: 'new-folder', label: 'New Folder', icon: <FolderPlus size={16} />, action: () => { 
        const name = prompt('Folder name:'); 
        if (name) createFile(name, 'root', 'folder'); 
        setCommandPaletteOpen(false); 
      }},
      { id: 'format', label: 'Format Document', icon: <Palette size={16} />, action: async () => {
        const state = useIdeStore.getState();
        const activeFile = state.files[state.activeFileId!];
        if (activeFile && activeFile.content) {
          try {
            const { formatCode } = await import('../lib/formatter');
            const formatted = await formatCode(activeFile.content, activeFile.language || 'plaintext');
            if (formatted && formatted !== activeFile.content) {
               state.updateFileContent(state.activeFileId!, formatted);
            }
          } catch(e) {}
        }
        setCommandPaletteOpen(false); 
      }, shortcut: 'Shift+Alt+F' },
      { id: 'toggle-sidebar', label: 'Toggle Sidebar', icon: <PanelLeft size={16} />, action: () => { toggleSidebar(); setCommandPaletteOpen(false); }, shortcut: 'Ctrl+B' },
      { id: 'explorer', label: 'Show Explorer', icon: <PanelLeft size={16} />, action: () => { setSidebarView('explorer'); setCommandPaletteOpen(false); }},
      { id: 'search', label: 'Show Search', icon: <Search size={16} />, action: () => { setSidebarView('search'); setCommandPaletteOpen(false); }},
      { id: 'terminal', label: 'Show Terminal', icon: <TerminalSquare size={16} />, action: () => { setCommandPaletteOpen(false); }},
      { id: 'theme-dark', label: 'Theme: Dark', icon: <Moon size={16} />, action: () => { setTheme('vs-dark'); setCommandPaletteOpen(false); }},
      { id: 'theme-light', label: 'Theme: Light', icon: <Sun size={16} />, action: () => { setTheme('light'); setCommandPaletteOpen(false); }},
      { id: 'theme-hc', label: 'Theme: High Contrast', icon: <Monitor size={16} />, action: () => { setTheme('hc-black'); setCommandPaletteOpen(false); }},
      { id: 'back', label: 'Back to Projects', icon: <ArrowLeft size={16} />, action: () => { onBackToProjects(); setCommandPaletteOpen(false); }},
    ];

    // Add all files as "Open File" commands
    Object.values(files).forEach(file => {
      if (file.type === 'file') {
        cmds.push({
          id: `open-${file.id}`,
          label: file.name,
          description: 'Open file',
          icon: <File size={16} />,
          action: () => { openFile(file.id); setCommandPaletteOpen(false); },
        });
      }
    });

    return cmds;
  }, [files, theme]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => 
      c.label.toLowerCase().includes(q) || 
      c.description?.toLowerCase().includes(q)
    );
  }, [query, commands]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] sm:pt-[10vh]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setCommandPaletteOpen(false)} />
      
      <div className="relative w-[95%] max-w-lg bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-scale-in">
        {/* Search Input */}
        <div className="flex items-center border-b border-[#3c3c3c] px-4">
          <Search size={16} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or file name..."
            className="w-full bg-transparent py-3.5 px-3 text-white text-base placeholder-gray-500 focus:outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No matching commands</div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer mx-1 rounded-lg transition-colors ${
                i === selectedIndex ? 'bg-[#094771] text-white' : 'text-gray-300 hover:bg-[#2a2d2e]'
              }`}
              onClick={cmd.action}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="text-gray-400 flex-shrink-0">{cmd.icon}</span>
                <span className="truncate text-sm">{cmd.label}</span>
                {cmd.description && (
                  <span className="text-xs text-gray-500 truncate">{cmd.description}</span>
                )}
              </div>
              {cmd.shortcut && (
                <span className="text-xs text-gray-500 ml-4 flex-shrink-0 bg-[#333] px-1.5 py-0.5 rounded font-mono">
                  {cmd.shortcut}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
