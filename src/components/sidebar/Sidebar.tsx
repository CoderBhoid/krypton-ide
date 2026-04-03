import React from 'react';
import { useIdeStore } from '../../store/useIdeStore';
import { FileExplorer } from './FileExplorer';
import { AiAssistant } from './AiAssistant';
import { SettingsPanel } from './SettingsPanel';
import { GitPanel } from './GitPanel';
import { ExtensionsPanel } from './ExtensionsPanel';

export function Sidebar() {
  const sidebarView = useIdeStore((state) => state.sidebarView);

  const titles: Record<string, string> = {
    explorer: 'Explorer',
    git: 'Source Control',
    ai: 'AI Assistant',
    extensions: 'Extensions',
    settings: 'Settings',
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-[#1a1a1a]">
        {titles[sidebarView] || sidebarView}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {sidebarView === 'explorer' && <FileExplorer />}
        {sidebarView === 'git' && <GitPanel />}
        {sidebarView === 'ai' && <AiAssistant />}
        {sidebarView === 'extensions' && <ExtensionsPanel />}
        {sidebarView === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}
