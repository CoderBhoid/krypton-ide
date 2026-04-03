import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FileJson, FileCode2, FileText, Plus, FolderPlus, Trash2, Edit2, Search, Upload, Download, X, Copy, Share2, Save, Clipboard, FolderDown, MoreVertical } from 'lucide-react';
import { useIdeStore, FileNode } from '../../store/useIdeStore';
import { cn } from '../../lib/utils';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json': return <FileJson size={16} className="text-yellow-400" />;
    case 'ts':
    case 'tsx': return <FileCode2 size={16} className="text-blue-400" />;
    case 'js':
    case 'jsx': return <FileCode2 size={16} className="text-yellow-300" />;
    case 'css':
    case 'scss': return <FileCode2 size={16} className="text-sky-300" />;
    case 'html':
    case 'htm': return <FileCode2 size={16} className="text-orange-400" />;
    case 'md': return <FileText size={16} className="text-gray-300" />;
    case 'py': return <FileCode2 size={16} className="text-green-400" />;
    case 'rs': return <FileCode2 size={16} className="text-orange-300" />;
    case 'go': return <FileCode2 size={16} className="text-cyan-400" />;
    case 'java':
    case 'kt': return <FileCode2 size={16} className="text-red-400" />;
    case 'svg':
    case 'xml': return <FileCode2 size={16} className="text-purple-400" />;
    default: return <File size={16} className="text-gray-400" />;
  }
};

// ─── Context Menu Item ─────────────────────────────────
interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
}

