import { create } from 'zustand';

export interface OutputEntry {
  id: string;
  timestamp: number;
  type: 'stdout' | 'stderr' | 'info' | 'system';
  source: 'terminal' | 'runner' | 'git' | 'system';
  text: string;
}

interface OutputState {
  entries: OutputEntry[];
  maxEntries: number;
  consoleLogs: { type: string; args: string; ts: number }[];

  addEntry: (text: string, type: OutputEntry['type'], source: OutputEntry['source']) => void;
  addConsoleLog: (log: { type: string; args: string; ts: number }) => void;
  clear: () => void;
  clearConsoleLogs: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useOutputStore = create<OutputState>()((set) => ({
  entries: [],
  maxEntries: 500,
  consoleLogs: [],

  addEntry: (text, type, source) => {
    const entry: OutputEntry = {
      id: generateId(),
      timestamp: Date.now(),
      type,
      source,
      text,
    };
    set((state) => ({
      entries: [...state.entries.slice(-(state.maxEntries - 1)), entry],
    }));
  },

  addConsoleLog: (log) => {
    set((state) => ({
      consoleLogs: [...state.consoleLogs.slice(-(state.maxEntries - 1)), log],
    }));
  },

  clear: () => set({ entries: [] }),
  clearConsoleLogs: () => set({ consoleLogs: [] }),
}));
