import { create } from 'zustand';

export type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId: string | null;
  children?: string[];
  isOpen?: boolean;
  isUnsaved?: boolean;
  language?: string;
};

interface CursorPosition {
  line: number;
  col: number;
}

interface IdeState {
  files: Record<string, FileNode>;
  activeFileId: string | null;
  openFiles: string[];
  sidebarView: 'explorer' | 'search' | 'git' | 'ai' | 'extensions' | 'settings';
  isSidebarOpen: boolean;
  theme: 'vs-dark' | 'light' | 'hc-black';
  cursorPosition: CursorPosition;
  isPreviewOpen: boolean;
  isCommandPaletteOpen: boolean;
  isFullscreen: boolean;
  
  // Actions
  createFile: (name: string, parentId: string | null, type: 'file' | 'folder', content?: string) => string;
  updateFileContent: (id: string, content: string) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string | null) => void;
  setSidebarView: (view: 'explorer' | 'search' | 'git' | 'ai' | 'extensions' | 'settings') => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'vs-dark' | 'light' | 'hc-black') => void;
  setCursorPosition: (pos: CursorPosition) => void;
  setPreviewOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setFullscreen: (val: boolean) => void;
  
  // Save
  saveFile: (id: string) => void;
  saveAllFiles: () => void;
  
  // Project
  loadProject: (files: Record<string, FileNode>) => void;
  
  // File system helpers (for shell engine)
  getFileByPath: (pathSegments: string[]) => FileNode | null;
  getChildrenOf: (id: string) => FileNode[];
  moveFile: (id: string, newParentId: string, newName?: string) => void;
  copyFile: (id: string, newParentId: string, newName?: string) => string;
  getFilePath: (id: string) => string[];
}

