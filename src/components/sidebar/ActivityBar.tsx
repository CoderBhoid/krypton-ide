import React from 'react';
import { Files, Search, GitBranch, Bot, Settings, Puzzle } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import { cn } from '../../lib/utils';

export function ActivityBar() {
  const { sidebarView, setSidebarView, isSidebarOpen, toggleSidebar } = useIdeStore();

  const handleIconClick = (view: 'explorer' | 'search' | 'git' | 'ai' | 'extensions' | 'settings') => {
    if (sidebarView === view && isSidebarOpen) {
      toggleSidebar();
    } else {
      setSidebarView(view);
    }
  };

  const IconWrapper = ({ view, icon: Icon, title }: { view: string, icon: any, title: string }) => {
    const isActive = sidebarView === view && isSidebarOpen;
    return (
      <div 
        className={cn(
          "flex h-12 w-12 cursor-pointer items-center justify-center text-gray-500 hover:text-white relative transition-colors",
          isActive && "text-white"
        )}
        onClick={() => handleIconClick(view as any)}
        title={title}
      >
        {isActive && (
          <div className="absolute left-0 top-0 h-full w-[2px] bg-white" />
        )}
        <Icon size={22} strokeWidth={1.5} />
      </div>
    );
  };

  return (
    <div className="flex w-12 flex-col items-center bg-[#252526] border-r border-[#1a1a1a] py-2 flex-shrink-0">
      <IconWrapper view="explorer" icon={Files} title="Explorer" />
      <IconWrapper view="search" icon={Search} title="Search" />
      <IconWrapper view="git" icon={GitBranch} title="Source Control" />
      <IconWrapper view="ai" icon={Bot} title="AI Assistant" />
      <IconWrapper view="extensions" icon={Puzzle} title="Extensions" />
      
      <div className="mt-auto">
        <IconWrapper view="settings" icon={Settings} title="Settings" />
      </div>
    </div>
  );
}
