import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Key, X, Sparkles, Loader2, Plus, MessageSquare, Trash2, ChevronDown, ChevronRight, BrainCircuit, FileCode, CheckCircle2, AlertCircle, Square, ClipboardList, Zap, Maximize, Minimize, Settings2, Paperclip } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import { useAiStore, Message, AttachedFile } from '../../store/useAiStore';
import { useProblemsStore } from '../../store/useProblemsStore';
import { useOutputStore } from '../../store/useOutputStore';
import { useDynamicModels } from '../../hooks/useDynamicModels';
import SYSTEM_INSTRUCTION from '../../../Larry.txt?raw';

function ThinkBlock({ content, duration }: { content: string; duration?: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="my-2 border border-[#30363d] rounded-lg overflow-hidden w-full max-w-full">
      <button onClick={() => setExpanded(!expanded)} className="w-full bg-[#161b22] hover:bg-[#21262d] px-3 py-2 text-[11px] font-mono text-gray-400 flex items-center transition-colors border-b border-transparent" style={{ borderBottomColor: expanded ? '#30363d' : 'transparent' }}>
        {expanded ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />}
        <BrainCircuit size={14} className="mr-2 text-blue-400" />
        Thought for {duration ? `${(duration / 1000).toFixed(1)} seconds` : 'a few seconds'}
      </button>
      {expanded && <pre className="p-3 text-[11px] overflow-x-auto bg-[#0d1117] text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">{content.trim()}</pre>}
    </div>
  );
}

function PlanBlock({ content, onComment }: { content: string, onComment?: () => void }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="my-2 border border-amber-800/40 rounded-lg overflow-hidden w-full max-w-full">
      <div className="flex bg-amber-950/30 transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 hover:bg-amber-950/50 px-3 py-2 text-[11px] font-mono text-amber-300 flex items-center text-left">
          {expanded ? <ChevronDown size={14} className="mr-2 shrink-0" /> : <ChevronRight size={14} className="mr-2 shrink-0" />}
          <ClipboardList size={14} className="mr-2 shrink-0 text-amber-400" />
          <span className="truncate">Implementation Plan</span>
        </button>
        {onComment && (
          <button 
            onClick={onComment}
            className="px-3 py-2 hover:bg-amber-900/50 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center transition-colors border-l border-amber-800/20"
            title="Add a comment to this plan"
          >
            <MessageSquare size={12} className="mr-1.5" /> Comment
          </button>
        )}
      </div>
      {expanded && <pre className="p-3 text-[11px] overflow-x-auto bg-[#0d1117] text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{content.trim()}</pre>}
    </div>
  );
}

function StatusBlock({ content }: { content: string }) {
  return (
    <div className="my-1 flex items-center space-x-2 px-3 py-1.5 bg-blue-950/20 border border-blue-800/30 rounded-lg">
      <Zap size={12} className="text-blue-400 shrink-0" />
      <span className="text-[11px] text-blue-300 font-mono">{content.trim()}</span>
    </div>
  );
}

function ToolResultBlock({ msg }: { msg: Message }) {
  const isError = msg.content.toLowerCase().includes('error');
  const toolLabel = msg.name === 'read_file' ? 'Read File' 
    : msg.name === 'edit_lines' ? 'Edited Lines'
    : msg.name === 'insert_lines' ? 'Inserted Lines'
    : msg.name === 'patch_file' ? 'Patched File'
    : msg.name === 'write_new_file' ? 'Created File'
    : msg.name === 'create_directory' ? 'Created Directory'
    : 'Tool Result';
  return (
    <div className="my-2 border border-[#30363d] rounded-lg overflow-hidden w-full max-w-full bg-[#0d1117]">
      <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#30363d]">
        <div className="flex items-center space-x-2">
          {isError ? <AlertCircle size={12} className="text-red-400" /> : <CheckCircle2 size={12} className="text-emerald-400" />}
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{toolLabel}</span>
        </div>
      </div>
      <pre className="p-2.5 text-[10px] font-mono text-gray-500 overflow-x-auto max-h-32">
        {msg.content.slice(0, 500)}{msg.content.length > 500 ? '...' : ''}
      </pre>
    </div>
  );
}

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIzaSy...', models: ['gemini-3.0-pro', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'], defaultModel: 'gemini-1.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...', models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'], defaultModel: 'gpt-4o', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', name: 'Anthropic Claude', placeholder: 'sk-ant-...', models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'], defaultModel: 'claude-3-7-sonnet-20250219', baseUrl: 'https://api.anthropic.com/v1' },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], defaultModel: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'mistral', name: 'Mistral AI', placeholder: 'M...', models: ['mistral-large-latest', 'codestral-latest'], defaultModel: 'mistral-large-latest', baseUrl: 'https://api.mistral.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...', models: ['anthropic/claude-3.7-sonnet', 'google/gemini-2.0-flash-exp:free'], defaultModel: 'google/gemini-2.0-flash-exp:free', baseUrl: 'https://openrouter.ai/api/v1' },
];

