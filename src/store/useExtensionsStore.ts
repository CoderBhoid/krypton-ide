import { create } from 'zustand';
import { readExtensions, saveExtensionsDebounced } from '../lib/fileSystemStorage';

export interface Extension {
  id: string;
  name: string;
  publisher: string;
  description: string;
  icon: string; // emoji or icon identifier
  category: 'theme' | 'language' | 'formatter' | 'productivity' | 'snippet';
  installed: boolean;
  downloads?: string;
  rating?: number;
  // For themes
  themeData?: Record<string, string>;
  monacoThemeId?: string;
}

interface ExtensionsState {
  installedExtensions: string[];
  // Theme extensions actually change monaco theme
  activeThemeExtension: string | null;
  
  installExtension: (id: string) => void;
  uninstallExtension: (id: string) => void;
  setActiveThemeExtension: (id: string | null) => void;
  isInstalled: (id: string) => boolean;
  loadFromDisk: () => Promise<void>;
}

// Curated extensions catalog
export const EXTENSIONS_CATALOG: Extension[] = [
  // ── Themes ──────────────────────────────────────────
  {
    id: 'theme-one-dark-pro',
    name: 'One Dark Pro',
    publisher: 'binaryify',
    description: 'Atom\'s iconic One Dark theme for VS Code',
    icon: '🎨',
    category: 'theme',
    installed: false,
    downloads: '18.2M',
    rating: 4.8,
    monacoThemeId: 'one-dark-pro',
  },
  {
    id: 'theme-dracula',
    name: 'Dracula Official',
    publisher: 'dracula-theme',
    description: 'Dark theme for many editors, shells, and more',
    icon: '🧛',
    category: 'theme',
    installed: false,
    downloads: '12.5M',
    rating: 4.7,
    monacoThemeId: 'dracula',
  },
  {
    id: 'theme-github-dark',
    name: 'GitHub Dark',
    publisher: 'github',
    description: 'GitHub\'s official dark theme',
    icon: '🐙',
    category: 'theme',
    installed: false,
    downloads: '9.8M',
    rating: 4.9,
    monacoThemeId: 'github-dark',
  },
  {
    id: 'theme-monokai-pro',
    name: 'Monokai Pro',
    publisher: 'monokai',
    description: 'Professional theme with beautiful colors',
    icon: '🌈',
    category: 'theme',
    installed: false,
    downloads: '7.3M',
    rating: 4.6,
    monacoThemeId: 'monokai',
  },
  {
    id: 'theme-nord',
    name: 'Nord',
    publisher: 'arcticicestudio',
    description: 'An arctic, north-bluish clean and elegant theme',
    icon: '❄️',
    category: 'theme',
    installed: false,
    downloads: '5.1M',
    rating: 4.7,
    monacoThemeId: 'nord',
  },
  {
    id: 'theme-catppuccin',
    name: 'Catppuccin',
    publisher: 'catppuccin',
    description: 'Soothing pastel theme for your editor',
    icon: '🐱',
    category: 'theme',
    installed: false,
    downloads: '3.2M',
    rating: 4.9,
    monacoThemeId: 'catppuccin',
  },

  // ── Languages ──────────────────────────────────────
  {
    id: 'lang-python',
    name: 'Python',
    publisher: 'ms-python',
    description: 'Python language support with IntelliSense',
    icon: '🐍',
    category: 'language',
    installed: false,
    downloads: '98.2M',
    rating: 4.8,
  },
  {
    id: 'lang-go',
    name: 'Go',
    publisher: 'golang',
    description: 'Rich Go language support',
    icon: '🔵',
    category: 'language',
    installed: false,
    downloads: '14.8M',
    rating: 4.7,
  },
  {
    id: 'lang-rust',
    name: 'rust-analyzer',
    publisher: 'rust-lang',
    description: 'Rust language support via rust-analyzer',
    icon: '🦀',
    category: 'language',
    installed: false,
    downloads: '8.1M',
    rating: 4.9,
  },
  {
    id: 'lang-cpp',
    name: 'C/C++',
    publisher: 'ms-vscode',
    description: 'C/C++ IntelliSense, debugging, and browsing',
    icon: '⚙️',
    category: 'language',
    installed: false,
    downloads: '52.3M',
    rating: 4.5,
  },
  {
    id: 'lang-java',
    name: 'Java Extension Pack',
    publisher: 'vscjava',
    description: 'Popular extensions for Java development',
    icon: '☕',
    category: 'language',
    installed: false,
    downloads: '22.1M',
    rating: 4.6,
  },
  {
    id: 'lang-dart',
    name: 'Dart',
    publisher: 'dart-code',
    description: 'Dart language support and debugging',
    icon: '🎯',
    category: 'language',
    installed: false,
    downloads: '8.4M',
    rating: 4.8,
  },

  // ── Productivity ──────────────────────────────────
  {
    id: 'prod-bracket-colorizer',
    name: 'Bracket Pair Colorizer',
    publisher: 'CoenraadS',
    description: 'Colorize matching brackets in your code',
    icon: '🌈',
    category: 'productivity',
    installed: false,
    downloads: '15.4M',
    rating: 4.5,
  },
  {
    id: 'prod-auto-rename-tag',
    name: 'Auto Rename Tag',
    publisher: 'formulahendry',
    description: 'Automatically rename paired HTML tags',
    icon: '🔄',
    category: 'productivity',
    installed: false,
    downloads: '14.2M',
    rating: 4.3,
  },
  {
    id: 'prod-path-intellisense',
    name: 'Path Intellisense',
    publisher: 'christian-kohler',
    description: 'Autocomplete filenames in your code',
    icon: '📁',
    category: 'productivity',
    installed: false,
    downloads: '11.8M',
    rating: 4.4,
  },
  {
    id: 'prod-todo-highlight',
    name: 'TODO Highlight',
    publisher: 'wayou',
    description: 'Highlight TODOs, FIXMEs, and other annotations',
    icon: '📝',
    category: 'productivity',
    installed: false,
    downloads: '7.9M',
    rating: 4.5,
  },
  {
    id: 'prod-indent-rainbow',
    name: 'Indent Rainbow',
    publisher: 'oderwat',
    description: 'Colorize indentation with alternating colors',
    icon: '🌈',
    category: 'productivity',
    installed: false,
    downloads: '10.2M',
    rating: 4.6,
  },

  // ── Formatters ──────────────────────────────────
  {
    id: 'fmt-prettier',
    name: 'Prettier',
    publisher: 'esbenp',
    description: 'Code formatter using Prettier',
    icon: '✨',
    category: 'formatter',
    installed: false,
    downloads: '41.2M',
    rating: 4.3,
  },
  {
    id: 'fmt-eslint',
    name: 'ESLint',
    publisher: 'dbaeumer',
    description: 'Integrates ESLint into your editor',
    icon: '🔍',
    category: 'formatter',
    installed: false,
    downloads: '32.8M',
    rating: 4.4,
  },

  // ── Snippets ──────────────────────────────────
  {
    id: 'snip-es7-react',
    name: 'ES7+ React Snippets',
    publisher: 'dsznajder',
    description: 'React/Redux/GraphQL snippets',
    icon: '⚛️',
    category: 'snippet',
    installed: false,
    downloads: '9.7M',
    rating: 4.6,
  },
  {
    id: 'snip-html-css',
    name: 'HTML CSS Support',
    publisher: 'ecmel',
    description: 'CSS class and ID completion for HTML',
    icon: '📄',
    category: 'snippet',
    installed: false,
    downloads: '14.3M',
    rating: 4.4,
  },
];

