import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, Key, X, Sparkles, Loader2, Plus, MessageSquare, Trash2, ChevronLeft, ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import SYSTEM_INSTRUCTION from '../../../Luminous.txt?raw';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  completedAt?: number;
}

function ThinkBlock({ content, duration }: { content: string; duration?: number }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="my-2 border border-[#30363d] rounded-lg overflow-hidden w-full max-w-full">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-[#161b22] hover:bg-[#21262d] px-3 py-2 text-[11px] font-mono text-gray-400 flex items-center transition-colors border-b border-transparent"
        style={{ borderBottomColor: expanded ? '#30363d' : 'transparent' }}
      >
        {expanded ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />}
        <BrainCircuit size={14} className="mr-2 text-blue-400" />
        Thought for {duration ? `${(duration / 1000).toFixed(1)} seconds` : 'a few seconds'}
      </button>
      {expanded && (
        <pre className="p-3 text-[11px] overflow-x-auto bg-[#0d1117] text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
          {content.trim()}
        </pre>
      )}
    </div>
  );
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

type Provider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'openrouter';

interface ProviderConfig {
  id: Provider;
  name: string;
  placeholder: string;
  models: string[];
  defaultModel: string;
  baseUrl: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    placeholder: 'AIzaSy...',
    models: ['gemini-3.0-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemma-4-27b-it', 'gemma-3-27b-it'],
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    placeholder: 'sk-...',
    models: ['gpt-5.4', 'gpt-5.4-turbo', 'gpt-5', 'gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
    defaultModel: 'gpt-5.4',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    placeholder: 'sk-ant-...',
    models: ['claude-4.6-opus', 'claude-4.6-sonnet', 'claude-4.5-opus', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022'],
    defaultModel: 'claude-4.6-opus',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    placeholder: 'gsk_...',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    placeholder: 'M...',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    defaultModel: 'mistral-large-latest',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    placeholder: 'sk-or-...',
    models: ['anthropic/claude-3.7-sonnet', 'google/gemini-2.5-flash', 'google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-r1:free'],
    defaultModel: 'google/gemini-2.5-flash',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
];

// ─── Session Persistence ─────────────────────────────────
const SESSIONS_KEY = 'krypton-ai-sessions';
const ACTIVE_SESSION_KEY = 'krypton-ai-active-session';

function loadSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function createNewSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function generateTitle(msg: string): string {
  const clean = msg.replace(/@\S+/g, '').trim();
  return clean.length > 40 ? clean.slice(0, 40) + '…' : clean || 'New Chat';
}

// ─── Global pending request (survives tab switches) ──────
let pendingAbort: AbortController | null = null;

export function AiAssistant() {
  const { files, updateFileContent, saveFile, createFile } = useIdeStore();
  
  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const loaded = loadSessions();
    return loaded.length > 0 ? loaded : [createNewSession()];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_SESSION_KEY);
    const loaded = loadSessions();
    if (saved && loaded.find(s => s.id === saved)) return saved;
    return loaded[0]?.id || createNewSession().id;
  });
  const [showSessionList, setShowSessionList] = useState(false);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Mention State
  const [mentionQuery, setMentionQuery] = useState<{ active: boolean; text: string; startIdx: number }>({ active: false, text: '', startIdx: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Provider state
  const [activeProvider, setActiveProvider] = useState<Provider>(() => {
    return (localStorage.getItem('krypton-ai-provider') as Provider) || 'gemini';
  });
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('krypton-ai-keys') || '{}'); } catch { return {}; }
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('krypton-ai-model') || 'gemini-2.0-flash';
  });

  const currentProvider = PROVIDERS.find(p => p.id === activeProvider)!;
  const currentKey = apiKeys[activeProvider] || '';
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Persist sessions whenever they change
  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId); }, [activeSessionId]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('krypton-ai-provider', activeProvider);
    localStorage.setItem('krypton-ai-keys', JSON.stringify(apiKeys));
    localStorage.setItem('krypton-ai-model', selectedModel);
  }, [activeProvider, apiKeys, selectedModel]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);

  // Listen for "Send to Agent" events 
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        setInput(detail.text);
        setShowSettings(false);
        setShowSessionList(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('krypton-send-to-agent', handler);
    return () => window.removeEventListener('krypton-send-to-agent', handler);
  }, []);

  const updateApiKey = (provider: Provider, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }));
  };

  const updateSessionMessages = useCallback((sessionId: string, newMessages: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const title = s.messages.length === 0 && newMessages.length > 0 
        ? generateTitle(newMessages[0].content) 
        : s.title;
      return { ...s, messages: newMessages, title, updatedAt: Date.now() };
    }));
  }, []);

  // ─── New / Delete / Switch session ─────────────────────
  const startNewSession = () => {
    const session = createNewSession();
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(session.id);
    setShowSessionList(false);
    setInput('');
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createNewSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === id) setActiveSessionId(filtered[0].id);
      return filtered;
    });
  };

  // ─── Mention handling ──────────────────────────────────
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
    return Object.values(files)
      .filter(f => f.type === 'file' && f.name.toLowerCase().includes(mentionQuery.text))
      .slice(0, 8);
  };

  const applyCode = (filename: string, content: string) => {
    const fileEntry = Object.entries(files).find(([_, f]) => f.name === filename);
    if (fileEntry) {
      updateFileContent(fileEntry[0], content);
      saveFile(fileEntry[0]);
    } else {
      const id = createFile(filename, 'root', 'file', content);
      saveFile(id);
    }
  };

  const renderMessageContent = (content: string, msg: Message) => {
    const parts = content.split(/(<think>[\s\S]*?<\/think>|<edit file="[^"]+">[\s\S]*?<\/edit>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<think>')) {
        const thoughtContent = part.replace(/^<think>/, '').replace(/<\/think>$/, '');
        const duration = msg.completedAt ? msg.completedAt - msg.timestamp : undefined;
        return <ThinkBlock key={i} content={thoughtContent} duration={duration} />;
      }
      if (part.startsWith('<edit file="')) {
        const match = part.match(/<edit file="([^"]+)">([\s\S]*?)<\/edit>/);
        if (match) {
          const filename = match[1];
          const code = match[2].trim();
          return (
            <div key={i} className="my-2 border border-[#30363d] rounded-lg overflow-hidden w-full max-w-full">
              <div className="bg-[#21262d] px-3 py-1.5 text-xs font-mono text-gray-300 flex justify-between items-center">
                <span className="truncate pr-2">{filename}</span>
                <button onClick={() => applyCode(filename, code)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded shadow text-[10px] uppercase tracking-wider font-bold transition-colors">Apply</button>
              </div>
              <pre className="p-3 text-[11px] overflow-x-auto bg-[#0d1117] text-gray-300">{code}</pre>
            </div>
          );
        }
      }
      // Render markdown code blocks
      const rendered = part.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_m, _lang, code) => code);
      return <span key={i} className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words block">{rendered}</span>;
    });
  };

  // ─── Send with streaming ───────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !currentKey) return;

    // Build context
    const words = input.split(/\s+/);
    const mentions = words.filter(w => w.startsWith('@')).map(w => w.slice(1));
    let contextString = '';
    if (mentions.length > 0) {
      const taggedFiles = Object.values(files).filter(f => f.type === 'file' && mentions.includes(f.name));
      if (taggedFiles.length > 0) {
        contextString = '\n\n<tagged_files>\n' + taggedFiles.map(f => `<file name="${f.name}">\n${f.content || ''}\n</file>`).join('\n') + '\n</tagged_files>\n';
      }
    }

    const fileTreeItems = Object.values(files)
      .filter(f => f.type === 'file')
      .map(f => `  - ${f.name}`)
      .join('\n');
    const projectTreeContext = `\n<project_file_tree>\n${fileTreeItems}\n</project_file_tree>\n`;

    const finalSystemInstruction = SYSTEM_INSTRUCTION + projectTreeContext + contextString;
    const userMessage: Message = { role: 'user', content: input, timestamp: Date.now() };
    const newMessages = [...messages, userMessage];
    updateSessionMessages(activeSessionId, newMessages);
    setInput('');
    setMentionQuery({ active: false, text: '', startIdx: 0 });
    setIsLoading(true);
    setStreamingText('');

    // Abort controller for cancellation
    pendingAbort = new AbortController();
    const signal = pendingAbort.signal;

    try {
      let assistantContent = '';

      if (activeProvider === 'gemini') {
        // Gemini: try streaming endpoint first
        try {
          const response = await fetch(
            `${currentProvider.baseUrl}/models/${selectedModel}:streamGenerateContent?alt=sse&key=${currentKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal,
              body: JSON.stringify({
                contents: newMessages.map(m => ({
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }],
                })),
                systemInstruction: { parts: [{ text: finalSystemInstruction }] },
              }),
            }
          );

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              // Parse SSE data lines
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    fullText += text;
                    setStreamingText(fullText);
                  } catch { /* skip non-JSON lines */ }
                }
              }
            }
            assistantContent = fullText;
          } else {
            // Fallback to non-streaming
            const fallback = await fetch(
              `${currentProvider.baseUrl}/models/${selectedModel}:generateContent?key=${currentKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal,
                body: JSON.stringify({
                  contents: newMessages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                  })),
                  systemInstruction: { parts: [{ text: finalSystemInstruction }] },
                }),
              }
            );
            const data = await fallback.json();
            assistantContent = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';
          }
        } catch (err: any) {
          if (err.name === 'AbortError') { setIsLoading(false); return; }
          throw err;
        }
      } else if (activeProvider === 'openai' || activeProvider === 'groq' || activeProvider === 'mistral' || activeProvider === 'openrouter') {
        // OpenAI-compatible streaming
        try {
          const response = await fetch(`${currentProvider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentKey}`,
            },
            signal,
            body: JSON.stringify({
              model: selectedModel,
              stream: true,
              messages: [
                { role: 'system', content: finalSystemInstruction },
                ...newMessages.map(m => ({ role: m.role, content: m.content })),
              ],
              max_tokens: 4096,
            }),
          });

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const delta = json.choices?.[0]?.delta?.content || '';
                    fullText += delta;
                    setStreamingText(fullText);
                  } catch { /* skip */ }
                }
              }
            }
            assistantContent = fullText;
          } else {
            const data = await response.json();
            assistantContent = data.choices?.[0]?.message?.content || data.error?.message || 'No response received.';
          }
        } catch (err: any) {
          if (err.name === 'AbortError') { setIsLoading(false); return; }
          throw err;
        }
      } else if (activeProvider === 'anthropic') {
        // Anthropic streaming
        try {
          const response = await fetch(`${currentProvider.baseUrl}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': currentKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            signal,
            body: JSON.stringify({
              model: selectedModel,
              stream: true,
              max_tokens: 4096,
              system: finalSystemInstruction,
              messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            }),
          });

          if (response.ok && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(line.slice(6));
                    if (json.type === 'content_block_delta') {
                      fullText += json.delta?.text || '';
                      setStreamingText(fullText);
                    }
                  } catch { /* skip */ }
                }
              }
            }
            assistantContent = fullText;
          } else {
            const data = await response.json();
            assistantContent = data.content?.[0]?.text || data.error?.message || 'No response received.';
          }
        } catch (err: any) {
          if (err.name === 'AbortError') { setIsLoading(false); return; }
          throw err;
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent, timestamp: userMessage.timestamp, completedAt: Date.now() }];
      updateSessionMessages(activeSessionId, finalMessages);
    } catch (error: any) {
      const errorMessages = [...newMessages, { role: 'assistant' as const, content: `Error: ${error.message}`, timestamp: userMessage.timestamp, completedAt: Date.now() }];
      updateSessionMessages(activeSessionId, errorMessages);
    }

    setIsLoading(false);
    setStreamingText('');
    pendingAbort = null;
  };

  // ─── Session List View ─────────────────────────────────
  if (showSessionList) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d] flex-shrink-0">
          <h3 className="text-sm font-semibold text-white">Chat History</h3>
          <div className="flex items-center space-x-1">
            <button onClick={startNewSession} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="New Chat">
              <Plus size={16} />
            </button>
            <button onClick={() => setShowSessionList(false)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.sort((a, b) => b.updatedAt - a.updatedAt).map(session => (
            <div 
              key={session.id}
              className={`flex items-center justify-between px-4 py-3 border-b border-[#21262d]/50 cursor-pointer transition-colors ${
                session.id === activeSessionId ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : 'hover:bg-white/5'
              }`}
              onClick={() => { setActiveSessionId(session.id); setShowSessionList(false); }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{session.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {session.messages.length} messages · {new Date(session.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                className="p-1.5 text-gray-600 hover:text-red-400 rounded hover:bg-red-500/10 ml-2 flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── No API key ────────────────────────────────────────
  if (!currentKey && !showSettings) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
          <Sparkles size={24} className="text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Luminous Agent</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-xs">
          Configure an API key to start using AI coding assistance.
        </p>
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20"
        >
          <Key size={16} />
          <span>Configure API Keys</span>
        </button>
      </div>
    );
  }

  // ─── Settings ──────────────────────────────────────────
  if (showSettings) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d]">
          <h3 className="text-sm font-semibold text-white">Luminous Configuration</h3>
          <button onClick={() => setShowSettings(false)} className="p-1 text-gray-500 hover:text-white rounded hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 block">Provider</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => { setActiveProvider(provider.id); setSelectedModel(provider.defaultModel); }}
                  className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${
                    activeProvider === provider.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-medium'
                      : 'bg-[#161b22] text-gray-400 border border-[#30363d] hover:bg-[#21262d] hover:text-white'
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 block">{currentProvider.name} API Key</label>
            <input
              type="password"
              value={currentKey}
              onChange={(e) => updateApiKey(activeProvider, e.target.value)}
              placeholder={currentProvider.placeholder}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2 block">Model</label>
            <input
              type="text"
              list={`models-${activeProvider}`}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none placeholder-gray-600"
              placeholder="Select or type model name..."
            />
            <datalist id={`models-${activeProvider}`}>
              {currentProvider.models.map(model => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[#21262d]">
          <button onClick={() => setShowSettings(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            Save & Close
          </button>
        </div>
      </div>
    );
  }

  // ─── Chat View ─────────────────────────────────────────
  return (
    <div className="flex h-full flex-col relative w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#21262d] flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <button onClick={() => setShowSessionList(true)} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10 flex-shrink-0" title="Chat History">
            <MessageSquare size={14} />
          </button>
          <span className="text-xs text-gray-400 truncate">{activeSession?.title}</span>
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button onClick={startNewSession} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10" title="New Chat">
            <Plus size={14} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-white/10">
            <Key size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="text-center py-8">
            <Sparkles size={24} className="mx-auto mb-3 text-blue-400/50" />
            <p className="text-sm text-gray-500">Tag a file using @ to provide context</p>
            <div className="mt-4 space-y-1.5">
              {['@App.jsx optimize this', 'Fix bugs in @index.css', 'How do I use hooks?'].map(suggestion => (
                <button 
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-xs text-gray-400 bg-[#161b22] rounded-lg hover:bg-[#21262d] hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
            <div className={`max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-md block' 
                : 'bg-[#161b22] text-gray-200 border border-[#21262d] rounded-bl-md w-full overflow-hidden'
            }`}>
              {msg.role === 'assistant' ? renderMessageContent(msg.content, msg) : (
                <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words">{msg.content}</pre>
              )}
            </div>
          </div>
        ))}
        {/* Streaming indicator */}
        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="bg-[#161b22] border border-[#21262d] rounded-2xl rounded-bl-md px-4 py-3 w-full overflow-hidden">
              {streamingText ? (
                <span className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words text-gray-200 block">{streamingText}<span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse" /></span>
              ) : (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mention Menu */}
      {mentionQuery.active && getMentionOptions().length > 0 && (
        <div className="absolute bottom-[4.5rem] left-2 right-2 bg-[#2d2d2d] border border-[#3c3c3c] rounded-xl shadow-2xl py-1 z-50">
          <div className="px-3 py-1.5 border-b border-[#3c3c3c] text-[10px] text-gray-400 uppercase tracking-widest font-semibold font-mono">
            Tag Context Match
          </div>
          <div className="max-h-40 overflow-y-auto">
            {getMentionOptions().map(f => (
              <button 
                key={f.name}
                onClick={() => insertMention(f.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-blue-600/30 hover:text-white transition-colors"
              >
                @{f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center space-x-2 p-3 border-t border-[#21262d] flex-shrink-0 bg-[#1e1e1e] relative z-40">
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
              } else {
                sendMessage();
              }
            }
          }}
          placeholder="Ask Luminous..."
          className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl py-2.5 px-4 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={isLoading ? () => { pendingAbort?.abort(); setIsLoading(false); setStreamingText(''); } : sendMessage}
          disabled={!isLoading && (!input.trim() || !currentKey)}
          className={`p-2.5 ${isLoading ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl transition-colors flex-shrink-0`}
        >
          {isLoading ? <X size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
