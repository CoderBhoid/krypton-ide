import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { CodeEditor } from '../editor/CodeEditor';
import { BottomPanel } from '../terminal/BottomPanel';
import { ActivityBar } from '../sidebar/ActivityBar';
import { StatusBar } from './StatusBar';
import { LivePreview } from '../preview/LivePreview';
import { CommandPalette } from '../CommandPalette';
import { SettingsPanel } from '../sidebar/SettingsPanel';
import { ExtensionsPanel } from '../sidebar/ExtensionsPanel';
import { useIdeStore } from '../../store/useIdeStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { ArrowLeft, Play, Upload, Download, Files, TerminalSquare, Puzzle, Bot, Settings, ChevronLeft } from 'lucide-react';
import JSZip from 'jszip';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface IdeLayoutProps {
  onBackToProjects: () => void;
}

export function IdeLayout({ onBackToProjects }: IdeLayoutProps) {
  const { isSidebarOpen, toggleSidebar, sidebarView, setSidebarView, isPreviewOpen, setPreviewOpen, isCommandPaletteOpen, setCommandPaletteOpen, files, saveFile, activeFileId, createFile, openFile, loadProject } = useIdeStore();
  const { currentProjectId, projects } = useProjectsStore();
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  // Fullscreen overlays
  const [showSettings, setShowSettings] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProject = currentProjectId ? projects[currentProjectId] : null;

  // Sync files to project store on changes
  useEffect(() => {
    if (currentProjectId && Object.keys(files).length > 0) {
      useProjectsStore.getState().updateProjectFiles(currentProjectId, files);
    }
  }, [files, currentProjectId]);

  // Auto-open first code file when entering a project (no more empty dashboard)
  useEffect(() => {
    if (activeFileId) return; // already has a file open
    const codeFiles = Object.values(files).filter(
      f => f.type === 'file' && f.id !== 'root' && f.content !== undefined
    );
    if (codeFiles.length > 0) {
      // Prioritize common entry files
      const priority = ['index.html', 'App.jsx', 'App.tsx', 'index.js', 'index.ts', 'main.py', 'main.js', 'app.js'];
      const entryFile = codeFiles.find(f => priority.includes(f.name)) || codeFiles[0];
      openFile(entryFile.id);
    }
  }, [files, activeFileId]);

  // Close sidebar on mobile by default
  useEffect(() => {
    if (window.innerWidth < 768 && isSidebarOpen) {
      toggleSidebar();
    }
  }, []);

  // Fix mobile viewport height + keyboard handling
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => setTimeout(setVH, 100));

    // Keyboard-aware: use visualViewport to detect keyboard
    const vv = window.visualViewport;
    if (vv) {
      const onViewportResize = () => {
        const keyboardHeight = window.innerHeight - vv.height;
        document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, keyboardHeight)}px`);
        if (keyboardHeight > 100) {
          document.documentElement.classList.add('keyboard-open');
        } else {
          document.documentElement.classList.remove('keyboard-open');
        }
        // Also recalc vh based on visual viewport
        const vh = vv.height * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      vv.addEventListener('resize', onViewportResize);
      return () => {
        window.removeEventListener('resize', setVH);
        vv.removeEventListener('resize', onViewportResize);
      };
    }
    return () => {
      window.removeEventListener('resize', setVH);
    };
  }, []);

  // Handle Fullscreen toggle
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const updateStatusBar = async () => {
      try {
        if (useIdeStore.getState().isFullscreen) {
          await StatusBar.hide();
        } else {
          await StatusBar.show();
        }
      } catch (e) {
        console.warn('StatusBar toggling not supported:', e);
      }
    };
    updateStatusBar();
  }, [useIdeStore.getState().isFullscreen]);

  const handleRun = useCallback(() => {
    setPreviewOpen(true);
  }, [setPreviewOpen]);

  const handleToggleTerminal = useCallback(() => {
    setIsTerminalOpen(prev => !prev);
  }, []);

  const handleSave = useCallback(() => {
    if (activeFileId) {
      saveFile(activeFileId);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 1500);
    }
  }, [activeFileId, saveFile]);

  // Upload files from device
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const id = createFile(file.name, 'root', 'file', content);
        if (i === 0) openFile(id);
      };
      reader.readAsText(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowFileMenu(false);
  };

  // Download project as zip
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    
    const addToZip = (nodeId: string, currentPath: string) => {
      const node = files[nodeId];
      if (!node) return;
      if (node.type === 'file' && node.content !== undefined) {
        zip.file(`${currentPath}${node.name}`, node.content);
      } else if (node.type === 'folder' && node.children) {
        const newPath = nodeId === 'root' ? '' : `${currentPath}${node.name}/`;
        node.children.forEach(childId => addToZip(childId, newPath));
      }
    };

    addToZip('root', '');

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'project'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setShowFileMenu(false);
  };

  // Register keyboard shortcuts
  useKeyboardShortcuts({ onRun: handleRun, onToggleTerminal: handleToggleTerminal });

  // Override Ctrl+S to show toast
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 1500);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Handle bottom nav for Settings/Extensions — open fullscreen instead of sidebar
  const handleNavSettings = () => {
    setShowSettings(true);
    setShowExtensions(false);
  };
  const handleNavExtensions = () => {
    setShowExtensions(true);
    setShowSettings(false);
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] overflow-hidden">
      {/* Top Bar with notch (safe-area) handling on mobile */}
      <div 
        className="flex h-[calc(3rem+env(safe-area-inset-top,0px))] md:h-9 items-center justify-between border-b px-2 text-[13px] flex-shrink-0" 
        style={{ 
          background: 'var(--ide-topbar, #252526)', 
          borderColor: 'var(--ide-border, #1a1a1a)',
          paddingTop: 'env(safe-area-inset-top, 0px)' 
        }}
      >
        <div className="flex items-center space-x-1">
          {/* Mobile: Back + Menu */}
          <button className="p-2 md:hidden hover:bg-white/10 rounded text-gray-300 active:bg-white/20 mt-1" onClick={onBackToProjects}>
            <ArrowLeft size={20} />
          </button>
          <button className="p-2 md:p-1 md:hidden hover:bg-white/10 rounded text-gray-300 active:bg-white/20 mt-1" onClick={toggleSidebar}>
            <Menu size={20} />
          </button>
          
          {/* Desktop menu */}
          <div className="hidden md:flex space-x-0.5 ml-1">
            <button className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white" onClick={onBackToProjects} title="Back to Projects">
              <ArrowLeft size={16} />
            </button>
            <div className="relative">
              <button className="px-2 py-0.5 hover:bg-white/10 rounded cursor-pointer text-gray-400 hover:text-white" onClick={() => setShowFileMenu(!showFileMenu)}>File</button>
              {showFileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFileMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 w-48 bg-[#2d2d2d] border border-[#3c3c3c] rounded-xl shadow-2xl shadow-black/50 z-50 py-1 animate-scale-in">
                    <button 
                      onClick={() => {
                        const name = prompt('File name:');
                        if (name) { const id = createFile(name, 'root', 'file'); openFile(id); }
                        setShowFileMenu(false);
                      }} 
                      className="w-full flex items-center space-x-3 px-4 py-3 md:py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 border-b border-[#3c3c3c]"
                    >
                      <Files size={16} />
                      <span>New File...</span>
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="w-full flex items-center space-x-3 px-4 py-3 md:py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20"
                    >
                      <Upload size={16} />
                      <span>Upload Files</span>
                    </button>
                    <button 
                      onClick={handleDownloadZip} 
                      className="w-full flex items-center space-x-3 px-4 py-3 md:py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20 border-b border-[#3c3c3c]"
                    >
                      <Download size={16} />
                      <span>Download .zip</span>
                    </button>
                    <button 
                      onClick={() => { setCommandPaletteOpen(true); setShowFileMenu(false); }} 
                      className="w-full flex items-center space-x-3 px-4 py-3 md:py-2 text-sm text-gray-300 hover:bg-white/10 active:bg-white/20"
                    >
                      <span>Command Palette</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="px-2 py-0.5 hover:bg-white/10 rounded cursor-pointer text-gray-400 hover:text-white" onClick={() => setCommandPaletteOpen(true)}>View</button>
            <button className="px-2 py-0.5 hover:bg-white/10 rounded cursor-pointer text-gray-400 hover:text-white" onClick={handleRun}>Run</button>
            <button className="px-2 py-0.5 hover:bg-white/10 rounded cursor-pointer text-gray-400 hover:text-white" onClick={handleToggleTerminal}>Terminal</button>
          </div>
        </div>
        {/* Project name centered */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center text-[12px] font-semibold text-gray-400 flex items-center pointer-events-none max-w-[30%] h-full" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <span className="truncate">{currentProject?.name || 'Krypton'}</span>
        </div>

        {/* Right side actions — just the Run button, no three dots */}
        <div className="flex items-center space-x-1 mt-1 md:mt-0">
          <button onClick={handleRun} className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white px-4 py-2 md:px-2.5 md:py-1 rounded-lg text-sm md:text-xs font-semibold transition-all duration-200 shadow-lg shadow-emerald-900/40 active:scale-95">
            <Play size={16} fill="currentColor" />
            <span>Run</span>
          </button>

          {/* Desktop toolbar buttons */}
          <div className="hidden md:flex items-center space-x-0.5">
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" title="Upload Files">
              <Upload size={15} />
            </button>
            <button onClick={handleDownloadZip} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" title="Download .zip">
              <Download size={15} />
            </button>
            <button onClick={toggleSidebar} className={`p-1.5 hover:bg-white/10 rounded transition-colors ${isSidebarOpen ? 'text-white bg-white/10' : 'text-gray-400'}`} title="Toggle Sidebar">
              <Files size={15} />
            </button>
            <button onClick={handleToggleTerminal} className={`p-1.5 hover:bg-white/10 rounded transition-colors ${isTerminalOpen ? 'text-white bg-white/10' : 'text-gray-400'}`} title="Toggle Terminal">
              <TerminalSquare size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="*/*"
        onChange={handleUploadFiles} 
      />

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Activity Bar (Desktop) */}
        <div className="hidden md:block">
          <ActivityBar />
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={toggleSidebar} />
            <div className="fixed md:static inset-y-0 left-0 z-50 w-[85%] max-w-[300px] border-r shadow-2xl md:shadow-none animate-slide-right md:animate-none flex flex-col flex-shrink-0" style={{ background: 'var(--ide-sidebar, #252526)', borderColor: 'var(--ide-border, #1a1a1a)' }}>
              <Sidebar />
            </div>
          </>
        )}

        {/* Editor Area */}
        <div className="flex flex-col min-w-0 flex-1 h-full">
          <div className="flex-1 relative min-h-0">
            <CodeEditor />
          </div>

          {/* Terminal */}
          {isTerminalOpen && (
            <div 
              className="flex flex-col z-20 border-t flex-shrink-0"
              style={{ height: `${terminalHeight}px`, background: 'var(--ide-bg, #1e1e1e)', borderColor: 'var(--ide-border, #3c3c3c)' }}
            >
              <BottomPanel onClose={() => setIsTerminalOpen(false)} height={terminalHeight} setHeight={setTerminalHeight} />
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Bottom Nav — removed Search, Settings/Extensions open fullscreen */}
      <div className="md:hidden flex bg-[#1a1a1a] border-t border-[#2d2d2d] justify-around items-center flex-shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '56px' }}>
        <NavButton icon={<Files size={19} />} label="Files" active={sidebarView === 'explorer' && isSidebarOpen} onClick={() => setSidebarView('explorer')} />
        <NavButton icon={<TerminalSquare size={19} />} label="Terminal" active={isTerminalOpen} onClick={handleToggleTerminal} />
        <NavButton icon={<Puzzle size={19} />} label="Extend" active={showExtensions} onClick={handleNavExtensions} />
        <NavButton icon={<Bot size={19} />} label="AI" active={sidebarView === 'ai' && isSidebarOpen} onClick={() => setSidebarView('ai')} />
        <NavButton icon={<Settings size={19} />} label="More" active={showSettings} onClick={handleNavSettings} />
      </div>

      {/* Status Bar (Desktop) */}
      <div className="hidden md:block">
        <StatusBar />
      </div>

      {/* Live Preview Overlay */}
      {isPreviewOpen && (
        <LivePreview onClose={() => setPreviewOpen(false)} />
      )}

      {/* Command Palette */}
      {isCommandPaletteOpen && (
        <CommandPalette onRunProject={handleRun} onBackToProjects={onBackToProjects} />
      )}

      {/* Fullscreen Settings Overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-[#1e1e1e] flex flex-col animate-overlay-up">
          <div className="flex items-center h-12 bg-[#252526] border-b border-[#1a1a1a] px-2 flex-shrink-0">
            <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg mr-1">
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-white font-semibold text-sm flex-1">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SettingsPanel />
          </div>
          {/* Nav bar in settings */}
          <div className="md:hidden flex bg-[#1a1a1a] border-t border-[#2d2d2d] justify-around items-center flex-shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '56px' }}>
            <NavButton icon={<Files size={19} />} label="Files" active={false} onClick={() => { setShowSettings(false); setSidebarView('explorer'); }} />
            <NavButton icon={<TerminalSquare size={19} />} label="Terminal" active={false} onClick={() => { setShowSettings(false); handleToggleTerminal(); }} />
            <NavButton icon={<Puzzle size={19} />} label="Extend" active={false} onClick={() => { setShowSettings(false); handleNavExtensions(); }} />
            <NavButton icon={<Bot size={19} />} label="AI" active={false} onClick={() => { setShowSettings(false); setSidebarView('ai'); }} />
            <NavButton icon={<Settings size={19} />} label="More" active={true} onClick={() => {}} />
          </div>
        </div>
      )}

      {/* Fullscreen Extensions Overlay */}
      {showExtensions && (
        <div className="fixed inset-0 z-[60] bg-[#1e1e1e] flex flex-col animate-overlay-up">
          <div className="flex items-center h-12 bg-[#252526] border-b border-[#1a1a1a] px-2 flex-shrink-0">
            <button onClick={() => setShowExtensions(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg mr-1">
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-white font-semibold text-sm flex-1">Extensions</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ExtensionsPanel />
          </div>
          {/* Nav bar in extensions */}
          <div className="md:hidden flex bg-[#1a1a1a] border-t border-[#2d2d2d] justify-around items-center flex-shrink-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '56px' }}>
            <NavButton icon={<Files size={19} />} label="Files" active={false} onClick={() => { setShowExtensions(false); setSidebarView('explorer'); }} />
            <NavButton icon={<TerminalSquare size={19} />} label="Terminal" active={false} onClick={() => { setShowExtensions(false); handleToggleTerminal(); }} />
            <NavButton icon={<Puzzle size={19} />} label="Extend" active={true} onClick={() => {}} />
            <NavButton icon={<Bot size={19} />} label="AI" active={false} onClick={() => { setShowExtensions(false); setSidebarView('ai'); }} />
            <NavButton icon={<Settings size={19} />} label="More" active={false} onClick={() => { setShowExtensions(false); handleNavSettings(); }} />
          </div>
        </div>
      )}

      {/* Save Toast */}
      {showSaveToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-[#333] text-white text-sm px-4 py-2 rounded-lg shadow-xl z-[70] animate-fade-in flex items-center space-x-2">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span>Saved</span>
        </div>
      )}
    </div>
  );
}

// Extracted NavButton component for cleaner bottom nav
function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-1 min-w-[48px] rounded-lg transition-colors ${
        active ? 'text-blue-400' : 'text-gray-500 active:text-white'
      }`}
    >
      {icon}
      <span className="text-[9px] mt-0.5 leading-tight">{label}</span>
    </button>
  );
}
