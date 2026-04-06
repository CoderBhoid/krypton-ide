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
import { readConfig, readFontFile } from '../../lib/fileSystemStorage';
import { getSnippetsForLanguage, getSnippetLanguages } from '../../lib/languageSnippets';

export function CodeEditor() {
  const { files, activeFileId, openFiles, closeFile, setActiveFile, updateFileContent, theme, setCursorPosition, isSidebarOpen } = useIdeStore();
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [mdViewMode, setMdViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const monaco = useMonaco();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [closingTab, setClosingTab] = useState<string | null>(null);

  // Selection floating toolbar state
  const [selectionMenu, setSelectionMenu] = useState<{ visible: boolean; top: number; left: number; text: string } | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<{ start: { top: number; left: number }, end: { top: number; left: number } } | null>(null);
  const editorRef = useRef<any>(null);

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

  // Restore custom font on startup from filesystem config
  useEffect(() => {
    async function loadFont() {
      const config = await readConfig();
      if (config?.activeFont) {
        const fontName = config.activeFont;
        const fontData = await readFontFile(fontName);
        if (fontData) {
          const style = document.createElement('style');
          style.id = `krypton-font-${fontName}`;
          style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
          document.head.appendChild(style);
          setTimeout(() => {
            document.querySelectorAll('.monaco-editor').forEach(el => {
              (el as HTMLElement).style.fontFamily = `'${fontName}', 'JetBrains Mono', monospace`;
            });
          }, 500);
        }
      }
    }
    loadFont();
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

  // Register language snippets as completion providers
  useEffect(() => {
    if (!monaco) return;
    const disposables: any[] = [];
    const languages = getSnippetLanguages();

    for (const lang of languages) {
      const snippets = getSnippetsForLanguage(lang);
      if (snippets.length === 0) continue;

      // Map language names to Monaco language IDs
      const monacoLangs: string[] = [];
      if (lang === 'typescript') monacoLangs.push('typescript', 'javascript', 'typescriptreact', 'javascriptreact');
      else if (lang === 'groovy') monacoLangs.push('groovy', 'plaintext'); // Gradle files may not have a groovy mode
      else if (lang === 'cpp') monacoLangs.push('cpp', 'c');
      else monacoLangs.push(lang);

      for (const monacoLang of monacoLangs) {
        try {
          const disposable = monaco.languages.registerCompletionItemProvider(monacoLang, {
            provideCompletionItems: (model: any, position: any) => {
              const word = model.getWordUntilPosition(position);
              const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
              };

              const suggestions = snippets.map((s) => ({
                label: s.prefix,
                kind: monaco.languages.CompletionItemKind.Snippet,
                documentation: s.description,
                insertText: s.body.replace(/\$0/g, '').replace(/\$\d/g, ''),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                detail: `⚡ ${s.description}`,
              }));

              return { suggestions };
            },
          });
          disposables.push(disposable);
        } catch {
          // Language may not be registered in Monaco — skip
        }
      }
    }

    return () => disposables.forEach(d => d.dispose());
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
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Custom text selection toolbar logic for mobile
    editor.onDidChangeCursorSelection((e: any) => {
      try {
        const selection = e.selection;
        if (!selection.isEmpty()) {
          const model = editor.getModel();
          if (!model) return;
          const text = model.getValueInRange(selection);
          const startPos = editor.getScrolledVisiblePosition(selection.getStartPosition());
          const endPos = editor.getScrolledVisiblePosition(selection.getEndPosition());
          const domNode = editor.getDomNode();
          
          if (startPos && endPos && domNode) {
            const rect = domNode.getBoundingClientRect();
            const isBelow = startPos.top < 60;
            
            setSelectionMenu({
              visible: true,
              text,
              top: isBelow ? rect.top + startPos.top + 30 : rect.top + startPos.top - 50,
              left: Math.min(Math.max(10, rect.left + startPos.left - 80), window.innerWidth - 250)
            });

            setSelectionBounds({
              start: { top: rect.top + startPos.top, left: rect.left + startPos.left },
              end: { top: rect.top + endPos.top + 18, left: rect.left + endPos.left }
            });
          }
        } else {
          setSelectionMenu(prev => (prev && prev.text === '') ? prev : null);
          setSelectionBounds(null);
        }
      } catch (err: any) {
        if (err?.type !== 'cancelation') console.error('Selection update error:', err);
      }
    });

    // Handle deselection on click outside
    const handleGlobalTouch = (e: any) => {
      if (!editorRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('.selection-handle') || target.closest('.selection-menu')) return;
      
      // If it's a quick tap (not a scroll), clear selection
      const pos = editorRef.current.getPosition();
      if (pos) {
        editorRef.current.setSelection({
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column
        });
      }
    };

    // Mobile: Long-press to select word
    let touchTimer: any = null;
    let startX = 0;
    let startY = 0;
    const MOVE_THRESHOLD = 15; // Allow 15px of drift for mobile stability
    
    const editorDom = editor.getDomNode();
    if (editorDom) {
      editorDom.addEventListener('touchstart', (e: any) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        
        touchTimer = setTimeout(() => {
          try {
            const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
            if (target && target.position) {
              const model = editor.getModel();
              if (!model) return;
              const word = model.getWordAtPosition(target.position);
              if (word) {
                editor.setSelection({
                  startLineNumber: target.position.lineNumber,
                  startColumn: word.startColumn,
                  endLineNumber: target.position.lineNumber,
                  endColumn: word.endColumn
                });
                if (Capacitor.isNativePlatform()) {
                  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                }
              } else {
                // Even if no word, still place cursor and show menu for global actions (paste/select all)
                editor.setPosition(target.position);
                const pos = editor.getScrolledVisiblePosition(target.position);
                const domNode = editor.getDomNode();
                if (pos && domNode) {
                   const rect = domNode.getBoundingClientRect();
                   const isBelow = pos.top < 60;
                   setSelectionMenu({
                     visible: true,
                     text: '',
                     top: isBelow ? rect.top + pos.top + 30 : rect.top + pos.top - 50,
                     left: Math.min(Math.max(10, rect.left + pos.left - 80), window.innerWidth - 250)
                   });
                }
                if (Capacitor.isNativePlatform()) {
                  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                }
              }
            }
          } catch (err: any) {
            if (err?.type !== 'cancelation') console.error('Long press error:', err);
          }
        }, 500);
      }, { passive: true });

      editorDom.addEventListener('touchend', () => {
        if (touchTimer) clearTimeout(touchTimer);
      }, { passive: true });

      editorDom.addEventListener('touchmove', (e: any) => {
        if (!e.touches[0]) return;
        const moveX = Math.abs(e.touches[0].clientX - startX);
        const moveY = Math.abs(e.touches[0].clientY - startY);
        // Only clear if movement exceeds threshold
        if (moveX > MOVE_THRESHOLD || moveY > MOVE_THRESHOLD) {
          if (touchTimer) clearTimeout(touchTimer);
        }
      }, { passive: true });
    }

    // Attach global deselection listener
    const container = editor.getDomNode()?.parentElement;
    if (container) {
      let isScrolling = false;
      container.addEventListener('touchstart', () => { isScrolling = false; }, { passive: true });
      container.addEventListener('touchmove', () => { isScrolling = true; }, { passive: true });
      container.addEventListener('touchend', (e) => {
        if (!isScrolling) handleGlobalTouch(e);
      }, { passive: true });
    }

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

    // Configure CSS diagnostics to ignore tailwind v4 '@theme'
    monacoApi.languages.css.cssDefaults.setOptions({
      lint: {
        unknownAtRules: 'ignore'
      }
    });

    // Add Prettier Format Command (Shift+Alt+F)
    editor.addCommand(monacoApi.KeyMod.Shift | monacoApi.KeyMod.Alt | monacoApi.KeyCode.KeyF, async () => {
      try {
        const state = useIdeStore.getState();
        const currentFile = state.files[state.activeFileId!];
        if (currentFile && currentFile.content) {
          const formatted = await formatCode(currentFile.content, currentFile.language || 'plaintext');
          const model = editor.getModel();
          if (model && formatted && formatted !== currentFile.content) {
             editor.executeEdits('prettier', [{
              range: model.getFullModelRange(),
              text: formatted,
              forceMoveMarkers: true
            }]);
            state.updateFileContent(state.activeFileId!, formatted);
          }
        }
      } catch (err: any) {
        if (err?.type !== 'cancelation') console.error('Format error:', err);
      }
    });

  }, [setCursorPosition]);

  const insertText = (text: string) => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'type', { text });
      editorRef.current.focus();
    }
  };

  const handleHandleDrag = (e: React.TouchEvent, side: 'start' | 'end') => {
    try {
      const touch = e.touches[0];
      const editor = editorRef.current;
      if (!editor) return;

      const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
      if (target && target.position) {
        const selection = editor.getSelection();
        if (!selection) return;

        if (side === 'start') {
          editor.setSelection({
            startLineNumber: target.position.lineNumber,
            startColumn: target.position.column,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          });
        } else {
          editor.setSelection({
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: target.position.lineNumber,
            endColumn: target.position.column
          });
        }
        
        // Auto-scroll logic when dragging near boundaries
        const domNode = editor.getDomNode();
        if (domNode) {
          const rect = domNode.getBoundingClientRect();
          const scrollSpeed = 15;
          if (touch.clientY < rect.top + 60) {
            editor.setScrollTop(editor.getScrollTop() - scrollSpeed);
          } else if (touch.clientY > rect.bottom - 60) {
            editor.setScrollTop(editor.getScrollTop() + scrollSpeed);
          }
        }
      }
    } catch (err: any) {
      if (err?.type !== 'cancelation') console.error('Drag selection error:', err);
    }
  };

  const handleSelectionAction = async (action: string) => {
    if (!editorRef.current || !selectionMenu) return;
    const editorInstance = editorRef.current;
    
    if (action === 'cut') {
      const text = selectionMenu.text;
      await navigator.clipboard.writeText(text);
      editorInstance.executeEdits('clipboard', [{
        range: editorInstance.getSelection(),
        text: '',
        forceMoveMarkers: true
      }]);
      setSelectionMenu(null);
    } else if (action === 'copy') {
      await navigator.clipboard.writeText(selectionMenu.text);
      setSelectionMenu(null);
    } else if (action === 'paste') {
      const text = await navigator.clipboard.readText();
      editorInstance.trigger('keyboard', 'paste', { text });
      setSelectionMenu(null);
    } else if (action === 'selectAll') {
      editorInstance.setSelection(editorInstance.getModel().getFullModelRange());
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
        <div className="flex h-9 overflow-x-auto scrollbar-hide flex-shrink-0 border-b border-gray-200 dark:border-[#1a1a1a] bg-gray-100 dark:bg-[#252526]">
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
                        contextmenu: false,
                        quickSuggestions: false,
                        occurrencesHighlight: 'off',
                        selectionHighlight: false,
                        hover: { enabled: false },
                        parameterHints: { enabled: false },
                        lightbulb: { enabled: false },
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
                    contextmenu: false,
                    quickSuggestions: false,
                    occurrencesHighlight: 'off',
                    selectionHighlight: false,
                    hover: { enabled: false },
                    parameterHints: { enabled: false },
                    lightbulb: { enabled: false },
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
                  className="md:hidden fixed left-0 right-0 border-t flex overflow-x-auto scrollbar-hide py-2 px-2 space-x-1.5 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.4)] transition-[bottom] duration-150 ease-out bg-gray-100 dark:bg-[#252526] border-gray-200 dark:border-[#3c3c3c]"
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
                        if (Capacitor.isNativePlatform() && useIdeStore.getState().isHapticsEnabled) {
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
            
            {/* Selection Handles */}
            {selectionBounds && (
              <>
                {/* Start Handle */}
                <div 
                  className="selection-handle fixed z-[55] w-0.5 bg-blue-500 flex flex-col items-center pointer-events-auto shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  style={{
                    top: `${selectionBounds.start.top - 18}px`,
                    left: `${selectionBounds.start.left}px`,
                    height: '22px'
                  }}
                  onTouchMove={(e) => handleHandleDrag(e, 'start')}
                >
                  <div className="w-3.5 h-3.5 bg-blue-500 rounded-full -mt-1 shadow-lg active:scale-125 transition-transform" />
                </div>
                {/* End Handle */}
                <div 
                  className="selection-handle fixed z-[55] w-0.5 bg-blue-500 flex flex-col items-center pointer-events-auto shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  style={{
                    top: `${selectionBounds.end.top - 4}px`,
                    left: `${selectionBounds.end.left}px`,
                    height: '22px'
                  }}
                  onTouchMove={(e) => handleHandleDrag(e, 'end')}
                >
                  <div className="w-3.5 h-3.5 bg-blue-500 rounded-full mt-auto shadow-lg active:scale-125 transition-transform" />
                </div>
              </>
            )}

            {/* Floating Selection Toolbar */}
            {selectionMenu && selectionMenu.visible && (
              <div 
                className="fixed z-[60] flex items-center bg-[#252526] border border-[#3c3c3c] rounded-2xl shadow-2xl overflow-hidden animate-context-pop pointer-events-auto"
                style={{
                  top: `${Math.max(50, selectionMenu.top)}px`,
                  left: `${selectionMenu.left}px`
                }}
              >
                <div className="flex h-10 items-center divide-x divide-[#3c3c3c]">
                  <button onClick={() => handleSelectionAction('cut')} className="flex items-center space-x-1.5 px-3 h-full hover:bg-white/10 text-[11px] font-bold text-gray-300 hover:text-white transition-colors">
                    <Scissors size={14} /> <span>Cut</span>
                  </button>
                  <button onClick={() => handleSelectionAction('copy')} className="flex items-center space-x-1.5 px-3 h-full hover:bg-white/10 text-[11px] font-bold text-gray-300 hover:text-white transition-colors">
                    <Copy size={14} /> <span>Copy</span>
                  </button>
                  <button onClick={() => handleSelectionAction('paste')} className="flex items-center space-x-1.5 px-3 h-full hover:bg-white/10 text-[11px] font-bold text-gray-300 hover:text-white transition-colors">
                    <ClipboardPaste size={14} /> <span>Paste</span>
                  </button>
                  <button onClick={() => handleSelectionAction('selectAll')} className="flex items-center space-x-1.5 px-3 h-full hover:bg-white/10 text-[11px] font-bold text-gray-300 hover:text-white transition-colors uppercase tracking-tighter">
                    <span>Select All</span>
                  </button>
                  <button onClick={() => handleSelectionAction('ai')} className="flex items-center space-x-1.5 px-4 h-full bg-[#32204c] text-purple-400 hover:text-purple-300 text-[11px] font-bold transition-colors">
                    <Bot size={14} /> <span>AI Agent</span>
                  </button>
                </div>
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
