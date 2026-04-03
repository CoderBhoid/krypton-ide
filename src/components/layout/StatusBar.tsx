import React from 'react';
import { useIdeStore, getLanguageFromFilename } from '../../store/useIdeStore';

export function StatusBar() {
  const { cursorPosition, activeFileId, files, theme } = useIdeStore();
  const activeFile = activeFileId ? files[activeFileId] : null;

  const language = activeFile ? (activeFile.language || getLanguageFromFilename(activeFile.name)) : '';
  const displayLang = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="flex h-6 items-center bg-[#007acc] px-3 text-[11px] text-white select-none justify-between">
      <div className="flex space-x-3 items-center">
        <span className="cursor-pointer hover:bg-white/20 px-1.5 py-0.5 rounded flex items-center space-x-1">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" clipRule="evenodd" d="M11.5 2.75L10.25 4l1.25 1.25L10.25 6.5 11.5 7.75 12.75 6.5 14 7.75 15.25 6.5 14 5.25 15.25 4 14 2.75 12.75 4 11.5 2.75zM6.5 4L5.25 5.25 4 4 2.75 5.25 4 6.5 2.75 7.75 4 9l1.25-1.25L6.5 9 7.75 7.75 6.5 6.5 7.75 5.25 6.5 4z"/></svg>
          <span>main*</span>
        </span>
      </div>
      <div className="flex space-x-3 items-center">
        {activeFile && (
          <>
            <span className="cursor-pointer hover:bg-white/20 px-1.5 py-0.5 rounded">
              Ln {cursorPosition.line}, Col {cursorPosition.col}
            </span>
            <span className="cursor-pointer hover:bg-white/20 px-1.5 py-0.5 rounded">Spaces: 2</span>
            <span className="cursor-pointer hover:bg-white/20 px-1.5 py-0.5 rounded">UTF-8</span>
            <span className="cursor-pointer hover:bg-white/20 px-1.5 py-0.5 rounded">{displayLang}</span>
          </>
        )}
      </div>
    </div>
  );
}