// Theme definitions for Monaco
export const MONACO_THEMES: Record<string, any> = {
  'one-dark-pro': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'type', foreground: 'e5c07b' },
      { token: 'function', foreground: '61afef' },
      { token: 'variable', foreground: 'e06c75' },
      { token: 'tag', foreground: 'e06c75' },
      { token: 'attribute.name', foreground: 'd19a66' },
      { token: 'attribute.value', foreground: '98c379' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editorCursor.foreground': '#528bff',
      'editor.lineHighlightBackground': '#2c313c',
      'editorLineNumber.foreground': '#495162',
      'editor.selectionBackground': '#3e4451',
      'editorIndentGuide.background': '#3b4048',
    },
  },
  'dracula': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'type', foreground: '8be9fd', fontStyle: 'italic' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'tag', foreground: 'ff79c6' },
      { token: 'attribute.name', foreground: '50fa7b' },
      { token: 'attribute.value', foreground: 'f1fa8c' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f0',
      'editor.lineHighlightBackground': '#44475a',
      'editorLineNumber.foreground': '#6272a4',
      'editor.selectionBackground': '#44475a',
    },
  },
  'github-dark': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'variable', foreground: 'ffa657' },
      { token: 'tag', foreground: '7ee787' },
      { token: 'attribute.name', foreground: '79c0ff' },
      { token: 'attribute.value', foreground: 'a5d6ff' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#c9d1d9',
      'editorCursor.foreground': '#58a6ff',
      'editor.lineHighlightBackground': '#161b22',
      'editorLineNumber.foreground': '#484f58',
      'editor.selectionBackground': '#264f78',
    },
  },
  'monokai': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'type', foreground: '66d9ef', fontStyle: 'italic' },
      { token: 'function', foreground: 'a6e22e' },
      { token: 'variable', foreground: 'f8f8f2' },
      { token: 'tag', foreground: 'f92672' },
      { token: 'attribute.name', foreground: 'a6e22e' },
      { token: 'attribute.value', foreground: 'e6db74' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f0',
      'editor.lineHighlightBackground': '#3e3d32',
      'editorLineNumber.foreground': '#75715e',
      'editor.selectionBackground': '#49483e',
    },
  },
  'nord': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'keyword', foreground: '81a1c1' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'function', foreground: '88c0d0' },
      { token: 'variable', foreground: 'd8dee9' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editorCursor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editorLineNumber.foreground': '#4c566a',
      'editor.selectionBackground': '#434c5e',
    },
  },
  'catppuccin': {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'cba6f7' },
      { token: 'string', foreground: 'a6e3a1' },
      { token: 'number', foreground: 'fab387' },
      { token: 'type', foreground: 'f9e2af' },
      { token: 'function', foreground: '89b4fa' },
      { token: 'variable', foreground: 'cdd6f4' },
    ],
    colors: {
      'editor.background': '#1e1e2e',
      'editor.foreground': '#cdd6f4',
      'editorCursor.foreground': '#f5e0dc',
      'editor.lineHighlightBackground': '#313244',
      'editorLineNumber.foreground': '#585b70',
      'editor.selectionBackground': '#45475a',
    },
  },
};

