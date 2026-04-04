import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Moon, Sun, Monitor, Trash2, Info, Github, User, LogOut, ExternalLink, Loader, CloudUpload, Type, Maximize } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export function SettingsPanel() {
  const { files, loadProject, theme, setTheme, isFullscreen, setFullscreen, isGlassmorphismEnabled, setGlassmorphism, isHapticsEnabled, setHaptics } = useIdeStore();
  const { githubToken, githubUser, googleUser, setGithubToken, clearGithub, clearGoogle } = useAuthStore();
  const { projects } = useProjectsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [customFont, setCustomFont] = useState(localStorage.getItem('krypton-custom-font-name') || '');
  const [hapticsKey, setHapticsKey] = useState(0); // for re-render on toggle
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Web fallback initialization removed to prevent GAPI origin errors

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      if (!Capacitor.isNativePlatform()) {
        // Mock web login for local UI testing to bypass Google's strict origin policies
        await new Promise(resolve => setTimeout(resolve, 800));
        useAuthStore.getState().setGoogleUser({
          name: "Test User",
          email: "developer@sednium.com",
          picture: "",
        });
        localStorage.setItem('krypton-welcomed', 'true');
        return;
      }

      const response = await GoogleAuth.signIn();
      const givenName = response.givenName || '';
      const familyName = response.familyName || '';
      useAuthStore.getState().setGoogleUser({
        name: response.name || `${givenName} ${familyName}`.trim() || response.email,
        email: response.email,
        picture: response.imageUrl || '',
      });
      localStorage.setItem('krypton-welcomed', 'true');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // Ignore user cancellations
      if (err?.error !== 'popup_closed_by_user' && err?.message !== 'user_cancelled') {
        alert('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleExportZip = async () => {
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

  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      const newFiles: Record<string, any> = {
        'root': {
          id: 'root',
          name: file.name.replace('.zip', '') || 'Project',
          type: 'folder',
          parentId: null,
          children: [],
        }
      };

      const generateId = () => Math.random().toString(36).substring(2, 9);

      for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;

        const content = await zipEntry.async('string');
        const parts = relativePath.split('/');
        const fileName = parts.pop() || 'unnamed';
        
        let currentParentId = 'root';
        
        for (const part of parts) {
          let folderId = newFiles[currentParentId].children.find(
            (id: string) => newFiles[id]?.name === part && newFiles[id]?.type === 'folder'
          );

          if (!folderId) {
            folderId = generateId();
            newFiles[folderId] = {
              id: folderId,
              name: part,
              type: 'folder',
              parentId: currentParentId,
              children: [],
            };
            newFiles[currentParentId].children.push(folderId);
          }
          currentParentId = folderId;
        }

        const fileId = generateId();
        const ext = fileName.split('.').pop()?.toLowerCase();
        let language = 'plaintext';
        if (ext === 'js' || ext === 'jsx') language = 'javascript';
        else if (ext === 'ts' || ext === 'tsx') language = 'typescript';
        else if (ext === 'html') language = 'html';
        else if (ext === 'css') language = 'css';
        else if (ext === 'json') language = 'json';
        else if (ext === 'md') language = 'markdown';
        else if (ext === 'py') language = 'python';

        newFiles[fileId] = {
          id: fileId,
          name: fileName,
          type: 'file',
          content,
          parentId: currentParentId,
          language,
        };
        newFiles[currentParentId].children.push(fileId);
      }

      loadProject(newFiles);
    } catch (error) {
      console.error('Failed to import zip:', error);
      alert('Failed to import zip file.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearData = () => {
    if (confirm('Clear all local data? This will delete all projects and reset the app.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleGithubConnect = async () => {
    if (!tokenInput.trim()) return;
    setIsConnecting(true);
    setConnectError('');
    const success = await setGithubToken(tokenInput.trim());
    if (!success) setConnectError('Invalid token');
    setTokenInput('');
    setIsConnecting(false);
  };

  // Sync projects to Google Drive
  const handleSyncToDrive = async () => {
    if (!googleUser) {
      setSyncStatus('Sign in with Google first');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const data = JSON.stringify(projects, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const metadata = {
        name: 'krypton-ide-projects.json',
        mimeType: 'application/json',
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      // This requires the user to have granted Drive scope — for now, save locally as backup
      const backupData = JSON.stringify({ projects, exportedAt: Date.now() });
      localStorage.setItem('krypton-drive-backup', backupData);
      setSyncStatus('Projects backed up locally ✓');
    } catch (err) {
      setSyncStatus('Sync failed');
    }
    setIsSyncing(false);
    setTimeout(() => setSyncStatus(null), 3000);
  };

  // Custom font upload
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const fontData = reader.result as string;
      const fontName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, '');

      // Create @font-face
      const style = document.createElement('style');
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
      document.head.appendChild(style);

      // Apply to Monaco
      const monaco = (window as any).monaco;
      if (monaco) {
        monaco.editor.getModels().forEach(() => {});
        // Update all editors
        document.querySelectorAll('.monaco-editor').forEach(el => {
          const editorEl = el as HTMLElement;
          editorEl.style.fontFamily = `'${fontName}', 'JetBrains Mono', monospace`;
        });
      }

      localStorage.setItem('krypton-custom-font-name', fontName);
      localStorage.setItem('krypton-custom-font-data', fontData);
      setCustomFont(fontName);
    };
    reader.readAsDataURL(file);
    if (fontInputRef.current) fontInputRef.current.value = '';
  };

  return (
    <div className="p-4 text-sm text-gray-300 space-y-6 overflow-y-auto max-h-full">
      {/* ── Accounts ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Accounts</h3>

        {/* GitHub */}
        <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3 mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <Github size={16} className="text-white" />
            <span className="text-white font-medium text-xs">GitHub</span>
          </div>

          {githubUser ? (
            <div className="flex items-center space-x-3">
              <img src={githubUser.avatar_url} alt="" className="w-8 h-8 rounded-full border border-[#3c3c3c]" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{githubUser.name || githubUser.login}</p>
                <p className="text-gray-500 text-[11px]">@{githubUser.login} • {githubUser.public_repos} repos</p>
              </div>
              <button onClick={clearGithub} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Disconnect">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="Personal Access Token"
                  className="flex-1 rounded border border-[#3c3c3c] bg-[#252526] px-2 py-1.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-xs"
                  onKeyDown={e => e.key === 'Enter' && handleGithubConnect()}
                />
                <button
                  onClick={handleGithubConnect}
                  disabled={isConnecting || !tokenInput.trim()}
                  className="px-3 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded text-xs disabled:opacity-50 transition-colors"
                >
                  {isConnecting ? <Loader size={12} className="animate-spin" /> : 'Connect'}
                </button>
              </div>
              {connectError && <p className="text-red-400 text-[11px]">{connectError}</p>}
              <a
                href="https://github.com/settings/tokens/new?description=Krypton%20IDE&scopes=repo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-[11px]"
              >
                <ExternalLink size={10} />
                <span>Get a token →</span>
              </a>
            </div>
          )}
        </div>

        {/* Google (placeholder) */}
        <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3">
          <div className="flex items-center space-x-2 mb-2">
            <svg viewBox="0 0 24 24" width="16" height="16" className="flex-shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-white font-medium text-xs">Google</span>
          </div>

          {googleUser ? (
            <div className="flex items-center space-x-3">
              <img src={googleUser.picture} alt="" className="w-8 h-8 rounded-full border border-[#3c3c3c]" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{googleUser.name}</p>
                <p className="text-gray-500 text-[11px] truncate">{googleUser.email}</p>
              </div>
              <button onClick={clearGoogle} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col space-y-2 mt-1">
              <button
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-gray-100 text-gray-800 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {isGoogleLoading ? <Loader size={14} className="animate-spin" /> : <span>Sign in to sync your projects</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Project ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Project</h3>
        <div className="space-y-2">
          <button 
            onClick={handleExportZip}
            className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-2.5 rounded-lg transition-colors"
          >
            <Download size={16} />
            <span>Export as .zip</span>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-2.5 rounded-lg transition-colors"
          >
            <Upload size={16} />
            <span>Import .zip</span>
          </button>
          <input 
            type="file" 
            accept=".zip" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImportZip}
          />
        </div>
      </div>

      {/* ── Theme ── */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-semibold mb-3 text-xs uppercase tracking-wider">Theme</h3>
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => setTheme('vs-dark')}
            className={`flex flex-col items-center p-3 rounded-xl border transition-all text-gray-700 dark:text-white ${
              theme === 'vs-dark' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10' 
                : 'border-gray-200 dark:border-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#333333] active:bg-gray-200 dark:active:bg-[#444]'
            }`}
          >
            <Moon size={20} className="mb-1.5" />
            <span className="text-xs">Dark</span>
          </button>
          <button 
            onClick={() => setTheme('light')}
            className={`flex flex-col items-center p-3 rounded-xl border transition-all text-gray-700 dark:text-white ${
              theme === 'light' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10' 
                : 'border-gray-200 dark:border-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#333333] active:bg-gray-200 dark:active:bg-[#444]'
            }`}
          >
            <Sun size={20} className="mb-1.5" />
            <span className="text-xs">Light</span>
          </button>
          <button 
            onClick={() => setTheme('hc-black')}
            className={`flex flex-col items-center p-3 rounded-xl border transition-all text-gray-700 dark:text-white ${
              theme === 'hc-black' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10' 
                : 'border-gray-200 dark:border-[#3c3c3c] hover:bg-gray-100 dark:hover:bg-[#333333] active:bg-gray-200 dark:active:bg-[#444]'
            }`}
          >
            <Monitor size={20} className="mb-1.5" />
            <span className="text-xs">Contrast</span>
          </button>
        </div>
      </div>

      {/* ── Editor & View ── */}
      <div>
        <h3 className="text-gray-900 dark:text-white font-semibold mb-3 text-xs uppercase tracking-wider">Editor & View</h3>
        
        {/* Fullscreen Toggle (Native only) */}
        {Capacitor.isNativePlatform() && (
          <div className="flex items-center justify-between mb-4 bg-gray-50 dark:bg-[#1e1e1e] p-3 rounded-lg border border-gray-200 dark:border-[#2d2d2d]">
            <div className="flex items-center space-x-3">
              <Maximize size={16} className="text-blue-400" />
              <div>
                <p className="text-gray-900 dark:text-white font-medium text-xs">Immersive Mode</p>
                <p className="text-gray-500 text-[10px] mt-0.5">Hide device status bar</p>
              </div>
            </div>
            <button 
              onClick={() => setFullscreen(!isFullscreen)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isFullscreen ? 'bg-blue-500' : 'bg-gray-300 dark:bg-[#3c3c3c]'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isFullscreen ? 'translate-x-4.5' : 'translate-x-1'}`} />
            </button>
          </div>
        )}

        <div className="flex flex-col space-y-2 mb-4">
          {/* Glassmorphism Toggle */}
          <div className="bg-gray-50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[#2d2d2d] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 dark:text-white text-xs font-medium">Use Glassmorphism</p>
                <p className="text-gray-500 text-[11px] mt-0.5">Premium translucent UI effects</p>
              </div>
              <button
                onClick={() => setGlassmorphism(!isGlassmorphismEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  isGlassmorphismEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-[#3c3c3c]'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                  isGlassmorphismEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Haptic Feedback Toggle */}
          <div className="bg-gray-50 dark:bg-[#1e1e1e] rounded-lg border border-gray-200 dark:border-[#2d2d2d] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 dark:text-white text-xs font-medium">Haptic Feedback</p>
                <p className="text-gray-500 text-[11px] mt-0.5">Vibrate on keyboard toolbar taps</p>
              </div>
              <button
                onClick={() => setHaptics(!isHapticsEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  isHapticsEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-[#3c3c3c]'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                  isHapticsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Custom Font Upload */}
          <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-xs font-medium">Editor Font</p>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  {customFont ? `Using: ${customFont}` : 'JetBrains Mono (default)'}
                </p>
              </div>
              <button
                onClick={() => fontInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white text-xs rounded-lg transition-colors flex items-center space-x-1.5"
              >
                <Type size={12} />
                <span>{customFont ? 'Change' : 'Upload'}</span>
              </button>
            </div>
            {customFont && (
              <button
                onClick={() => {
                  localStorage.removeItem('krypton-custom-font-name');
                  localStorage.removeItem('krypton-custom-font-data');
                  setCustomFont('');
                  document.querySelectorAll('.monaco-editor').forEach(el => {
                    (el as HTMLElement).style.fontFamily = '';
                  });
                }}
                className="text-[11px] text-red-400 hover:text-red-300 mt-2 transition-colors"
              >
                Reset to default
              </button>
            )}
            <input
              type="file"
              ref={fontInputRef}
              accept=".ttf,.otf,.woff,.woff2,.eot"
              className="hidden"
              onChange={handleFontUpload}
            />
          </div>
        </div>
      </div>

      {/* ── Sync ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Sync</h3>
        <button
          onClick={handleSyncToDrive}
          disabled={isSyncing}
          className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader size={16} className="animate-spin" />
          ) : (
            <CloudUpload size={16} />
          )}
          <span>{isSyncing ? 'Syncing...' : 'Backup Projects'}</span>
        </button>
        {syncStatus && (
          <p className={`text-[11px] mt-2 text-center ${syncStatus.includes('✓') ? 'text-green-400' : 'text-yellow-400'}`}>
            {syncStatus}
          </p>
        )}
      </div>

      {/* ── Data ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Data</h3>
        <button 
          onClick={handleClearData}
          className="w-full flex items-center justify-center space-x-2 bg-red-900/30 hover:bg-red-900/50 active:bg-red-900/70 text-red-300 py-2.5 rounded-lg border border-red-900/30 transition-colors"
        >
          <Trash2 size={16} />
          <span>Clear All Data</span>
        </button>
      </div>

      {/* ── About ── */}
      <div className="border-t border-[#3c3c3c] pt-4 space-y-3">
        <div className="flex items-center space-x-2 text-gray-500 text-xs">
          <Info size={12} />
          <span>Krypton IDE v2.0 • Mobile Code Editor</span>
        </div>
        <div className="text-xs text-gray-400 p-3 bg-gray-100 dark:bg-[#2d2d2d] rounded-lg border border-gray-200 dark:border-[#3c3c3c]">
          <p className="mb-2">
            Developed by <a href="https://sednium.vercel.app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium">Sednium</a>
          </p>
          <p className="text-gray-500 leading-relaxed">
            ⭐ If you like Krypton IDE, please consider starring the project to motivate further development!
          </p>
        </div>
      </div>
    </div>
  );
}

