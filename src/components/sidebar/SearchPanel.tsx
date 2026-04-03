import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, ChevronDown, FileText, Replace, CaseSensitive, Regex, X } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';

export function SearchPanel() {
  const { files, openFile, updateFileContent } = useIdeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const resultList: { fileId: string; matches: { line: number; content: string }[] }[] = [];

    Object.values(files).forEach(file => {
      if (file.type === 'file' && file.content) {
        const lines = file.content.split('\n');
        const matches: { line: number; content: string }[] = [];
        
        lines.forEach((line, index) => {
          let found = false;
          if (useRegex) {
            try {
              const regex = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
              found = regex.test(line);
            } catch { found = false; }
          } else {
            found = caseSensitive 
              ? line.includes(searchQuery) 
              : line.toLowerCase().includes(searchQuery.toLowerCase());
          }
          
          if (found) {
            matches.push({ line: index + 1, content: line.trim() });
          }
        });

        if (matches.length > 0) {
          resultList.push({ fileId: file.id, matches });
        }
      }
    });

    return resultList;
  }, [searchQuery, files, caseSensitive, useRegex]);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedResults(newExpanded);
  };

  const handleReplaceInFile = (fileId: string) => {
    const file = files[fileId];
    if (!file?.content) return;
    
    let newContent: string;
    if (useRegex) {
      try {
        const regex = new RegExp(searchQuery, caseSensitive ? 'g' : 'gi');
        newContent = file.content.replace(regex, replaceQuery);
      } catch { return; }
    } else {
      if (caseSensitive) {
        newContent = file.content.split(searchQuery).join(replaceQuery);
      } else {
        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        newContent = file.content.replace(regex, replaceQuery);
      }
    }
    
    updateFileContent(fileId, newContent);
  };

  const handleReplaceAll = () => {
    results.forEach(result => handleReplaceInFile(result.fileId));
  };

  return (
    <div className="flex h-full flex-col p-2">
      <div className="mb-3 px-2 space-y-2">
        {/* Search Input */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] py-2 pl-3 pr-20 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="absolute right-1 flex items-center space-x-0.5">
            <button 
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`p-1 rounded text-xs ${caseSensitive ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`} 
              title="Case Sensitive"
            >
              <CaseSensitive size={14} />
            </button>
            <button 
              onClick={() => setUseRegex(!useRegex)}
              className={`p-1 rounded text-xs ${useRegex ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`} 
              title="Use Regex"
            >
              <Regex size={14} />
            </button>
            <button 
              onClick={() => setShowReplace(!showReplace)}
              className={`p-1 rounded ${showReplace ? 'text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
              title="Toggle Replace"
            >
              <Replace size={14} />
            </button>
          </div>
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="flex items-center space-x-1">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace"
              className="flex-1 rounded border border-[#3c3c3c] bg-[#1e1e1e] py-2 pl-3 pr-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            <button 
              onClick={handleReplaceAll}
              disabled={!searchQuery.trim() || results.length === 0}
              className="px-2.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs rounded font-medium whitespace-nowrap"
            >
              All
            </button>
          </div>
        )}

        {/* Match count */}
        {searchQuery && (
          <div className="text-xs text-gray-500 px-1">
            {totalMatches} result{totalMatches !== 1 ? 's' : ''} in {results.length} file{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery && results.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500 text-center">No results found</div>
        )}
        
        {results.map(result => {
          const file = files[result.fileId];
          if (!file) return null;
          const isExpanded = expandedResults.has(result.fileId);
          
          return (
            <div key={result.fileId} className="mb-0.5">
              <div 
                className="flex cursor-pointer items-center px-2 py-1.5 text-[13px] text-gray-300 hover:bg-[#2a2d2e] active:bg-[#37373d] rounded-md mx-1"
                onClick={() => toggleExpand(result.fileId)}
              >
                {isExpanded ? <ChevronDown size={14} className="mr-1 flex-shrink-0" /> : <ChevronRight size={14} className="mr-1 flex-shrink-0" />}
                <FileText size={14} className="mr-1.5 text-gray-400 flex-shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="ml-2 rounded-full bg-[#333333] px-1.5 py-0.5 text-[10px] flex-shrink-0">{result.matches.length}</span>
                {showReplace && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleReplaceInFile(result.fileId); }}
                    className="ml-1 p-0.5 text-gray-500 hover:text-white hover:bg-white/10 rounded"
                    title="Replace in file"
                  >
                    <Replace size={12} />
                  </button>
                )}
              </div>
              
              {isExpanded && (
                <div className="pl-6">
                  {result.matches.map((match, i) => (
                    <div 
                      key={i}
                      className="flex cursor-pointer items-center py-1 pr-2 text-xs text-gray-400 hover:bg-[#2a2d2e] hover:text-white rounded-md mx-1"
                      onClick={() => openFile(result.fileId)}
                    >
                      <span className="w-8 flex-shrink-0 text-right text-gray-600 mr-2 font-mono">{match.line}</span>
                      <span className="truncate font-mono text-[12px]">{match.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