function persistExtensions(state: ExtensionsState) {
  saveExtensionsDebounced({
    installedExtensions: state.installedExtensions,
    activeThemeExtension: state.activeThemeExtension,
  });
}

export const useExtensionsStore = create<ExtensionsState>()(
  (set, get) => ({
    installedExtensions: [],
    activeThemeExtension: null,

    loadFromDisk: async () => {
      try {
        const data = await readExtensions();
        if (data) {
          set({
            installedExtensions: data.installedExtensions || [],
            activeThemeExtension: data.activeThemeExtension || null,
          });
        }
      } catch (e) {
        console.error('[Extensions] Failed to load from disk:', e);
      }
    },

    installExtension: (id) => {
      set((state) => {
        const updated = {
          ...state,
          installedExtensions: [...new Set([...state.installedExtensions, id])],
        };
        persistExtensions(updated);
        return { installedExtensions: updated.installedExtensions };
      });
    },

    uninstallExtension: (id) => {
      set((state) => {
        const updated = {
          ...state,
          installedExtensions: state.installedExtensions.filter(e => e !== id),
          activeThemeExtension: state.activeThemeExtension === id ? null : state.activeThemeExtension,
        };
        persistExtensions(updated);
        return {
          installedExtensions: updated.installedExtensions,
          activeThemeExtension: updated.activeThemeExtension,
        };
      });
    },

    setActiveThemeExtension: (id) => {
      set({ activeThemeExtension: id });
      persistExtensions(get());
    },

    isInstalled: (id) => {
      return get().installedExtensions.includes(id);
    },
  })
);
