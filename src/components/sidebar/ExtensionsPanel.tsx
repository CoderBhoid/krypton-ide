import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Trash2, Check, Star, Palette, Code2, Sparkles, Puzzle, FileCode2 } from 'lucide-react';
import { useExtensionsStore, EXTENSIONS_CATALOG, MONACO_THEMES, type Extension } from '../../store/useExtensionsStore';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: <Sparkles size={14} /> },
  { id: 'theme', label: 'Themes', icon: <Palette size={14} /> },
  { id: 'language', label: 'Languages', icon: <Code2 size={14} /> },
  { id: 'productivity', label: 'Tools', icon: <Puzzle size={14} /> },
  { id: 'formatter', label: 'Formatters', icon: <FileCode2 size={14} /> },
  { id: 'snippet', label: 'Snippets', icon: <Code2 size={14} /> },
] as const;

export function ExtensionsPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { installedExtensions, installExtension, uninstallExtension, activeThemeExtension, setActiveThemeExtension } = useExtensionsStore();

  const filteredExtensions = useMemo(() => {
    return EXTENSIONS_CATALOG.filter(ext => {
      const matchesCategory = activeCategory === 'all' || ext.category === activeCategory;
      const matchesSearch = !searchQuery.trim() || 
        ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.publisher.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  // Restore active theme on mount
  useEffect(() => {
    if (activeThemeExtension) {
      const ext = EXTENSIONS_CATALOG.find(e => e.id === activeThemeExtension);
      if (ext?.monacoThemeId) {
        const themeData = MONACO_THEMES[ext.monacoThemeId];
        if (themeData) {
          // Wait for Monaco to be ready
          const timer = setInterval(() => {
            const monaco = (window as any).monaco;
            if (monaco) {
              clearInterval(timer);
              monaco.editor.defineTheme(ext.monacoThemeId!, themeData);
              monaco.editor.setTheme(ext.monacoThemeId!);
              // Apply CSS vars
              const bg = themeData.colors?.['editor.background'] || '#1e1e1e';
              const fg = themeData.colors?.['editor.foreground'] || '#cccccc';
              const lh = themeData.colors?.['editor.lineHighlightBackground'] || '#2c2c2c';
              const lighten = (hex: string, a: number) => {
                const n = parseInt(hex.replace('#', ''), 16);
                const r = Math.min(255, (n >> 16) + a), g = Math.min(255, ((n >> 8) & 0xff) + a), b = Math.min(255, (n & 0xff) + a);
                return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
              };
              const root = document.documentElement;
              root.style.setProperty('--ide-bg', bg);
              root.style.setProperty('--ide-fg', fg);
              root.style.setProperty('--ide-sidebar', lighten(bg, 8));
              root.style.setProperty('--ide-topbar', lighten(bg, 12));
              root.style.setProperty('--ide-border', lighten(bg, 20));
              root.style.setProperty('--ide-active', lh);
            }
          }, 200);
          return () => clearInterval(timer);
        }
      }
    }
  }, []);

  const handleInstall = (ext: Extension) => {
    installExtension(ext.id);
    
    // If it's a theme, activate it and define it in Monaco
    if (ext.category === 'theme' && ext.monacoThemeId) {
      applyTheme(ext);
    }
  };

  const handleUninstall = (ext: Extension) => {
    uninstallExtension(ext.id);
    if (ext.id === activeThemeExtension) {
      setActiveThemeExtension(null);
    }
  };

  const applyTheme = (ext: Extension) => {
    if (!ext.monacoThemeId) return;
    
    const themeData = MONACO_THEMES[ext.monacoThemeId];
    if (!themeData) return;

    // Register and apply Monaco theme
    const monaco = (window as any).monaco;
    if (monaco) {
      monaco.editor.defineTheme(ext.monacoThemeId, themeData);
      monaco.editor.setTheme(ext.monacoThemeId);
    }

    // Apply globally — update entire IDE shell colors
    const bg = themeData.colors?.['editor.background'] || '#1e1e1e';
    const fg = themeData.colors?.['editor.foreground'] || '#cccccc';
    const lineHighlight = themeData.colors?.['editor.lineHighlightBackground'] || '#2c2c2c';

    // Compute slightly adjusted shades from the theme background
    const darken = (hex: string, amount: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0xff) - amount);
      const b = Math.max(0, (num & 0xff) - amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    };
    const lighten = (hex: string, amount: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0xff) + amount);
      const b = Math.min(255, (num & 0xff) + amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    };

    const root = document.documentElement;
    root.style.setProperty('--ide-bg', bg);
    root.style.setProperty('--ide-fg', fg);
    root.style.setProperty('--ide-sidebar', lighten(bg, 8));
    root.style.setProperty('--ide-topbar', lighten(bg, 12));
    root.style.setProperty('--ide-border', lighten(bg, 20));
    root.style.setProperty('--ide-active', lineHighlight);

    setActiveThemeExtension(ext.id);
  };

  const isInstalled = (id: string) => installedExtensions.includes(id);

  return (
    <div className="flex h-full flex-col text-sm">
      {/* Search */}
      <div className="p-3 border-b border-[#21262d]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search extensions..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-[#21262d] px-2 py-1.5 space-x-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 active:bg-white/10'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Extensions List */}
      <div className="flex-1 overflow-y-auto pb-4">
        {filteredExtensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Puzzle size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No extensions found</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {filteredExtensions.map(ext => {
              const installed = isInstalled(ext.id);
              const isActiveTheme = ext.id === activeThemeExtension;
              
              return (
                <div 
                  key={ext.id} 
                  className={`p-3 rounded-xl border transition-all ${
                    installed
                      ? 'bg-blue-600/5 border-blue-500/20'
                      : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-[#21262d]'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="text-2xl flex-shrink-0 mt-0.5">{ext.icon}</div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white text-sm truncate">{ext.name}</span>
                        {installed && (
                          <span className="flex-shrink-0">
                            <Check size={14} className="text-green-400" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{ext.publisher}</div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{ext.description}</p>
                      
                      {/* Meta */}
                      <div className="flex items-center space-x-3 mt-2">
                        {ext.downloads && (
                          <span className="flex items-center space-x-1 text-[11px] text-gray-600">
                            <Download size={10} />
                            <span>{ext.downloads}</span>
                          </span>
                        )}
                        {ext.rating && (
                          <span className="flex items-center space-x-1 text-[11px] text-gray-600">
                            <Star size={10} fill="currentColor" />
                            <span>{ext.rating}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-gray-700 bg-gray-800/50 px-1.5 py-0.5 rounded">
                          {ext.category}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex-shrink-0">
                      {installed ? (
                        <div className="flex flex-col space-y-1">
                          {ext.category === 'theme' && !isActiveTheme && (
                            <button
                              onClick={() => applyTheme(ext)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors active:scale-95"
                            >
                              Apply
                            </button>
                          )}
                          {isActiveTheme && (
                            <span className="px-3 py-1.5 bg-green-600/20 text-green-400 text-xs rounded-lg font-medium text-center">
                              Active
                            </span>
                          )}
                          <button
                            onClick={() => handleUninstall(ext)}
                            className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors self-center"
                            title="Uninstall"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleInstall(ext)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                        >
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#21262d] px-3 py-2">
        <p className="text-[10px] text-gray-600 text-center">
          {installedExtensions.length} installed • Themes apply to Monaco Editor
        </p>
      </div>
    </div>
  );
}