export function AiAssistant() {
  const { files, updateFileContent, saveFile, createFile, isAiFullscreen, setAiFullscreen } = useIdeStore();
  const aiStore = useAiStore();
  const activeProvider = aiStore.provider;
  const currentProvider = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0];
  const currentKey = aiStore.apiKey;
  const selectedModel = aiStore.model;
  const isAiLoading = aiStore.isLoading;

  const { models: dynamicModels, isLoading: isModelsLoading } = useDynamicModels(activeProvider, currentKey);
  
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState({ active: false, text: '', startIdx: 0 });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = aiStore.sessions.find(s => s.id === aiStore.activeSessionId) || aiStore.sessions[0];
  const aiMessages = activeSession?.messages || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        setAttachments(prev => [...prev, { name: file.name, type: file.type || 'application/octet-stream', data }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [aiMessages, aiStore.streamingText]);

  const startNewSession = () => {
    const id = aiStore.createNewSession();
    aiStore.setActiveSession(id);
    setShowSessionList(false);
    setInput('');
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@')) {
      setMentionQuery({ active: true, text: lastWord.slice(1).toLowerCase(), startIdx: cursor - lastWord.length });
    } else {
      setMentionQuery({ active: false, text: '', startIdx: 0 });
    }
  };

  const insertMention = (filename: string) => {
    const before = input.slice(0, mentionQuery.startIdx);
    const after = input.slice(mentionQuery.startIdx + mentionQuery.text.length + 1);
    setInput(before + `@${filename} ` + after);
    setMentionQuery({ active: false, text: '', startIdx: 0 });
    inputRef.current?.focus();
  };

  const getMentionOptions = () => {
    const fileMatches = Object.values(files).filter(f => f.type === 'file' && f.name.toLowerCase().includes(mentionQuery.text)).slice(0, 8);
    const options: any[] = [...fileMatches];
    if ('problems'.includes(mentionQuery.text.toLowerCase())) {
      options.unshift({ name: 'problems', isSpecial: true });
    }
    return options.slice(0, 8);
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || (!aiStore.apiKey && aiStore.provider !== 'openrouter')) return;
    
    const words = input.split(/\s+/);
    const mentions = words.filter(w => w.startsWith('@')).map(w => w.slice(1));
    let contextString = '';
    
    if (mentions.includes('problems')) {
      const problems = useProblemsStore.getState().problems;
      const logs = useOutputStore.getState().consoleLogs;
      
      const pText = problems.length > 0 
        ? 'Editor Problems:\n' + problems.map((p: any) => `[${p.severity.toUpperCase()}] ${p.fileName}:${p.startLine}:${p.startCol} — ${p.message}`).join('\n') 
        : 'No editor problems detected.';
        
      const cText = logs && logs.length > 0 
        ? 'Preview Web Console Logs:\n' + logs.map((l: any) => `[${l.type.toUpperCase()}] ${l.args}`).join('\n') 
        : 'No preview console logs.';
        
      contextString += `\n<problems_context>\n${pText}\n\n${cText}\n</problems_context>\n`;
    }

    const fileMentions = mentions.filter(m => m !== 'problems');
    if (fileMentions.length > 0) {
      const taggedFiles = Object.values(files).filter(f => f.type === 'file' && fileMentions.includes(f.name));
      if (taggedFiles.length > 0) {
        contextString += '\n\n<tagged_files>\n' + taggedFiles.map(f => {
          // Build full path for the file
          const buildPath = (nodeId: string): string => {
            const node = files[nodeId];
            if (!node || !node.parentId || nodeId === 'root') return '';
            const parentPath = buildPath(node.parentId);
            return parentPath ? `${parentPath}/${node.name}` : node.name;
          };
          const fileId = Object.entries(files).find(([_, n]) => n === f)?.[0] || '';
          const fullPath = fileId ? buildPath(fileId) : f.name;
          return `<file path="${fullPath}">\n${f.content || ''}\n</file>`;
        }).join('\n\n') + '\n</tagged_files>';
      }
    }

    // Build hierarchical file tree with paths
    const buildPathForNode = (nodeId: string): string => {
      const node = files[nodeId];
      if (!node || !node.parentId || nodeId === 'root') return '';
      const parentPath = buildPathForNode(node.parentId);
      return parentPath ? `${parentPath}/${node.name}` : node.name;
    };
    const fileTreeItems = Object.entries(files)
      .filter(([id, f]) => f.type === 'file' && id !== 'root')
      .map(([id]) => `  - ${buildPathForNode(id)}`)
      .join('\n');

    // Include active file context if one is open
    const activeFile = useIdeStore.getState().activeFileId;
    let activeFileContext = '';
    if (activeFile && files[activeFile]) {
      const af = files[activeFile];
      const afPath = buildPathForNode(activeFile);
      activeFileContext = `\n<active_file path="${afPath}" language="${af.language || 'text'}" />\n`;
    }
    const systemContext = SYSTEM_INSTRUCTION + `\n<project_file_tree>\n${fileTreeItems}\n</project_file_tree>\n` + activeFileContext + contextString;

    const currentInput = input;
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setMentionQuery({ active: false, text: '', startIdx: 0 });

    const prov = PROVIDERS.find(p => p.id === aiStore.provider);
    aiStore.setBaseUrl(prov?.baseUrl || '');

    let sessionId = activeSession?.id;
    if (!sessionId) {
      sessionId = aiStore.createNewSession();
    }

    await aiStore.sendMessage(sessionId, currentInput, systemContext, currentAttachments);
  }

  const applyCode = (filename: string, content: string) => {
    // filename might be a full path like "src/components/App.tsx"
    // We need to resolve it against the exact path in the file tree
    const buildPath = (nodeId: string): string => {
      const node = files[nodeId];
      if (!node || !node.parentId || nodeId === 'root') return '';
      const parentPath = buildPath(node.parentId);
      return parentPath ? `${parentPath}/${node.name}` : node.name;
    };

    const fileEntry = Object.entries(files).find(([id, f]) => {
      if (f.type !== 'file') return false;
      return f.name === filename || buildPath(id) === filename;
    });

    if (fileEntry) { 
      updateFileContent(fileEntry[0], content); 
      saveFile(fileEntry[0]); 
    } else { 
      const id = createFile(filename.split('/').pop() || filename, 'root', 'file', content); 
      saveFile(id); 
    }
  };

  const getModifiedFiles = (msg: Message) => {
    const filesModified = new Set<string>();
    
    // 1. Extact from <edit> tags
    const regex = /<edit(?: file="([^"]*)")?>/g;
    let match;
    while ((match = regex.exec(msg.content)) !== null) {
      if (match[1]) filesModified.add(match[1].split('/').pop() || match[1]);
    }

    // 2. Extract from tool calls (if model adapters pass them down)
    if (msg.tool_calls) {
      msg.tool_calls.forEach(call => {
        const name = call.function?.name;
        if (name && ['edit_lines', 'insert_lines', 'patch_file', 'write_new_file'].includes(name)) {
          try {
            const args = JSON.parse(call.function.arguments);
            if (args.path) filesModified.add(args.path.split('/').pop() || args.path);
          } catch { } // ignore incomplete JSON streaming
        }
      });
    }
    
    return Array.from(filesModified);
  };

  const renderMessageContent = (content: string, msg: Message) => {
    if (msg.role === 'tool') return <ToolResultBlock msg={msg} />;
    
    // Check if the message contains any of our special tags
    const hasTags = content.includes('<ans>') || content.includes('<edit ') || content.includes('<plan>') || content.includes('<status>');
    
    // Fallback: If no tags are found, treat the whole message as a standard response
    if (!hasTags) {
      const rendered = content.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_m, _lang, code) => code);
      return <span key="fallback" className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words block">{rendered}</span>;
    }

    // Split by tags (ans, edit, plan, status) while preserving them.
    // Removed naive quote matching which swallowed tags after apostrophes.
    const rawParts = content.split(/(<ans>[\s\S]*?(?:<\/ans>|$)|<edit(?: file="[^"]*")?>[\s\S]*?(?:<\/edit>|$)|<plan>[\s\S]*?(?:<\/plan>|$)|<status>[\s\S]*?(?:<\/status>|$))/g);
    
    // Merge adjacent reasoning parts to keep Thought blocks contiguous
    const parts: string[] = [];
    rawParts.forEach(p => {
      if (!p) return;
      const isTag = p.startsWith('<ans>') || p.startsWith('<edit ') || p.startsWith('<plan>') || p.startsWith('<status>');
      const last = parts[parts.length - 1];
      const lastIsTag = last && (last.startsWith('<ans>') || last.startsWith('<edit ') || last.startsWith('<plan>') || last.startsWith('<status>'));

      if (isTag || !last || lastIsTag) {
        parts.push(p);
      } else {
        parts[parts.length - 1] += p;
      }
    });

    return parts.map((part, i) => {
      if (!part || (part.trim() === '' && !part.startsWith('<ans>'))) return null;

      if (part.startsWith('<ans>')) {
        const ansContent = part.replace(/^<ans>/, '').replace(/<\/ans>$/, '');
        const rendered = ansContent.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_m, _lang, code) => code);
        return <span key={i} className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words block mb-2">{rendered}</span>;
      }

      if (part.startsWith('<plan>')) {
        const planContent = part.replace(/^<plan>/, '').replace(/<\/plan>$/, '');
        return <PlanBlock key={i} content={planContent} onComment={() => {
          setInput(prev => prev + (prev.trim() ? '\n' : '') + 'Regarding your implementation plan: \n\n');
          setTimeout(() => inputRef.current?.focus(), 10);
        }} />;
      }

      if (part.startsWith('<status>')) {
        const statusContent = part.replace(/^<status>/, '').replace(/<\/status>$/, '');
        return <StatusBlock key={i} content={statusContent} />;
      }

      if (part.startsWith('<edit')) {
        const match = part.match(/<edit(?: file="([^"]*)")?>([\s\S]*?)(?:<\/edit>|$)/);
        if (match) {
          const filename = match[1] || 'untitled', code = match[2].trim();
          const isClosed = part.includes('</edit>');
          return (
            <div key={i} className="my-2 border border-[#30363d] rounded-lg overflow-hidden w-full max-w-full">
              <div className="bg-[#21262d] px-3 py-1.5 text-xs font-mono text-gray-300 flex justify-between items-center truncate">
                <div className="flex items-center space-x-2 min-w-0"><FileCode size={14} className="text-blue-400" /><span className="truncate">{filename}</span></div>
                {isClosed && (
                  <button onClick={() => applyCode(filename, code)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 rounded h-6 text-[10px] font-bold uppercase transition-colors shrink-0">Apply</button>
                )}
              </div>
              <pre className="p-3 text-[11px] overflow-x-auto bg-[#0d1117] text-gray-300 whitespace-pre-wrap">{code}</pre>
            </div>
          );
        }
      }

      // Default: Consider everything else as "Thinking"
      const duration = msg.completedAt ? msg.completedAt - msg.timestamp : undefined;
      return <ThinkBlock key={i} content={part} duration={duration} />;
    });
  };

  if (!aiStore.apiKey && aiStore.provider !== 'openrouter' && !showSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-8 bg-[#1e1e1e]">
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse">
          <Sparkles size={48} className="text-white" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight border-b border-white/10 pb-2 inline-block">Larry Elite</h3>
          <p className="text-sm text-gray-400 max-w-[240px] leading-relaxed">
            Unleash the full power of agentic coding assistance. Connect your Sednium API keys to begin.
          </p>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center space-x-2 bg-white text-black hover:bg-gray-200 active:scale-95 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-white/5"
        >
          <Key size={18} />
          <span>Setup Connection</span>
        </button>
      </div>
    );
  }

  // Settings panel
  if (showSettings) {
    return (
      <div className="flex h-full flex-col bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d2d2d] shrink-0">
          <div className="flex items-center space-x-2">
            <Bot size={18} className="text-blue-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Model Configurations</h3>
          </div>
          <button onClick={() => setShowSettings(false)} className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Saved Models List */}
          <div>
            <h4 className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3 block">Saved Models</h4>
            <div className="space-y-2">
              {aiStore.savedModels.map(model => (
                <div key={model.id} className="flex items-center justify-between bg-[#161b22] px-3 py-2.5 rounded-xl border border-[#30363d]">
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => aiStore.setActiveSavedModel(model.id)}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${aiStore.activeModelId === model.id ? 'border-emerald-500 bg-emerald-500/20' : 'border-gray-500'}`}
                    >
                      {aiStore.activeModelId === model.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-gray-200">{model.name}</span>
                      <span className="text-[9px] text-gray-500 font-mono mt-0.5">{model.provider} / {model.model}</span>
                    </div>
                  </div>
                  <button onClick={() => aiStore.removeSavedModel(model.id)} className="text-gray-500 hover:text-red-400 p-1.5 transition-colors rounded-lg hover:bg-white/5">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {aiStore.savedModels.length === 0 && (
                <div className="text-[11px] text-gray-500 italic p-4 text-center border border-dashed border-gray-700/50 rounded-xl">
                  No saved models yet. Create one below to continue.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#30363d] pt-6 space-y-6">
            <h4 className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-3 block">Add New Configuration</h4>
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3 block">Infrastructure Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => {
                      aiStore.setProvider(provider.id);
                      aiStore.setModel(provider.defaultModel);
                      aiStore.setBaseUrl(provider.baseUrl);
                    }}
                  className={`px-3 py-2.5 rounded-xl text-xs text-center border transition-all duration-200 ${
                    activeProvider === provider.id
                      ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                      : 'bg-[#161b22] text-gray-500 border-[#30363d] hover:border-gray-500'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 block">Secret Key</label>
              <input
                type="text"
                value={currentKey}
                onChange={(e) => aiStore.setApiKey(e.target.value)}
                placeholder={currentProvider.placeholder}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-blue-500/50 focus:outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] block">Deployment Model</label>
                {isModelsLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
              </div>
              <input
                type="text"
                list={`models-${activeProvider}`}
                value={selectedModel}
                onChange={(e) => aiStore.setModel(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-blue-500/50 focus:outline-none transition-all"
                placeholder="Model ID..."
              />
              <datalist id={`models-${activeProvider}`}>
                {dynamicModels.map(m => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0 border-t border-[#2d2d2d] bg-[#1a1a1a]">
          <button 
            onClick={() => {
              if (currentKey || activeProvider === 'openrouter') {
                aiStore.addSavedModel({
                  id: Date.now().toString(36),
                  name: `${currentProvider.name} - Custom`,
                  provider: activeProvider,
                  model: selectedModel,
                  apiKey: currentKey,
                  baseUrl: currentProvider.baseUrl
                });
                if (aiStore.savedModels.length === 0 && (!aiStore.activeModelId)) {
                  // automatically set active if it's the first
                  const newId = aiStore.savedModels[0]?.id; // wait, state update is queued, so this might not catch it instantly. We can manually set it if needed.
                }
              }
            }}
            disabled={!currentKey && activeProvider !== 'openrouter'}
            className="w-full bg-[#161b22] hover:bg-blue-600 border border-[#30363d] disabled:opacity-50 disabled:hover:bg-[#161b22] text-white py-3.5 rounded-2xl text-sm font-bold transition-all shadow-lg"
          >
            Save Model Configuration
          </button>
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="flex h-full flex-col relative w-full overflow-hidden bg-[#212121]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0 bg-[#212121] z-30">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Larry</span>
            <span className="text-[9px] text-gray-500 border border-white/10 rounded px-1">{selectedModel}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={() => setAiFullscreen(!isAiFullscreen)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all">
            {isAiFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button onClick={() => setShowSessionList(!showSessionList)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all">
            <MessageSquare size={16} />
          </button>
          <div className="relative">
            <button onClick={() => setShowModelDropdown(!showModelDropdown)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/5 transition-all">
              <Key size={16} />
            </button>
            {showModelDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#2d2d2d] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 p-2 animate-scale-in">
                  <div className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2 px-2 mt-1">Saved Models</div>
                  <div className="flex flex-col mb-1 max-h-[300px] overflow-y-auto">
                    {aiStore.savedModels.map(m => (
                      <button 
                        key={m.id} 
                        onClick={() => { aiStore.setActiveSavedModel(m.id); setShowModelDropdown(false); }} 
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex flex-col transition-all ${
                          aiStore.activeModelId === m.id ? 'bg-blue-600/10 text-blue-400' : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold truncate">{m.name}</span>
                          {aiStore.activeModelId === m.id && <CheckCircle2 size={12} className="text-blue-400 shrink-0" />}
                        </div>
                        <span className="text-[9px] opacity-70 truncate font-mono mt-0.5">{m.provider} - {m.model}</span>
                      </button>
                    ))}
                    {aiStore.savedModels.length === 0 && (
                      <div className="px-3 py-4 text-center text-[10px] text-gray-500">
                        No saved configurations.
                      </div>
                    )}
                  </div>
                  <div className="p-1 border-t border-white/5 mt-1">
                    <button onClick={() => { setShowModelDropdown(false); setShowSettings(true); }} className="w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-white transition-colors flex items-center justify-center space-x-2">
                       <Settings2 size={14} />
                       <span>Configure Models</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Session list overlay */}
      {showSessionList && (
        <div className="absolute inset-x-0 top-[52px] bottom-0 bg-[#212121] z-[45] flex flex-col border-r border-white/5 animate-slide-in-right">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Conversations</span>
            <button onClick={startNewSession} className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-500">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {aiStore.sessions.map(session => (
              <div key={session.id} className="flex items-center group">
                <button
                  onClick={() => {
                    aiStore.setActiveSession(session.id);
                    setShowSessionList(false);
                  }}
                  className={`flex-1 text-left px-3 py-3 rounded-xl text-xs transition-all ${
                    aiStore.activeSessionId === session.id
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium truncate">
                    {session.messages[session.messages.length - 1]?.content.slice(0, 30) || 'New Conversation'}
                  </div>
                  <div className="text-[9px] opacity-50 mt-1">{new Date(session.id).toLocaleString()}</div>
                </button>
                <button 
                  onClick={() => aiStore.deleteSession(session.id)}
                  className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-24">
        {aiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 px-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-[#2d2d2d] to-[#3d3d3d] flex items-center justify-center mb-6">
               <Bot size={32} className="text-blue-500/30" />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-[200px]">
              Krypton's agentic core is online. Tag context with <span className="text-blue-400 font-mono">@</span>.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-2 w-full">
              {['@App.tsx fix the layout', 'Optimize @index.css', 'Create a new utility file'].map(suggestion => (
                <button 
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-4 py-3 text-[11px] font-medium text-gray-400 bg-white/5 rounded-2xl hover:bg-white/10 hover:text-white transition-all border border-white/5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {aiMessages.filter(m => m.role !== 'system').map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full animate-fade-in`}>
            <div className={`max-w-[100%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20' 
                : msg.role === 'tool'
                  ? 'bg-transparent w-full px-0 py-0'
                  : 'bg-[#2d2d2d] text-gray-200 border border-white/5 rounded-bl-none w-full shadow-xl'
            }`}>
              {msg.role !== 'user' ? (
                <>
                  {renderMessageContent(msg.content, msg)}
                  {msg.role === 'assistant' && (() => {
                    const modified = getModifiedFiles(msg);
                    if (modified.length === 0) return null;
                    return (
                      <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2 animate-fade-in">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">
                          Modified ({modified.length})
                        </span>
                        {modified.map((file, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5 px-2 py-1 bg-[#161b22] border border-[#30363d] rounded-md shadow-sm">
                            <FileCode size={12} className="text-blue-400" />
                            <span className="text-[10px] font-mono text-gray-300">{file}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed break-words">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {isAiLoading && (
          <div className="flex justify-start w-full animate-fade-in pb-4">
            {aiStore.streamingText ? (
              <div className="max-w-[100%] rounded-2xl px-4 py-3 bg-[#161b22]/50 border border-blue-500/20 shadow-lg shadow-blue-500/5 backdrop-blur-sm">
                {renderMessageContent(aiStore.streamingText, { 
                  role: 'assistant', 
                  content: aiStore.streamingText,
                  timestamp: Date.now() 
                } as any)}
                <div className="flex items-center space-x-1 mt-3 mb-1 px-1 opacity-60">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                   <span className="text-[9px] font-mono text-blue-400 ml-2 uppercase tracking-widest animate-pulse">Reasoning...</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#2d2d2d] border border-white/5 rounded-2xl px-5 py-4 flex items-center space-x-3 shadow-lg">
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Initial Connection...</span>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mention Auto-Complete Menu */}
      {mentionQuery.active && getMentionOptions().length > 0 && (
        <div className="absolute bottom-[4.5rem] left-4 right-4 bg-[#2d2d2d] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] py-2 z-50 animate-scale-in">
          <div className="px-4 py-2 border-b border-white/5 text-[9px] text-gray-500 uppercase tracking-[0.2em] font-black">
            Available File Context
          </div>
          <div className="max-h-48 overflow-y-auto">
            {getMentionOptions().map(f => (
              <button 
                key={f.name}
                onClick={() => insertMention(f.name)}
                className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-blue-600 hover:text-white transition-all flex items-center space-x-3 group"
              >
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/20">
                  {f.isSpecial ? <AlertCircle size={12} className="text-red-400 group-hover:text-white" /> : <FileCode size={12} className="text-blue-400 group-hover:text-white" />}
                </div>
                <span>{f.isSpecial ? 'problems (Errors & Logs)' : f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="p-3 border-t border-white/5 flex-shrink-0 bg-[#212121] z-40 relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          multiple 
          accept="image/*,text/*,application/json,application/javascript,text/typescript" 
          className="hidden" 
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center space-x-1.5 bg-[#2d2d2d] border border-white/10 rounded-lg px-2 py-1 shadow-lg">
                {att.type.startsWith('image/') ? (
                  <img src={att.data} alt={att.name} className="w-4 h-4 object-cover rounded-[2px]" />
                ) : (
                  <Paperclip size={12} className="text-blue-400" />
                )}
                <span className="text-[10px] text-gray-300 truncate max-w-[120px] font-medium">{att.name}</span>
                <button 
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} 
                  className="text-gray-500 hover:text-red-400 ml-1 transition-colors"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center space-x-2 bg-[#0d1117] border border-white/10 rounded-2xl px-2 focus-within:border-blue-500/50 transition-all shadow-inner shadow-black/40">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-blue-400 rounded-xl transition-all flex-shrink-0 active:scale-95">
            <Plus size={20} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (mentionQuery.active && getMentionOptions().length > 0) {
                  e.preventDefault();
                  insertMention(getMentionOptions()[0].name);
                } else if (!isAiLoading) {
                  sendMessage();
                }
              }
            }}
            placeholder="Build something incredible..."
            className="flex-1 min-w-0 bg-transparent py-3.5 text-sm text-white placeholder-gray-700 focus:outline-none"
          />
          <div className="flex items-center pr-1 space-x-1">
            {isAiLoading ? (
              <button
                onClick={() => aiStore.abortChat()}
                className="p-2 bg-red-600 text-white hover:bg-red-500 rounded-[0.7rem] transition-all flex-shrink-0 active:scale-90 shadow-lg shadow-red-900/20"
                title="Stop Generation"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim() || (!currentKey && aiStore.provider !== 'openrouter')}
                className="p-2 bg-white text-black hover:bg-gray-200 disabled:opacity-20 disabled:hover:bg-white rounded-[0.7rem] transition-all flex-shrink-0 active:scale-90"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