export function FileExplorer() {
  const { files, activeFileId, openFile, createFile, deleteFile, renameFile, saveFile, updateFileContent } = useIdeStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, nodeId: '' });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(prev => ({ ...prev, visible: false }));
    if (contextMenu.visible) {
      document.addEventListener('click', close);
      document.addEventListener('scroll', close, true);
      return () => {
        document.removeEventListener('click', close);
        document.removeEventListener('scroll', close, true);
      };
    }
  }, [contextMenu.visible]);

  // ─── Long press handlers ───────────────────────────────
  const handleTouchStart = useCallback((nodeId: string, e: React.TouchEvent) => {
    longPressTriggered.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate(30);
      setContextMenu({ visible: true, x, y, nodeId });
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Also support right-click on desktop
  const handleContextMenu = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId });
  }, []);

  // ─── Context menu actions ──────────────────────────────
  const downloadFile = (nodeId: string) => {
    const node = files[nodeId];
    if (!node || node.type !== 'file') return;
    const blob = new Blob([node.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFolder = async (nodeId: string) => {
    const node = files[nodeId];
    if (!node) return;
    const zip = new JSZip();
    const addToZip = (nId: string, path: string) => {
      const n = files[nId];
      if (!n) return;
      if (n.type === 'file' && n.content !== undefined) {
        zip.file(`${path}${n.name}`, n.content);
      } else if (n.type === 'folder' && n.children) {
        const newPath = nId === nodeId ? '' : `${path}${n.name}/`;
        n.children.forEach(cId => addToZip(cId, newPath));
      }
    };
    addToZip(nodeId, '');
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${node.name}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyContent = async (nodeId: string) => {
    const node = files[nodeId];
    if (!node || !node.content) return;
    try {
      await navigator.clipboard.writeText(node.content);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = node.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const duplicateFile = (nodeId: string) => {
    const node = files[nodeId];
    if (!node) return;
    const ext = node.name.includes('.') ? '.' + node.name.split('.').pop() : '';
    const base = node.name.replace(ext, '');
    const newName = `${base}_copy${ext}`;
    const parentId = Object.entries(files).find(([_, f]) =>
      f.type === 'folder' && f.children?.includes(nodeId)
    )?.[0] || 'root';
    createFile(newName, parentId, node.type, node.content);
  };

  const shareFile = async (nodeId: string) => {
    const node = files[nodeId];
    if (!node) return;
    try {
      if (node.type === 'file' && node.content) {
        await Share.share({
          title: node.name,
          text: node.content,
          dialogTitle: `Share ${node.name}`,
        });
      } else {
        await Share.share({
          title: node.name,
          text: `Shared from Krypton IDE: ${node.name}`,
          dialogTitle: 'Share',
        });
      }
    } catch {
      // User cancelled or share not available
    }
  };

  const sendToAgent = (nodeId: string) => {
    const node = files[nodeId];
    if (!node) return;
    window.dispatchEvent(new CustomEvent('krypton-send-to-agent', { detail: { text: `@${node.name} ` } }));
  };

  const getContextMenuItems = (nodeId: string): ContextMenuItem[] => {
    const node = files[nodeId];
    if (!node) return [];
    const isFile = node.type === 'file';
    const isRoot = nodeId === 'root';

    const items: ContextMenuItem[] = [];

    if (isFile) {
      items.push({ label: 'Open', icon: <File size={14} />, onClick: () => openFile(nodeId) });
    }

    if (!isRoot) {
      items.push({ label: 'Rename', icon: <Edit2 size={14} />, onClick: () => { setRenamingId(nodeId); setRenameValue(node.name); } });
    }

    if (isFile) {
      items.push({ label: 'Save', icon: <Save size={14} />, onClick: () => saveFile(nodeId) });
      items.push({ label: 'Copy Content', icon: <Clipboard size={14} />, onClick: () => copyContent(nodeId) });
      items.push({ label: 'Duplicate', icon: <Copy size={14} />, onClick: () => duplicateFile(nodeId) });
      items.push({ label: 'Download', icon: <Download size={14} />, onClick: () => downloadFile(nodeId) });
    }

    if (!isFile) {
      items.push({ label: 'New File', icon: <Plus size={14} />, onClick: () => { const name = prompt('File name:'); if (name) { const id = createFile(name, nodeId, 'file'); openFile(id); setExpandedFolders(new Set(expandedFolders).add(nodeId)); } } });
      items.push({ label: 'New Folder', icon: <FolderPlus size={14} />, onClick: () => { const name = prompt('Folder name:'); if (name) { createFile(name, nodeId, 'folder'); setExpandedFolders(new Set(expandedFolders).add(nodeId)); } } });
      items.push({ label: 'Download as ZIP', icon: <FolderDown size={14} />, onClick: () => downloadFolder(nodeId) });
    }

    items.push({ label: 'Share', icon: <Share2 size={14} />, onClick: () => shareFile(nodeId), divider: true });

    if (isFile) {
      items.push({ label: 'Send to Agent', icon: <FileText size={14} />, onClick: () => sendToAgent(nodeId) });
    }

    if (!isRoot) {
      items.push({ label: 'Delete', icon: <Trash2 size={14} />, onClick: () => { if (confirm(`Delete "${node.name}"?`)) deleteFile(nodeId); }, danger: true, divider: true });
    }

    return items;
  };

  // ─── Existing handlers ─────────────────────────────────
  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedFolders(newExpanded);
  };

  const handleCreateFile = (parentId: string, type: 'file' | 'folder', e: React.MouseEvent) => {
    e.stopPropagation();
    const name = prompt(`Enter ${type} name:`);
    if (name) {
      const id = createFile(name, parentId, type);
      if (!expandedFolders.has(parentId)) setExpandedFolders(new Set(expandedFolders).add(parentId));
      if (type === 'file') openFile(id);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this item?')) deleteFile(id);
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) renameFile(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const id = createFile(file.name, 'root', 'file', content);
        if (i === 0) openFile(id);
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const addToZip = (nodeId: string, currentPath: string) => {
      const node = files[nodeId];
      if (!node) return;
      if (node.type === 'file' && node.content !== undefined) {
        zip.file(`${currentPath}${node.name}`, node.content);
      } else if (node.type === 'folder' && node.children) {
        const newPath = nodeId === 'root' ? '' : `${currentPath}${node.name}/`;
        node.children.forEach(childId => addToZip(childId, newPath));
      }
    };
    addToZip('root', '');
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${files.root?.name || 'project'}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchesSearch = (node: FileNode): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.type === 'file' && node.content?.toLowerCase().includes(q)) return true;
    if (node.type === 'folder' && node.children) {
      return node.children.some(childId => {
        const child = files[childId];
        return child ? matchesSearch(child) : false;
      });
    }
    return false;
  };

  const renderNode = (nodeId: string, depth: number = 0) => {
    const node = files[nodeId];
    if (!node) return null;
    if (searchQuery.trim() && !matchesSearch(node)) return null;

    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(nodeId) || (!!searchQuery.trim() && isFolder);
    const isActive = activeFileId === nodeId;
    const isRenaming = renamingId === nodeId;

    return (
      <div key={nodeId}>
        <div
          className={cn(
            "group flex cursor-pointer items-center py-[6px] pr-2 text-[13px] hover:bg-[#2a2d2e] active:bg-[#37373d] transition-colors select-none",
            isActive ? "bg-[#37373d] text-white" : "text-[#cccccc]"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (longPressTriggered.current) { longPressTriggered.current = false; return; }
            isFolder ? toggleFolder(nodeId, { stopPropagation: () => {} } as any) : openFile(nodeId);
          }}
          onDoubleClick={(e) => {
            if (!isFolder && nodeId !== 'root') startRename(nodeId, node.name, e);
          }}
          onTouchStart={(e) => handleTouchStart(nodeId, e)}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onContextMenu={(e) => handleContextMenu(nodeId, e)}
        >
          <div className="flex items-center flex-1 min-w-0">
            <span className="mr-1 w-4 flex-shrink-0 flex items-center justify-center">
              {isFolder && (
                isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
              )}
            </span>
            <span className="mr-1.5 flex-shrink-0">
              {isFolder ? (
                <Folder size={16} className="text-blue-400" fill={isExpanded ? "currentColor" : "none"} />
              ) : (
                getFileIcon(node.name)
              )}
            </span>
            
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-[#1e1e1e] border border-blue-500 rounded px-1 py-0 text-[13px] text-white focus:outline-none"
              />
            ) : (
              <span className="truncate">{node.name}</span>
            )}
          </div>

          {/* Inline actions — keep for desktop hover */}
          {!isRenaming && (
            <div className="flex items-center space-x-0.5 opacity-0 md:group-hover:opacity-100 flex-shrink-0 ml-1">
              {isFolder && (
                <>
                  <button onClick={(e) => handleCreateFile(nodeId, 'file', e)} className="p-1 hover:bg-gray-600 rounded" title="New File">
                    <Plus size={14} />
                  </button>
                  <button onClick={(e) => handleCreateFile(nodeId, 'folder', e)} className="p-1 hover:bg-gray-600 rounded" title="New Folder">
                    <FolderPlus size={14} />
                  </button>
                </>
              )}
              {nodeId !== 'root' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId }); }}
                  className="p-1 hover:bg-gray-600 rounded" title="More actions"
                >
                  <MoreVertical size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        
        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map(childId => renderNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar + actions */}
      <div className="px-2 pt-2 pb-1 space-y-1.5 border-b border-[#2d2d2d]">
        <div className="flex items-center space-x-1">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full rounded border border-[#3c3c3c] bg-[#1e1e1e] py-1.5 pl-7 pr-7 text-xs text-white focus:border-blue-500 focus:outline-none placeholder-gray-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-0.5">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Import / Export row */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-1.5 rounded text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <Upload size={12} />
            <span>Import</span>
          </button>
          <button
            onClick={handleDownloadZip}
            className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-1.5 rounded text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <Download size={12} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="*/*" onChange={handleUploadFiles} />

      {/* File tree */}
      <div className="py-1 flex-1 overflow-y-auto">
        {renderNode('root')}
      </div>

      {/* ─── Context Menu Popup ───────────────────────── */}
      {contextMenu.visible && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))} />
          <div
            className="fixed z-[101] min-w-[180px] bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl py-1 animate-context-pop"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 300)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {getContextMenuItems(contextMenu.nodeId).map((item, i) => (
              <React.Fragment key={i}>
                {item.divider && i > 0 && <div className="border-t border-[#3c3c3c] my-1" />}
                <button
                  className={cn(
                    "w-full flex items-center space-x-2.5 px-3 py-2 text-[13px] transition-colors text-left",
                    item.danger
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-gray-300 hover:bg-[#37373d] hover:text-white"
                  )}
                  onClick={() => {
                    setContextMenu(prev => ({ ...prev, visible: false }));
                    item.onClick();
                  }}
                >
                  <span className="flex-shrink-0 opacity-70">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
