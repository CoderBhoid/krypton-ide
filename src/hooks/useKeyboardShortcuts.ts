import { useEffect } from 'react';
import { useIdeStore } from '../store/useIdeStore';

interface KeyboardShortcutsOptions {
  onRun: () => void;
  onToggleTerminal: () => void;
}

export function useKeyboardShortcuts({ onRun, onToggleTerminal }: KeyboardShortcutsOptions) {
  const { 
    activeFileId, saveFile, saveAllFiles, setCommandPaletteOpen, 
    toggleSidebar, createFile, openFile
  } = useIdeStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      
      // Ctrl+S — Save
      if (isCtrl && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          saveAllFiles();
        } else if (activeFileId) {
          saveFile(activeFileId);
        }
        return;
      }

      // Ctrl+Shift+P — Command Palette
      if (isCtrl && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Ctrl+P — Quick Open (also opens command palette in file mode)
      if (isCtrl && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Ctrl+B — Toggle Sidebar
      if (isCtrl && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Ctrl+` — Toggle Terminal
      if (isCtrl && e.key === '`') {
        e.preventDefault();
        onToggleTerminal();
        return;
      }

      // Ctrl+R — Run
      if (isCtrl && e.key === 'r') {
        e.preventDefault();
        onRun();
        return;
      }

      // Ctrl+N — New File
      if (isCtrl && e.key === 'n') {
        e.preventDefault();
        const name = prompt('File name:');
        if (name) {
          const id = createFile(name, 'root', 'file');
          openFile(id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, saveFile, saveAllFiles, setCommandPaletteOpen, toggleSidebar, createFile, openFile, onRun, onToggleTerminal]);
}
