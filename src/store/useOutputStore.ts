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

  addEntry: (text: string, type: OutputEntry['type'], source: OutputEntry['source']) => void;
  clear: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useOutputStore = create<OutputState>()((set) => ({
  entries: [],
  maxEntries: 500,

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

  clear: () => set({ entries: [] }),
}));
