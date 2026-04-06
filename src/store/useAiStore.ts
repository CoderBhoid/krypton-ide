import { create } from 'zustand';
import { ModelAdapters } from '../lib/ai/modelAdapters';
import { 
  CapacitorFilesystemRead, 
  CapacitorFilesystemPatch, 
  CapacitorFilesystemMkdir, 
  CapacitorFilesystemWrite,
  CapacitorFilesystemEditLines,
  CapacitorFilesystemInsertLines
} from '../lib/ai/toolActions';
import {
  readConfig,
  saveConfigDebounced,
  readApiKey,
  saveApiKey,
  readAllSessions,
  saveSessionDebounced,
  saveSession,
  deleteSessionFile,
  type KryptonConfig,
  type SavedModel,
} from '../lib/fileSystemStorage';

export interface AttachedFile {
  name: string;
  type: string; // mimeType
  data: string; // base64
}

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: number;
  completedAt?: number;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
  attachments?: AttachedFile[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface AiState {
  // Session State
  sessions: ChatSession[];
  activeSessionId: string | null;
  currentProjectId: string | null; // sessions are scoped to this project
  isLoading: boolean;
  streamingText: string;
  abortController: AbortController | null;
  
  // Configuration
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  baseUrl: string;
  
  savedModels: SavedModel[];
  activeModelId?: string;
  
  // Actions
  setProvider: (p: string) => void;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
  setBaseUrl: (url: string) => void;
  addSavedModel: (model: SavedModel) => void;
  removeSavedModel: (id: string) => void;
  updateSavedModel: (id: string, updates: Partial<SavedModel>) => void;
  setActiveSavedModel: (id: string) => void;
  
  setActiveSession: (id: string) => void;
  addMessage: (sessionId: string, msg: Message) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  createNewSession: () => string;
  deleteSession: (id: string) => void;
  
  // Load sessions for a specific project
  loadFromDisk: (projectId?: string) => Promise<void>;
  
  // Switch to a different project (clears sessions, loads new ones)
  switchProject: (projectId: string | null) => Promise<void>;
  
  // Clear all session state (when closing a project)
  clearSessions: () => void;
  
  // The Engine
  // The Engine
  sendMessage: (sessionId: string, userPrompt: string, systemContext: string, attachments?: AttachedFile[]) => Promise<void>;
  handleRecursiveChat: (sessionId: string, provider: string, key: string, model: string, baseUrl: string, systemContext: string, startTime: number) => Promise<void>;
  abortChat: () => void;
}

// Helper to persist config changes
async function persistAiConfig(state: AiState) {
  const config = await readConfig();
  if (config) {
    config.ai = {
      ...config.ai,
      provider: state.provider,
      model: state.model,
      activeSessionId: state.activeSessionId,
      savedModels: state.savedModels,
      activeModelId: state.activeModelId,
    };
    saveConfigDebounced(config);
  }
}

export const useAiStore = create<AiState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  currentProjectId: null,
  isLoading: false,
  streamingText: '',
  abortController: null,
  
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  baseUrl: '',
  savedModels: [],
  activeModelId: undefined,

  loadFromDisk: async (projectId?: string) => {
    try {
      // Load config (global)
      const config = await readConfig();
      if (config) {
        set({
          provider: config.ai.provider || 'openai',
          model: config.ai.model || 'gpt-4o',
          savedModels: config.ai.savedModels || [],
          activeModelId: config.ai.activeModelId,
        });
      }

      // Load API key from private storage
      const apiKey = await readApiKey();
      if (apiKey) {
        set({ apiKey });
      }

      // Load sessions scoped to the project
      const pid = projectId || get().currentProjectId;
      if (pid) {
        const sessions = await readAllSessions(pid);
        sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        const activeId = sessions.length > 0 ? sessions[0].id : null;
        set({ sessions, activeSessionId: activeId, currentProjectId: pid });
      }
    } catch (e) {
      console.error('[AI] Failed to load from disk:', e);
    }
  },

  switchProject: async (projectId: string | null) => {
    // Clear existing sessions
    set({ sessions: [], activeSessionId: null, currentProjectId: projectId });
    
    if (projectId) {
      // Load this project's sessions
      const sessions = await readAllSessions(projectId);
      sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const activeId = sessions.length > 0 ? sessions[0].id : null;
      set({ sessions, activeSessionId: activeId });
    }
  },

  clearSessions: () => {
    set({ sessions: [], activeSessionId: null, currentProjectId: null });
  },

  setProvider: (p) => {
    set({ provider: p });
    persistAiConfig(get());
  },
  setApiKey: (apiKey) => {
    set({ apiKey });
    saveApiKey(apiKey).catch(e => console.error('[AI] Save API key error:', e));
  },
  setModel: (m) => {
    set({ model: m });
    persistAiConfig(get());
  },
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  
  addSavedModel: (model) => {
    set(state => ({ savedModels: [...state.savedModels, model] }));
    persistAiConfig(get());
  },
  removeSavedModel: (id) => {
    set(state => {
      const remaining = state.savedModels.filter(m => m.id !== id);
      const nextActiveId = state.activeModelId === id ? undefined : state.activeModelId;
      return { savedModels: remaining, activeModelId: nextActiveId };
    });
    persistAiConfig(get());
  },
  updateSavedModel: (id, updates) => {
    set(state => ({
      savedModels: state.savedModels.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
    persistAiConfig(get());
  },
  setActiveSavedModel: (id) => {
    const saved = get().savedModels.find(m => m.id === id);
    if (saved) {
      set({
        activeModelId: id,
        provider: saved.provider,
        model: saved.model,
        baseUrl: saved.baseUrl || '',
      });
      // Optionally also update apiKey if it carries one, 
      // but apiKey is usually loaded globally, so setting the local state is fine.
      if (saved.apiKey) {
        set({ apiKey: saved.apiKey });
        saveApiKey(saved.apiKey).catch(e => console.error('[AI] Save API key error:', e));
      }
      persistAiConfig(get());
    }
  },
  abortChat: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isLoading: false });
    }
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
    persistAiConfig(get());
  },

  addMessage: (sessionId, msg) => {
    set(state => {
      const newSessions = state.sessions.map(s => 
        s.id === sessionId 
          ? { ...s, messages: [...s.messages, msg], updatedAt: Date.now() } 
          : s
      );
      // Save session to disk (debounced) — scoped to current project
      const updated = newSessions.find(s => s.id === sessionId);
      if (updated) saveSessionDebounced(updated, get().currentProjectId || undefined);
      return { sessions: newSessions };
    });
  },

  updateSession: (sessionId, updates) => {
    set(state => {
      const newSessions = state.sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s);
      const updated = newSessions.find(s => s.id === sessionId);
      if (updated) saveSessionDebounced(updated, get().currentProjectId || undefined);
      return { sessions: newSessions };
    });
  },

  createNewSession: () => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newSession: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    set(state => {
      const newSessions = [newSession, ...state.sessions];
      // Save to disk — scoped to current project
      saveSession(newSession, get().currentProjectId || undefined).catch(e => console.error('[AI] Save new session error:', e));
      return { sessions: newSessions, activeSessionId: id };
    });
    // Persist active session in config
    persistAiConfig(get());
    return id;
  },

  deleteSession: (id) => {
    set(state => {
      const filtered = state.sessions.filter(s => s.id !== id);
      const nextId = state.activeSessionId === id ? (filtered[0]?.id || null) : state.activeSessionId;
      // Delete from disk — scoped to current project
      deleteSessionFile(id, get().currentProjectId || undefined).catch(e => console.error('[AI] Delete session error:', e));
      return { sessions: filtered, activeSessionId: nextId };
    });
  },

  sendMessage: async (sessionId, userPrompt, systemContext, attachments) => {
    const { addMessage, provider, apiKey, model, baseUrl, handleRecursiveChat } = get();
    
    // Add user message
    addMessage(sessionId, { 
      role: 'user', 
      content: userPrompt, 
      timestamp: Date.now(),
      attachments 
    });

    // Safety: If the API key is corrupt (contains ESBuild error), clear it
    if (apiKey && apiKey.includes('Transform failed')) {
      get().setApiKey('');
      addMessage(sessionId, {
        role: 'assistant',
        content: `**System Warning**: I detected that your API key was corrupted by a build error. I have cleared it. Please go to **Settings** and re-enter your API key.`,
        timestamp: Date.now()
      });
      set({ isLoading: false });
      return;
    }

    const startTime = Date.now();
    const abortController = new AbortController();
    set({ isLoading: true, streamingText: '', abortController });

    try {
      await handleRecursiveChat(sessionId, provider, apiKey, model, baseUrl, systemContext, startTime);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        addMessage(sessionId, {
          role: 'assistant',
          content: `> ● Generation canceled`,
          timestamp: Date.now()
        });
      } else {
        addMessage(sessionId, {
          role: 'assistant',
          content: `Error: ${error.message}`,
          timestamp: Date.now()
        });
      }
    } finally {
      set({ isLoading: false, abortController: null, streamingText: '' });
    }
  },

  handleRecursiveChat: async (sessionId, provider, key, model, baseUrl, systemContext, startTime) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (!session) return;

    // 1. Prepare history for provider
    const normalizedHistory = session.messages.map(m => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.tool_call_id,
      name: m.name
    }));

    const providerMessages = ModelAdapters.formatHistoryForProvider(provider, [
      { role: 'system', content: systemContext },
      ...normalizedHistory
    ] as any);

    const tools = ModelAdapters.getToolsForProvider(provider);

    // 2. API Call (Simplified for persistence)
    const geminiModel = model.startsWith('models/') ? model.replace('models/', '') : model;
    const url = provider === 'gemini' 
      ? `${baseUrl}/models/${geminiModel}:streamGenerateContent?alt=sse&key=${key}`
      : `${baseUrl}/chat/completions`;

    const headers: any = { 'Content-Type': 'application/json' };
    if (provider !== 'gemini' && provider !== 'anthropic') headers['Authorization'] = `Bearer ${key}`;
    if (provider === 'anthropic') {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    let body: any = {};
    if (provider === 'gemini') {
      // Maps attachments for Gemini
      body.contents = providerMessages.map((msg: any) => {
        // Find matching original message for attachments
        const ogMatch = session.messages.find(m => m.content === msg.parts[0]?.text);
        if (ogMatch && ogMatch.attachments && ogMatch.attachments.length > 0) {
          const imgParts = ogMatch.attachments.map(att => ({
            inlineData: {
              data: att.data.split(',')[1] || att.data, // remove data:image/png;base64, prefix if present
              mimeType: att.type
            }
          }));
          return {
            ...msg,
            parts: [...msg.parts, ...imgParts]
          };
        }
        return msg;
      });
      body.systemInstruction = { parts: [{ text: systemContext }] };
      body.tools = tools;
    } else {
      // For OpenAI/Anthropic/others: Attachments fall back to base64 texts or are excluded for now depending on adapter
      // Often you'd pass type: 'image_url' for OpenAI. We inject it manually here if attachments exist.
      body = { model, messages: providerMessages.map((msg: any) => {
        const ogMatch = session.messages.find(m => m.content === msg.content);
        if (ogMatch && ogMatch.attachments && ogMatch.attachments.length > 0 && provider === 'openai') {
           const imgContents = ogMatch.attachments.map(att => ({
             type: 'image_url',
             image_url: { url: att.data.includes('base64,') ? att.data : `data:${att.type};base64,${att.data}` }
           }));
           return {
             ...msg,
             content: [ { type: 'text', text: msg.content }, ...imgContents ]
           };
        }
        return msg;
      }), tools: tools, stream: true };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: get().abortController?.signal
    });

    if (!response.ok) {
       const errBody = await response.text();
       let errParsed;
       try { errParsed = JSON.parse(errBody); } catch(e) { errParsed = { message: errBody }; }
       throw new Error(errParsed.error?.message || errParsed.message || `Request failed with status ${response.status}`);
    }

    // STREAMING READER
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let buffer = ''; // Buffer for partial lines
    const toolCallAccumulators: Record<string, { id: string, name: string, arguments: string, isObject: boolean, rawArgs: any }> = {};

    if (!reader) throw new Error('Stream reader not available');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          const partialMessage = ModelAdapters.parseStreamChunk(provider, trimmedLine);
          if (partialMessage) {
            if (partialMessage.content) {
              accumulatedContent += partialMessage.content;
              set({ streamingText: accumulatedContent });
            }
            if (partialMessage.tool_calls) {
              partialMessage.tool_calls.forEach((tc: any, index: number) => {
                const id = tc.id || `tc-${index}`;
                if (!toolCallAccumulators[id]) {
                  toolCallAccumulators[id] = { id, name: '', arguments: '', isObject: false, rawArgs: null };
                }
                if (tc.name) toolCallAccumulators[id].name = tc.name;
                
                if (tc.arguments) {
                  if (typeof tc.arguments === 'object') {
                    toolCallAccumulators[id].isObject = true;
                    toolCallAccumulators[id].rawArgs = tc.arguments;
                  } else {
                    toolCallAccumulators[id].arguments += tc.arguments;
                  }
                }
              });
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Process accumulated tool calls
    const finalToolCalls = Object.values(toolCallAccumulators).map(acc => ({
      id: acc.id,
      name: acc.name,
      arguments: acc.isObject ? acc.rawArgs : (acc.arguments ? JSON.parse(acc.arguments) : {})
    }));

    // Result after stream finishes
    const result: any = {
      role: 'assistant',
      content: accumulatedContent,
      tool_calls: finalToolCalls.length > 0 ? finalToolCalls : undefined
    };

    // 3. Handle Tool Calls
    if (result.tool_calls && result.tool_calls.length > 0) {
      // Append assistant decision
      get().addMessage(sessionId, {
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.tool_calls,
        timestamp: Date.now()
      });

      // Execute tools
      for (const tc of result.tool_calls) {
        let toolOutput = "";
        try {
          if (tc.name === 'read_file') {
            toolOutput = await CapacitorFilesystemRead(tc.arguments.path, tc.arguments.start_line, tc.arguments.end_line);
          } else if (tc.name === 'edit_lines') {
            toolOutput = await CapacitorFilesystemEditLines(tc.arguments.path, tc.arguments.start_line, tc.arguments.end_line, tc.arguments.new_content);
          } else if (tc.name === 'insert_lines') {
            toolOutput = await CapacitorFilesystemInsertLines(tc.arguments.path, tc.arguments.at_line, tc.arguments.content);
          } else if (tc.name === 'patch_file') {
            const success = await CapacitorFilesystemPatch(tc.arguments.path, tc.arguments.search_string, tc.arguments.replace_string);
            toolOutput = success ? "Success: File patched." : "Error: Search string not found. Use read_file to see the current content and try again with exact text.";
          } else if (tc.name === 'create_directory') {
            await CapacitorFilesystemMkdir(tc.arguments.path, { recursive: true });
            toolOutput = `Success: Directory created at ${tc.arguments.path}`;
          } else if (tc.name === 'write_new_file') {
            await CapacitorFilesystemWrite(tc.arguments.path, tc.arguments.content);
            toolOutput = `Success: File created at ${tc.arguments.path}`;
          }
        } catch (e: any) {
          toolOutput = `Local execution error: ${e.message}`;
        }

        get().addMessage(sessionId, {
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          content: toolOutput,
          timestamp: Date.now()
        });
      }

      // 4. Recurse
      await get().handleRecursiveChat(sessionId, provider, key, model, baseUrl, systemContext, startTime);
    } else {
      // Final message
      get().addMessage(sessionId, {
        role: 'assistant',
        content: result.content || '',
        timestamp: startTime,
        completedAt: Date.now()
      });
    }
    set({ streamingText: '' });
  }
}));
