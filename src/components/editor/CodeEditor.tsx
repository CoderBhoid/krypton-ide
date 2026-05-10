import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useIdeStore } from '../../store/useIdeStore';
import { X, Keyboard, FileCode2, Zap, Eye, Code2, Paintbrush, ClipboardPaste, Undo2, Redo2, Search } from 'lucide-react';
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

  // Listen for Go to Line command from Command Palette
  useEffect(() => {
    const handleGotoLine = (e: Event) => {
      const line = (e as CustomEvent).detail?.line;
      if (editorRef.current && line) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    };
    window.addEventListener('krypton-goto-line', handleGotoLine);
    return () => window.removeEventListener('krypton-goto-line', handleGotoLine);
  }, []);

  // Listen for Find & Replace command from Command Palette
  useEffect(() => {
    const handleFindReplace = () => {
      if (editorRef.current) {
        editorRef.current.getAction('editor.action.startFindReplaceAction')?.run();
      }
    };
    window.addEventListener('krypton-find-replace', handleFindReplace);
    return () => window.removeEventListener('krypton-find-replace', handleFindReplace);
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

  // Debounce editor changes to prevent crash when holding backspace.
  // Rapid-fire Monaco onChange events (60fps on key-repeat) cause
  // a zustand state-spread storm that OOMs mobile devices.
  const editorChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef<string | undefined>(undefined);

  // Bug fix: clean up debounce timer on unmount to prevent stale updates
  useEffect(() => {
    return () => {
      if (editorChangeTimer.current) {
        clearTimeout(editorChangeTimer.current);
      }
    };
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFileId || value === undefined) return;
    latestValue.current = value;

    if (editorChangeTimer.current) {
      clearTimeout(editorChangeTimer.current);
    }
    editorChangeTimer.current = setTimeout(() => {
      if (latestValue.current !== undefined) {
        updateFileContent(activeFileId, latestValue.current);
      }
    }, 50); // 50ms debounce — imperceptible, prevents OOM
  }, [activeFileId, updateFileContent]);



  const handleEditorMount = useCallback((editor: any, monacoApi: any) => {
    setEditorInstance(editor);
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPosition({
        line: e.position.lineNumber,
        col: e.position.column,
      });
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
                        lightbulb: { enabled: 'off' as any },
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
                    lightbulb: { enabled: 'off' as any },
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
                  {/* Undo / Redo buttons */}
                  <button 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      editorRef.current?.trigger('keyboard', 'undo', null);
                      editorRef.current?.focus();
                      if (Capacitor.isNativePlatform() && useIdeStore.getState().isHapticsEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      }
                    }} 
                    className="flex-shrink-0 bg-white dark:bg-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#4c4c4c] active:bg-blue-600 active:text-white text-gray-800 dark:text-white min-w-[36px] h-[34px] flex items-center justify-center rounded-md text-sm transition-colors border border-gray-200 dark:border-[#4a4a4a] select-none touch-manipulation shadow-sm"
                    title="Undo"
                  >
                    <Undo2 size={15} />
                  </button>
                  <button 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      editorRef.current?.trigger('keyboard', 'redo', null);
                      editorRef.current?.focus();
                      if (Capacitor.isNativePlatform() && useIdeStore.getState().isHapticsEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      }
                    }} 
                    className="flex-shrink-0 bg-white dark:bg-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#4c4c4c] active:bg-blue-600 active:text-white text-gray-800 dark:text-white min-w-[36px] h-[34px] flex items-center justify-center rounded-md text-sm transition-colors border border-gray-200 dark:border-[#4a4a4a] select-none touch-manipulation shadow-sm"
                    title="Redo"
                  >
                    <Redo2 size={15} />
                  </button>
                  {/* Find in file button */}
                  <button 
                    onClick={(e) => { 
                      e.preventDefault(); 
                      editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run();
                      if (Capacitor.isNativePlatform() && useIdeStore.getState().isHapticsEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      }
                    }} 
                    className="flex-shrink-0 bg-white dark:bg-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#4c4c4c] active:bg-blue-600 active:text-white text-gray-800 dark:text-white min-w-[36px] h-[34px] flex items-center justify-center rounded-md text-sm transition-colors border border-gray-200 dark:border-[#4a4a4a] select-none touch-manipulation shadow-sm"
                    title="Find & Replace"
                  >
                    <Search size={15} />
                  </button>
                  {/* Paste button */}
                  <button 
                    onClick={async (e) => { 
                      e.preventDefault(); 
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text && editorRef.current && monaco) {
                          const position = editorRef.current.getPosition();
                          editorRef.current.executeEdits('krypton-paste', [{
                            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                            text: text,
                            forceMoveMarkers: true
                          }]);
                          editorRef.current.focus();
                        }
                      } catch (err) {
                        console.error("Paste failed", err);
                      }
                      if (Capacitor.isNativePlatform() && useIdeStore.getState().isHapticsEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      }
                    }} 
                    className="flex-shrink-0 bg-white dark:bg-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#4c4c4c] active:bg-blue-600 active:text-white text-gray-800 dark:text-white min-w-[36px] h-[34px] flex items-center justify-center rounded-md text-sm transition-colors border border-gray-200 dark:border-[#4a4a4a] select-none touch-manipulation shadow-sm"
                    title="Paste"
                  >
                    <ClipboardPaste size={15} />
                  </button>
                  {/* Divider */}
                  <div className="w-px h-5 bg-gray-300 dark:bg-[#555] flex-shrink-0 mx-0.5" />
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