export const getLanguageFromFilename = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'html': case 'htm': return 'html';
    case 'css': case 'scss': case 'less': return 'css';
    case 'json': return 'json';
    case 'md': case 'markdown': return 'markdown';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'java': return 'java';
    case 'kt': case 'kts': return 'kotlin';
    case 'cpp': case 'c': case 'h': case 'hpp': return 'cpp';
    case 'xml': case 'svg': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'sh': case 'bash': return 'shell';
    case 'sql': return 'sql';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    case 'swift': return 'swift';
    case 'dart': return 'dart';
    default: return 'plaintext';
  }
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useIdeStore = create<IdeState>()(
  (set, get) => ({
    files: {},
    activeFileId: null,
    openFiles: [],
    sidebarView: 'explorer',
    isSidebarOpen: false,
    theme: 'vs-dark',
    cursorPosition: { line: 1, col: 1 },
    isPreviewOpen: false,
    isCommandPaletteOpen: false,
    isFullscreen: localStorage.getItem('krypton-fullscreen') === 'true',

    createFile: (name, parentId, type, content = '') => {
      const id = generateId();
      const language = getLanguageFromFilename(name);

      const newNode: FileNode = {
        id,
        name,
        type,
        content: type === 'file' ? content : undefined,
        parentId,
        children: type === 'folder' ? [] : undefined,
        language,
      };

      set((state) => {
        const newFiles = { ...state.files, [id]: newNode };
        if (parentId && newFiles[parentId]) {
          newFiles[parentId] = {
            ...newFiles[parentId],
            children: [...(newFiles[parentId].children || []), id],
          };
        }
        return { files: newFiles };
      });

      return id;
    },

    updateFileContent: (id, content) => {
      set((state) => ({
        files: {
          ...state.files,
          [id]: { ...state.files[id], content, isUnsaved: true },
        },
      }));
    },

    deleteFile: (id) => {
      set((state) => {
        const newFiles = { ...state.files };
        const fileToDelete = newFiles[id];
        
        const deleteRecursively = (nodeId: string) => {
          const node = newFiles[nodeId];
          if (node?.children) {
            node.children.forEach(deleteRecursively);
          }
          delete newFiles[nodeId];
        };

        if (fileToDelete?.parentId && newFiles[fileToDelete.parentId]) {
          newFiles[fileToDelete.parentId] = {
            ...newFiles[fileToDelete.parentId],
            children: newFiles[fileToDelete.parentId].children?.filter(childId => childId !== id),
          };
        }

        deleteRecursively(id);

        const newOpenFiles = state.openFiles.filter(openId => newFiles[openId]);
        const newActiveFileId = state.activeFileId === id ? (newOpenFiles[0] || null) : state.activeFileId;

        return {
          files: newFiles,
          openFiles: newOpenFiles,
          activeFileId: newActiveFileId,
        };
      });
    },

    renameFile: (id, newName) => {
      const language = getLanguageFromFilename(newName);
      set((state) => ({
        files: {
          ...state.files,
          [id]: { ...state.files[id], name: newName, language },
        },
      }));
    },

    openFile: (id) => {
      set((state) => {
        const file = state.files[id];
        if (!file || file.type === 'folder') return state;

        if (!state.openFiles.includes(id)) {
          return {
            openFiles: [...state.openFiles, id],
            activeFileId: id,
          };
        }
        return { activeFileId: id };
      });
    },

    closeFile: (id) => {
      set((state) => {
        const newOpenFiles = state.openFiles.filter((fileId) => fileId !== id);
        let newActiveFileId = state.activeFileId;
        
        if (state.activeFileId === id) {
          const closedIndex = state.openFiles.indexOf(id);
          if (newOpenFiles.length > 0) {
            newActiveFileId = newOpenFiles[Math.min(closedIndex, newOpenFiles.length - 1)];
          } else {
            newActiveFileId = null;
          }
        }

        return {
          openFiles: newOpenFiles,
          activeFileId: newActiveFileId,
        };
      });
    },

    setActiveFile: (id) => set({ activeFileId: id }),
    
    setSidebarView: (view) => {
      set((state) => {
        // If clicking the same view that's already open, close the sidebar
        if (state.sidebarView === view && state.isSidebarOpen) {
          return { isSidebarOpen: false };
        }
        return { sidebarView: view, isSidebarOpen: true };
      });
    },
    
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setTheme: (theme) => set({ theme }),
    setCursorPosition: (pos) => set({ cursorPosition: pos }),
    setPreviewOpen: (open) => set({ isPreviewOpen: open }),
    setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

    setFullscreen: (val) => {
      localStorage.setItem('krypton-fullscreen', String(val));
      set({ isFullscreen: val });
    },

    saveFile: (id) => {
      set((state) => ({
        files: {
          ...state.files,
          [id]: { ...state.files[id], isUnsaved: false },
        },
      }));
    },

    saveAllFiles: () => {
      set((state) => {
        const newFiles = { ...state.files };
        for (const key of Object.keys(newFiles)) {
          if (newFiles[key].isUnsaved) {
            newFiles[key] = { ...newFiles[key], isUnsaved: false };
          }
        }
        return { files: newFiles };
      });
    },

    loadProject: (files) => set({ files, openFiles: [], activeFileId: null, cursorPosition: { line: 1, col: 1 } }),

    getFileByPath: (pathSegments: string[]) => {
      const { files } = get();
      if (pathSegments.length === 0) return files['root'] || null;
      
      let current = files['root'];
      if (!current) return null;

      for (const segment of pathSegments) {
        if (segment === '.' || segment === '') continue;
        if (!current.children) return null;
        
        const childId = current.children.find(cid => {
          const child = files[cid];
          return child && child.name === segment;
        });
        
        if (!childId) return null;
        current = files[childId];
      }
      return current;
    },

    getChildrenOf: (id: string) => {
      const { files } = get();
      const node = files[id];
      if (!node?.children) return [];
      return node.children.map(cid => files[cid]).filter(Boolean);
    },

    moveFile: (id: string, newParentId: string, newName?: string) => {
      set((state) => {
        const newFiles = { ...state.files };
        const file = newFiles[id];
        if (!file) return state;

        // Remove from old parent
        if (file.parentId && newFiles[file.parentId]) {
          newFiles[file.parentId] = {
            ...newFiles[file.parentId],
            children: newFiles[file.parentId].children?.filter(cid => cid !== id),
          };
        }

        // Add to new parent
        if (newFiles[newParentId]) {
          newFiles[newParentId] = {
            ...newFiles[newParentId],
            children: [...(newFiles[newParentId].children || []), id],
          };
        }

        // Update file
        const language = newName ? getLanguageFromFilename(newName) : file.language;
        newFiles[id] = {
          ...file,
          parentId: newParentId,
          ...(newName ? { name: newName, language } : {}),
        };

        return { files: newFiles };
      });
    },

    copyFile: (id: string, newParentId: string, newName?: string) => {
      const { files } = get();
      const original = files[id];
      if (!original) return '';

      const copyId = generateId();
      const name = newName || original.name;
      const language = getLanguageFromFilename(name);

      const copy: FileNode = {
        id: copyId,
        name,
        type: original.type,
        content: original.content,
        parentId: newParentId,
        children: original.type === 'folder' ? [] : undefined,
        language,
      };

      set((state) => {
        const newFiles = { ...state.files, [copyId]: copy };
        if (newFiles[newParentId]) {
          newFiles[newParentId] = {
            ...newFiles[newParentId],
            children: [...(newFiles[newParentId].children || []), copyId],
          };
        }
        return { files: newFiles };
      });

      return copyId;
    },

    getFilePath: (id: string) => {
      const { files } = get();
      const segments: string[] = [];
      let current = files[id];
      while (current && current.id !== 'root') {
        segments.unshift(current.name);
        current = current.parentId ? files[current.parentId] : undefined as any;
      }
      return segments;
    },
  })
);
