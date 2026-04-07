import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Send, AlertCircle, AlertTriangle, Info, Filter, Package } from 'lucide-react';
import { TerminalPanel } from './TerminalPanel';
import { useOutputStore } from '../../store/useOutputStore';
import { useProblemsStore } from '../../store/useProblemsStore';
import { useIdeStore } from '../../store/useIdeStore';
import { useProjectsStore } from '../../store/useProjectsStore';

interface BottomPanelProps {
  onClose: () => void;
  height: number;
  setHeight: (height: number) => void;
}

export function BottomPanel({ onClose, height, setHeight }: BottomPanelProps) {
  const { currentProjectId, projects } = useProjectsStore();
  const { runTarget, setRunTarget } = useIdeStore();
  const project = currentProjectId ? projects[currentProjectId] : null;
  const isAndroidProject = project?.template?.startsWith('android-');
  const isKotlinOrJava = project?.template === 'kotlin-cli' || project?.template === 'java-cli';

  const [activeTab, setActiveTab] = useState<'terminal' | 'problems' | 'output' | 'console' | 'build'>('terminal');
  const consoleLogs = useOutputStore(s => s.consoleLogs);
  const addConsoleLog = useOutputStore(s => s.addConsoleLog);
  const clearConsoleLogs = useOutputStore(s => s.clearConsoleLogs);

  // Automatically switch away from build tab if not an android project
  useEffect(() => {
    if (activeTab === 'build' && !isAndroidProject) {
      setActiveTab('terminal');
    }
  }, [isAndroidProject, activeTab]);

  // Listen for console logs from preview
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        addConsoleLog({ type: detail.level, args: detail.args, ts: Date.now() });
      }
    };
    window.addEventListener('krypton-console-log', handler);
    return () => window.removeEventListener('krypton-console-log', handler);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <div className="flex h-9 items-center justify-between px-2 md:px-4 bg-[#1e1e1e] border-b border-[#3c3c3c] overflow-x-auto scrollbar-hide">
        <div className="flex items-center space-x-4 text-[11px] uppercase tracking-wider text-gray-400 whitespace-nowrap">
          <ProblemsTabLabel active={activeTab === 'problems'} onClick={() => setActiveTab('problems')} />
          <OutputTabLabel active={activeTab === 'output'} onClick={() => setActiveTab('output')} />
          <div
            className={`flex items-center space-x-2 cursor-pointer h-9 px-1 ${activeTab === 'console' ? 'text-white border-b border-blue-500' : 'hover:text-white'}`}
            onClick={() => setActiveTab('console')}
          >
            <span>Console</span>
            {consoleLogs.length > 0 && (
              <span className="bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{consoleLogs.length}</span>
            )}
          </div>
          <div
            className={`flex items-center space-x-2 cursor-pointer h-9 px-1 ${activeTab === 'terminal' ? 'text-white border-b border-blue-500' : 'hover:text-white'}`}
            onClick={() => setActiveTab('terminal')}
          >
            <span>Terminal</span>
          </div>
          {isAndroidProject && (
            <div
              className={`flex items-center space-x-1.5 cursor-pointer h-9 px-1 ${activeTab === 'build' ? 'text-blue-400 border-b border-blue-500' : 'hover:text-white text-blue-500/70'}`}
              onClick={() => setActiveTab('build')}
            >
              <Package size={14} />
              <span className="font-bold">Build APK</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Kotlin/Java Target Selector */}
          {isKotlinOrJava && (
            <div className="hidden md:flex items-center bg-[#252526] rounded-full p-0.5 border border-[#3c3c3c] mr-2">
              <button
                onClick={() => setRunTarget('java')}
                className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                  runTarget === 'java' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                JVM
              </button>
              <button
                onClick={() => setRunTarget('wasm')}
                className={`px-3 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                  runTarget === 'wasm' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                WASM
              </button>
            </div>
          )}

          <div className="flex items-center space-x-1 text-gray-400 flex-shrink-0">
            <button onClick={() => setHeight(height > 400 ? 250 : window.innerHeight - 150)} className="p-1 hover:text-white hover:bg-white/10 rounded" title="Toggle Maximize">
              {height > 400 ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <button onClick={onClose} className="p-1 hover:text-white hover:bg-white/10 rounded" title="Close Panel"><X size={14} /></button>
          </div>
        </div>
      </div>
        {activeTab === 'terminal' && <TerminalPanel />}
        {activeTab === 'problems' && <ProblemsPanel />}
        {activeTab === 'output' && <OutputPanel />}
        {activeTab === 'console' && <ConsolePanel logs={consoleLogs} onClear={clearConsoleLogs} />}
        {activeTab === 'build' && <BuildPanel onMinimize={onClose} />}
      </div>
  );
}

// ─── Problems Tab Label (with badge counts) ─────────────────
function ProblemsTabLabel({ active, onClick }: { active: boolean; onClick: () => void }) {
  const errorCount = useProblemsStore(s => s.errorCount);
  const warningCount = useProblemsStore(s => s.warningCount);

  return (
    <div
      className={`flex items-center space-x-2 cursor-pointer h-9 px-1 ${active ? 'text-white border-b border-blue-500' : 'hover:text-white'}`}
      onClick={onClick}
    >
      <span>Problems</span>
      {errorCount > 0 && (
        <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{errorCount}</span>
      )}
      {warningCount > 0 && (
        <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{warningCount}</span>
      )}
    </div>
  );
}

// ─── Output Tab Label ───────────────────────────────────────
function OutputTabLabel({ active, onClick }: { active: boolean; onClick: () => void }) {
  const entryCount = useOutputStore(s => s.entries.length);

  return (
    <div
      className={`flex items-center space-x-2 cursor-pointer h-9 px-1 ${active ? 'text-white border-b border-blue-500' : 'hover:text-white'}`}
      onClick={onClick}
    >
      <span>Output</span>
      {entryCount > 0 && (
        <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">{entryCount}</span>
      )}
    </div>
  );
}

// ─── Problems Panel ─────────────────────────────────────────
function ProblemsPanel() {
  const problems = useProblemsStore(s => s.problems);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const { setSidebarView } = useIdeStore();

  const filtered = filterSeverity === 'all' 
    ? problems 
    : problems.filter(p => p.severity === filterSeverity);

  // Group by file
  const grouped = filtered.reduce<Record<string, typeof problems>>((acc, p) => {
    const key = p.fileName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const sendToAgent = () => {
    if (problems.length === 0) return;
    
    const summary = problems.map(p => 
      `[${p.severity.toUpperCase()}] ${p.fileName}:${p.startLine}:${p.startCol} — ${p.message}`
    ).join('\n');

    // Switch to AI sidebar and set input
    setSidebarView('ai');
    
    // Dispatch a custom event so AiAssistant can pick it up
    window.dispatchEvent(new CustomEvent('krypton-send-to-agent', {
      detail: {
        text: `Fix these problems in my project:\n\n${summary}`
      }
    }));
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle size={14} className="text-red-400 flex-shrink-0" />;
      case 'warning': return <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />;
      default: return <Info size={14} className="text-blue-400 flex-shrink-0" />;
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d2d] flex-shrink-0">
        <div className="flex items-center space-x-1">
          {(['all', 'error', 'warning', 'info'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                filterSeverity === sev
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {sev === 'all' ? `All (${problems.length})` : `${sev} (${problems.filter(p => p.severity === sev).length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={sendToAgent}
            disabled={problems.length === 0}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-semibold bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Send all problems to Larry AI"
          >
            <Send size={11} />
            <span>Send to Agent</span>
          </button>
        </div>
      </div>

      {/* Problem List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(grouped).length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <AlertCircle size={24} className="mx-auto mb-2 opacity-30" />
              <p>No problems have been detected.</p>
            </div>
          </div>
        ) : (
          Object.entries(grouped).map(([fileName, fileProblems]) => (
            <div key={fileName}>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-300 bg-[#252526] sticky top-0 flex items-center space-x-2">
                <span>{fileName}</span>
                <span className="text-gray-500">({fileProblems.length})</span>
              </div>
              {fileProblems.map(problem => (
                <div
                  key={problem.id}
                  className="flex items-start space-x-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer text-[12px] border-b border-[#2d2d2d]/50"
                  onClick={() => {
                    // Open the file and navigate to the problem location
                    const store = useIdeStore.getState();
                    const fileEntry = Object.values(store.files).find(f => f.name === problem.fileName);
                    if (fileEntry) {
                      store.openFile(fileEntry.id);
                    }
                  }}
                >
                  {severityIcon(problem.severity)}
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-300">{problem.message}</span>
                  </div>
                  <span className="text-gray-600 text-[10px] flex-shrink-0 font-mono">
                    [{problem.startLine}:{problem.startCol}]
                  </span>
                  <span className="text-gray-600 text-[10px] flex-shrink-0">
                    {problem.source}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Output Panel ───────────────────────────────────────────
function OutputPanel() {
  const entries = useOutputStore(s => s.entries);
  const clearOutput = useOutputStore(s => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterSource, setFilterSource] = useState<'all' | 'terminal' | 'runner' | 'git' | 'system'>('all');

  const filtered = filterSource === 'all' 
    ? entries 
    : entries.filter(e => e.source === filterSource);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const typeColor = (type: string) => {
    switch (type) {
      case 'stderr': return 'text-red-400';
      case 'info': return 'text-blue-400';
      case 'system': return 'text-purple-400';
      default: return 'text-gray-300';
    }
  };

  const sourceTag = (source: string) => {
    const colors: Record<string, string> = {
      terminal: 'bg-green-500/15 text-green-400',
      runner: 'bg-blue-500/15 text-blue-400',
      git: 'bg-orange-500/15 text-orange-400',
      system: 'bg-purple-500/15 text-purple-400',
    };
    return colors[source] || 'bg-gray-500/15 text-gray-400';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2d2d2d] flex-shrink-0">
        <div className="flex items-center space-x-1">
          {(['all', 'runner', 'terminal', 'git', 'system'] as const).map(src => (
            <button
              key={src}
              onClick={() => setFilterSource(src)}
              className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider font-semibold transition-colors ${
                filterSource === src
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {src}
            </button>
          ))}
        </div>
        <button
          onClick={clearOutput}
          className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded"
          title="Clear Output"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Log Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[12px]">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No output yet. Run code or execute terminal commands.
          </div>
        ) : (
          filtered.map(entry => (
            <div key={entry.id} className="flex items-start px-3 py-1 hover:bg-[#2a2d2e] border-b border-[#2d2d2d]/30">
              <span className="text-gray-600 text-[10px] mr-2 flex-shrink-0 pt-0.5 min-w-[60px]">
                {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded mr-2 flex-shrink-0 uppercase tracking-wider font-bold ${sourceTag(entry.source)}`}>
                {entry.source}
              </span>
              <pre className={`flex-1 whitespace-pre-wrap break-words ${typeColor(entry.type)}`}>
                {entry.text}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Console Panel (preview iframe logs) ─────────────────────
function ConsolePanel({ logs, onClear }: { logs: { type: string; args: string; ts: number }[]; onClear: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const logColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  const logIcon = (type: string) => {
    switch (type) {
      case 'error': return '✕';
      case 'warn': return '⚠';
      case 'info': return 'ℹ';
      default: return '›';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#2d2d2d] flex-shrink-0">
        <span className="text-[10px] text-gray-500">Preview Console Output</span>
        <button onClick={onClear} className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded" title="Clear">
          <Trash2 size={12} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[12px]">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No console output. Run your preview to see logs here.
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`flex items-start px-3 py-1 hover:bg-[#2a2d2e] border-b border-[#2d2d2d]/30 ${logColor(log.type)}`}>
              <span className="text-gray-600 text-[10px] mr-2 flex-shrink-0 pt-0.5 min-w-[52px]">
                {new Date(log.ts).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="mr-2 flex-shrink-0 w-3 text-center">{logIcon(log.type)}</span>
              <pre className="flex-1 whitespace-pre-wrap break-words">{log.args}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
