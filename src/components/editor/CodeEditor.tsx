import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useIdeStore } from '../../store/useIdeStore';
import { X, Keyboard, FileCode2, Zap, Eye, Code2, Paintbrush, Scissors, Copy, ClipboardPaste, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MarkdownPreview } from './MarkdownPreview';
import { formatCode } from '../../lib/formatter';
import { useProblemsStore, extractMonacoProblems } from '../../store/useProblemsStore';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export function CodeEditor() {
  const { files, activeFileId, openFiles, closeFile, setActiveFile, updateFileContent, theme, setCursorPosition, isSidebarOpen, isGlassmorphismEnabled } = useIdeStore();
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [mdViewMode, setMdViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const monaco = useMonaco();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [closingTab, setClosingTab] = useState<string | null>(null);

  // Selection floating toolbar state
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; top: number; left: number; text: string } | null>(null);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const { files, saveFile } = useIdeStore.getState();
      Object.entries(files).forEach(([id, f]) => {
        if (f.type === 'file' && f.isUnsaved) saveFile(id);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeFile = activeFileId ? files[activeFileId] : null;
  const isMarkdown = activeFile?.name?.endsWith('.md') || activeFile?.language === 'markdown';

  // Restore custom font on startup
  useEffect(() => {
    const fontName = localStorage.getItem('krypton-custom-font-name');
    const fontData = localStorage.getItem('krypton-custom-font-data');
    if (fontName && fontData) {
      const style = document.createElement('style');
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
      document.head.appendChild(style);
      setTimeout(() => {
        document.querySelectorAll('.monaco-editor').forEach(el => {
          (el as HTMLElement).style.fontFamily = `'${fontName}', 'JetBrains Mono', monospace`;
        });
      }, 500);
    }
  }, []);

  // Cross-file IntelliSense & Sync
  useEffect(() => {
    if (!monaco) return;
    
    // Sync all files into Monaco's virtual models
    Object.values(files).forEach((f) => {
      if (f.type === 'file' && f.content !== undefined) {
        const uri = monaco.Uri.parse(`file:///${f.name}`);
        const model = monaco.editor.getModel(uri);
        if (!model && f.id !== activeFileId) {
          monaco.editor.createModel(f.content, f.language, uri);
        } else if (model && f.id !== activeFileId && model.getValue() !== f.content) {
          model.setValue(f.content);
        }
      }
    });
  }, [files, monaco, activeFileId]);

  // Sync Monaco diagnostics → Problems panel
  useEffect(() => {
    if (!monaco) return;
    const interval = setInterval(() => {
      const problems = extractMonacoProblems(monaco);
      useProblemsStore.getState().setProblems(problems);
    }, 2000);
    return () => clearInterval(interval);
  }, [monaco]);

  // ── Keyboard-aware toolbar (rises with soft keyboard like SPCK) ──
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // When keyboard opens, visualViewport.height shrinks
      const fullHeight = window.innerHeight;
      const viewportHeight = vv.height;
      const kbHeight = fullHeight - viewportHeight;
      setKeyboardHeight(kbHeight > 50 ? kbHeight : 0); // threshold to ignore URL bar changes
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value);
    }
  };

  const handleEditorMount = useCallback((editor: any, monacoApi: any) => {
    setEditorInstance(editor);
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Custom text selection toolbar logic for mobile
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = e.selection;
      if (!selection.isEmpty()) {
        const text = editor.getModel().getValueInRange(selection);
        // Get pixel coordinates of selection start to show the popup
        const pos = editor.getScrolledVisiblePosition(selection.getStartPosition());
        const domNode = editor.getDomNode();
        if (pos && domNode) {
          const rect = domNode.getBoundingClientRect();
          setSelectionMenu({
            visible: true,
            text,
            top: rect.top + pos.top - 40, // show slightly above
            left: rect.left + pos.left
          });
        }
      } else {
        setSelectionMenu(null);
      }
    });

    // Configure Advanced IntelliSense for React/TSX
    monacoApi.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoApi.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monacoApi.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monacoApi.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monacoApi.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
    });
    
    monacoApi.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monacoApi.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monacoApi.languages.typescript.ModuleResolutionKind.NodeJs,
      allowJs: true,
      alwaysStrict: true,
      jsx: monacoApi.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
    });

    // Add Prettier Format Command (Shift+Alt+F)
    editor.addCommand(monacoApi.KeyMod.Shift | monacoApi.KeyMod.Alt | monacoApi.KeyCode.KeyF, async () => {
      const state = useIdeStore.getState();
      const currentFile = state.files[state.activeFileId!];
      if (currentFile && currentFile.content) {
        const formatted = await formatCode(currentFile.content, currentFile.language || 'plaintext');
        if (formatted && formatted !== currentFile.content) {
           editor.executeEdits('prettier', [{
            range: editor.getModel().getFullModelRange(),
            text: formatted,
            forceMoveMarkers: true
          }]);
          state.updateFileContent(state.activeFileId!, formatted);
        }
      }
    });

  }, [setCursorPosition]);

  const insertText = (text: string) => {
    if (editorInstance) {
      editorInstance.trigger('keyboard', 'type', { text });
      editorInstance.focus();
    }
  };

  const handleSelectionAction = async (action: 'cut' | 'copy' | 'paste' | 'ai') => {
    if (!editorInstance || !selectionMenu) return;
    
    if (action === 'copy') {
      await navigator.clipboard.writeText(selectionMenu.text);
      setSelectionMenu(null);
    } else if (action === 'cut') {
      await navigator.clipboard.writeText(selectionMenu.text);
      editorInstance.trigger('keyboard', 'cut', {});
      setSelectionMenu(null);
    } else if (action === 'paste') {
      const text = await navigator.clipboard.readText();
      editorInstance.trigger('keyboard', 'paste', { text });
      setSelectionMenu(null);
    } else if (action === 'ai') {
      window.dispatchEvent(new CustomEvent('krypton-send-to-agent', { 
        detail: { text: `Explain or modify this code:\n\`\`\`\n${selectionMenu.text}\n\`\`\`\n` } 
      }));
      setSelectionMenu(null);
      useIdeStore.getState().setSidebarView('ai');
      if (!useIdeStore.getState().isSidebarOpen) {
        useIdeStore.getState().toggleSidebar();
      }
    }
  };

  const keys = ['Tab', '{', '}', '[', ']', '(', ')', '<', '>', '=', ';', '"', "'", '/', ':', '!', '&', '|', '#'];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#1e1e1e]">
      {/* Editor Tabs */}
      {openFiles.length > 0 && (
        <div className={`flex h-9 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-gray-200 dark:border-[#1a1a1a] ${isGlassmorphismEnabled ? 'glass-panel z-10' : 'bg-gray-100 dark:bg-[#252526]'}`}>
          {openFiles.map(fileId => {
            const file = files[fileId];
            if (!file) return null;
            const isActive = activeFileId === fileId;

            return (
              <div
                key={fileId}
                className={cn(
                  "group flex min-w-[100px] max-w-[180px] cursor-pointer items-center border-r border-gray-200 dark:border-[#1a1a1a] px-3 text-[13px] transition-all",
                  isActive 
                    ? "bg-white dark:bg-[#1e1e1e] text-blue-600 dark:text-white border-t-2 border-t-blue-500" 
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2d2d2d]/80 active:bg-gray-300 dark:active:bg-[#333]",
                  closingTab === fileId && "animate-tab-close"
                )}
                onClick={() => setActiveFile(fileId)}
              >
                <span className="truncate flex-1">{file.name}</span>
                {file.isUnsaved && <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />}
                <button
                  className={cn(
                    "ml-1.5 rounded p-0.5 opacity-0 hover:bg-[#555] group-hover:opacity-100 flex-shrink-0 transition-opacity",
                    isActive && "opacity-60"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setClosingTab(fileId);
                    setTimeout(() => { closeFile(fileId); setClosingTab(null); }, 200);
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}

          <div className="ml-auto flex items-center pr-2 space-x-0.5 flex-shrink-0">
            {/* Format button for active file */}
            {activeFile && (
              <button
                onClick={async () => {
                  if (activeFile.content) {
                    const formatted = await formatCode(activeFile.content, activeFile.language || 'plaintext');
                    if (formatted && formatted !== activeFile.content) {
                      editorInstance?.executeEdits('prettier', [{
                        range: editorInstance.getModel().getFullModelRange(),
                        text: formatted,
                        forceMoveMarkers: true
                      }]);
                      updateFileContent(activeFile.id, formatted);
                    }
                  }
                }}
                className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10"
                title="Format Code (Shift+Alt+F)"
              >
                <Paintbrush size={14} />
              </button>
            )}

            {/* Markdown view mode toggle */}
            {isMarkdown && (
               <>
                <button 
                  onClick={() => setMdViewMode('edit')} 
                  className={cn("p-1.5 rounded text-xs", mdViewMode === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10')}
                  title="Edit"
                >
                  <Code2 size={14} />
                </button>
                <button 
                  onClick={() => setMdViewMode('split')} 
                  className={cn("p-1.5 rounded text-xs", mdViewMode === 'split' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10')}
                  title="Split"
                >
                  <span className="text-[10px] font-bold">⫼</span>
                </button>
                <button 
                  onClick={() => setMdViewMode('preview')} 
                  className={cn("p-1.5 rounded text-xs", mdViewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10')}
                  title="Preview"
                >
                  <Eye size={14} />
                </button>
               </>
            )}
          </div>
        </div>
      )}

      {/* Editor / Preview Area */}
      <div className="flex-1 relative min-h-0">
        {activeFile ? (
          <>
            {isMarkdown ? (
              /* Markdown: edit/split/preview modes */
              <div className="flex h-full">
                {(mdViewMode === 'edit' || mdViewMode === 'split') && (
                  <div className={cn("min-h-0", mdViewMode === 'split' ? 'w-1/2 border-r border-[#3c3c3c]' : 'w-full')}>
                    <Editor
                      height="100%"
                      language="markdown"
                      theme={theme}
                      value={activeFile.content || ''}
                      onChange={handleEditorChange}
                      onMount={handleEditorMount}
                      path={`file:///${activeFile.name}`}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                        wordWrap: 'on',
                        automaticLayout: true,
                        padding: { top: 12, bottom: 60 },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        renderLineHighlight: 'line',
                      }}
                    />
                  </div>
                )}
                {(mdViewMode === 'preview' || mdViewMode === 'split') && (
                  <div className={mdViewMode === 'split' ? 'w-1/2' : 'w-full'}>
                    <MarkdownPreview content={activeFile.content || ''} />
                  </div>
                )}
              </div>
            ) : (
              /* Normal code editor */
              <>
                <Editor
                  height="100%"
                  language={activeFile.language || 'plaintext'}
                  theme={theme}
                  value={activeFile.content || ''}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  path={`file:///${activeFile.name}`}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    fontLigatures: true,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 12, bottom: 60 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    formatOnPaste: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true },
                    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    suggest: { showKeywords: true, showSnippets: true },
                  }}
                  loading={
                    <div className="flex h-full items-center justify-center text-gray-500">
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading editor...</span>
                      </div>
                    </div>
                  }
                />
                {/* Keyboard-Aware Symbol Toolbar — only shown when sidebar is closed */}
                {!isSidebarOpen && (
                <div 
                  ref={toolbarRef}
                  className={`md:hidden fixed left-0 right-0 border-t flex overflow-x-auto scrollbar-hide py-2 px-2 space-x-1.5 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.4)] transition-[bottom] duration-150 ease-out ${isGlassmorphismEnabled ? 'glass-panel border-gray-200 dark:border-white/5' : 'bg-gray-100 dark:bg-[#252526] border-gray-200 dark:border-[#3c3c3c]'}`}
                  style={{ bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
                >
                  <div className="flex items-center justify-center px-1.5 text-gray-500 flex-shrink-0"><Keyboard size={15}/></div>
                  {keys.map(k => (
                    <button 
                      key={k} 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        insertText(k === 'Tab' ? '  ' : k);
                        // Haptic feedback on native if enabled
                        if (Capacitor.isNativePlatform() && localStorage.getItem('krypton-haptics') !== 'false') {
                          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                        }
                      }} 
                      className="flex-shrink-0 bg-white dark:bg-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#4c4c4c] active:bg-blue-600 active:text-white text-gray-800 dark:text-white min-w-[36px] h-[34px] flex items-center justify-center rounded-md text-sm font-mono transition-colors border border-gray-200 dark:border-[#4a4a4a] select-none touch-manipulation shadow-sm"
                    >
                      {k}
                    </button>
                  ))}
                </div>
                )}
              </>
            )}
            
            {/* Floating Selection Toolbar */}
            {selectionMenu && selectionMenu.visible && (
              <div 
                className="fixed z-[60] flex items-center space-x-1 bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl p-1 animate-context-pop pointer-events-auto"
                style={{
                  top: `${Math.max(50, selectionMenu.top)}px`,
                  left: `${Math.min(Math.max(10, selectionMenu.left), window.innerWidth - 200)}px` // keep on screen
                }}
              >
                <button onTouchStart={() => handleSelectionAction('cut')} onClick={() => handleSelectionAction('cut')} className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors">
                  <Scissors size={14} /> <span>Cut</span>
                </button>
                <button onTouchStart={() => handleSelectionAction('copy')} onClick={() => handleSelectionAction('copy')} className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors border-l border-[#3c3c3c]">
                  <Copy size={14} /> <span>Copy</span>
                </button>
                <button onTouchStart={() => handleSelectionAction('paste')} onClick={() => handleSelectionAction('paste')} className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors border-l border-[#3c3c3c]">
                  <ClipboardPaste size={14} /> <span>Paste</span>
                </button>
                <button onTouchStart={() => handleSelectionAction('ai')} onClick={() => handleSelectionAction('ai')} className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-[#32204c] text-purple-400 hover:text-purple-300 rounded-lg transition-colors border-l border-[#3c3c3c]">
                  <Bot size={14} /> <span>AI</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty state — project auto-opens first file, this is just fallback */
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-500 px-8">
              <Zap size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Open a file from the Explorer</p>
              <p className="text-xs mt-1 text-gray-600">or create a new file to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
