import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Moon, Sun, Monitor, Trash2, Info, Github, User, LogOut, ExternalLink, Loader, CloudUpload, CloudDownload, Type, Maximize, ChevronDown, RefreshCw, CheckCircle, Copy, Check } from 'lucide-react';
import { startDeviceFlow, type DeviceFlowSession } from '../../lib/githubOAuth';
import { useIdeStore } from '../../store/useIdeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectsStore } from '../../store/useProjectsStore';
import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
  readConfig,
  saveConfigNow,
  saveFontFile,
  deleteFontFile,
  readFontFile,
  listFonts,
  getBasePath,
} from '../../lib/fileSystemStorage';
import {
  syncUpToDrive,
  syncDownFromDrive,
  getLastSyncInfo,
  setDriveAccessToken,
} from '../../lib/googleDriveSync';

export function SettingsPanel() {
  const { files, loadProject, theme, setTheme, isHapticsEnabled, setHaptics } = useIdeStore();
  const { githubToken, githubUser, googleUser, googleAccessToken, setGithubToken, clearGithub, clearGoogle, setGoogleAuth } = useAuthStore();
  const { projects } = useProjectsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  // GitHub Device Flow state
  const [deviceFlowSession, setDeviceFlowSession] = useState<DeviceFlowSession | null>(null);
  const [deviceFlowStatus, setDeviceFlowStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [activeFont, setActiveFont] = useState('');
  const [installedFonts, setInstalledFonts] = useState<string[]>([]);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load font list from config on mount
  useEffect(() => {
    readConfig().then(config => {
      if (config) {
        setActiveFont(config.activeFont || '');
        setInstalledFonts(config.installedFonts || []);
      }
    });
  }, []);

  // Restore active font on startup
  useEffect(() => {
    if (!activeFont) return;
    loadFontIntoDOM(activeFont);
  }, [activeFont]);

  async function loadFontIntoDOM(fontName: string) {
    const fontData = await readFontFile(fontName);
    if (fontData) {
      // Remove any existing font-face for this name
      const existingStyle = document.getElementById(`krypton-font-${fontName}`);
      if (existingStyle) existingStyle.remove();

      const style = document.createElement('style');
      style.id = `krypton-font-${fontName}`;
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontData}'); }`;
      document.head.appendChild(style);

      // Apply to Monaco editors
      setTimeout(() => {
        document.querySelectorAll('.monaco-editor').forEach(el => {
          (el as HTMLElement).style.fontFamily = `'${fontName}', 'JetBrains Mono', monospace`;
        });
      }, 100);
    }
  }

  // Initialize GoogleAuth for web fallback if needed
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      try {
        GoogleAuth.initialize({
          clientId: '228869160750-nqir9tev4919koqbcsrnhfo5puorqtqa.apps.googleusercontent.com',
          scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
          grantOfflineAccess: true,
        });
      } catch (e) {
        console.warn('GoogleAuth init failed on web:', e);
      }
    }

    // If user is already signed in, try to refresh the access token
    if (googleUser && Capacitor.isNativePlatform()) {
      refreshGoogleToken();
    }

    // Load last sync info
    loadLastSyncInfo();
  }, []);

  const refreshGoogleToken = async () => {
    try {
      const result = await GoogleAuth.refresh();
      if (result?.accessToken) {
        setDriveAccessToken(result.accessToken);
        useAuthStore.getState().setGoogleAuth(
          googleUser!,
          result.accessToken
        );
      }
    } catch (e) {
      console.warn('Token refresh failed — user may need to re-login:', e);
    }
  };

  const loadLastSyncInfo = async () => {
    try {
      const info = await getLastSyncInfo();
      if (info?.lastSync) {
        const d = new Date(info.lastSync);
        setLastSyncTime(d.toLocaleString());
      }
    } catch {
      // No sync info available
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      if (!Capacitor.isNativePlatform()) {
        await new Promise(resolve => setTimeout(resolve, 800));
        useAuthStore.getState().setGoogleAuth({
          name: "Test User",
          email: "developer@sednium.com",
          picture: "",
        }, 'mock-access-token-for-dev');
        const config = await readConfig();
        if (config) { config.welcomed = true; await saveConfigNow(config); }
        return;
      }

      const response = await GoogleAuth.signIn();
      const givenName = response.givenName || '';
      const familyName = response.familyName || '';
      const accessToken = response.authentication?.accessToken || '';
      const user = {
        name: response.name || `${givenName} ${familyName}`.trim() || response.email,
        email: response.email,
        picture: response.imageUrl || '',
      };
      setGoogleAuth(user, accessToken);
      const config = await readConfig();
      if (config) { config.welcomed = true; await saveConfigNow(config); }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
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

  const handleClearData = async () => {
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

  // GitHub Device Flow login
  const handleGithubDeviceFlow = async () => {
    setDeviceFlowStatus('waiting');
    setConnectError('');
    try {
      const session = await startDeviceFlow();
      setDeviceFlowSession(session);
      
      // Wait for user to authorize
      const result = await session.waitForToken();
      
      if (result.status === 'complete') {
        const success = await setGithubToken(result.token);
        if (success) {
          setDeviceFlowStatus('success');
          setTimeout(() => {
            setDeviceFlowStatus('idle');
            setDeviceFlowSession(null);
          }, 2000);
        } else {
          setDeviceFlowStatus('error');
          setConnectError('Token validation failed');
        }
      } else if (result.status === 'expired') {
        setDeviceFlowStatus('error');
        setConnectError('Code expired. Try again.');
      } else if (result.status === 'denied') {
        setDeviceFlowStatus('idle');
      } else {
        setDeviceFlowStatus('error');
        setConnectError((result as any).message || 'Login failed');
      }
    } catch (err: any) {
      setDeviceFlowStatus('error');
      setConnectError(err.message || 'Failed to start login');
    }
    setDeviceFlowSession(null);
  };

  const cancelDeviceFlow = () => {
    if (deviceFlowSession) {
      deviceFlowSession.cancel();
      setDeviceFlowSession(null);
    }
    setDeviceFlowStatus('idle');
    setConnectError('');
  };

  const copyDeviceCode = () => {
    if (deviceFlowSession) {
      navigator.clipboard.writeText(deviceFlowSession.userCode).catch(() => {});
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  // Upload to Google Drive
  const handleSyncUpload = async () => {
    if (!googleUser) {
      setSyncStatus('Sign in with Google first');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    // Refresh token first
    if (Capacitor.isNativePlatform()) {
      await refreshGoogleToken();
    }

    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncUpToDrive();
      setSyncStatus(result.message + (result.success ? ' ✓' : ''));
      if (result.success) {
        setLastSyncTime(new Date().toLocaleString());
      }
    } catch (err: any) {
      setSyncStatus(`Upload failed: ${err.message}`);
    }
    setIsSyncing(false);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  // Download from Google Drive
  const handleSyncDownload = async () => {
    if (!googleUser) {
      setSyncStatus('Sign in with Google first');
      setTimeout(() => setSyncStatus(null), 3000);
      return;
    }

    if (!confirm('This will overwrite local data with the cloud backup. Continue?')) return;

    // Refresh token first
    if (Capacitor.isNativePlatform()) {
      await refreshGoogleToken();
    }

    setIsDownloading(true);
    setSyncStatus(null);
    try {
      const result = await syncDownFromDrive();
      setSyncStatus(result.message + (result.success ? ' ✓' : ''));
      if (result.success) {
        setSyncStatus(result.message + ' — Reloading...');
        // Reload stores from disk after restore
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setSyncStatus(`Download failed: ${err.message}`);
    }
    setIsDownloading(false);
    setTimeout(() => setSyncStatus(null), 5000);
  };

  // Custom font upload — saves to fonts/ folder
  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const fontData = reader.result as string;
      const fontName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, '');

      // Save font to filesystem
      await saveFontFile(fontName, fontData);

      // Update config
      const config = await readConfig();
      if (config) {
        if (!config.installedFonts.includes(fontName)) {
          config.installedFonts.push(fontName);
        }
        config.activeFont = fontName;
        await saveConfigNow(config);
      }

      // Load into DOM
      await loadFontIntoDOM(fontName);

      setActiveFont(fontName);
      setInstalledFonts(prev => [...new Set([...prev, fontName])]);
    };
    reader.readAsDataURL(file);
    if (fontInputRef.current) fontInputRef.current.value = '';
  };

  // Switch active font
  const handleSelectFont = async (fontName: string) => {
    setShowFontDropdown(false);

    if (fontName === '') {
      // Reset to default
      setActiveFont('');
      document.querySelectorAll('.monaco-editor').forEach(el => {
        (el as HTMLElement).style.fontFamily = '';
      });
      const config = await readConfig();
      if (config) { config.activeFont = ''; await saveConfigNow(config); }
      return;
    }

    setActiveFont(fontName);
    await loadFontIntoDOM(fontName);
    const config = await readConfig();
    if (config) { config.activeFont = fontName; await saveConfigNow(config); }
  };

  // Delete a font
  const handleDeleteFont = async (fontName: string) => {
    await deleteFontFile(fontName);
    const newList = installedFonts.filter(f => f !== fontName);
    setInstalledFonts(newList);

    const config = await readConfig();
    if (config) {
      config.installedFonts = newList;
      if (config.activeFont === fontName) config.activeFont = '';
      await saveConfigNow(config);
    }

    if (activeFont === fontName) {
      setActiveFont('');
      document.querySelectorAll('.monaco-editor').forEach(el => {
        (el as HTMLElement).style.fontFamily = '';
      });
    }
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
              {deviceFlowStatus === 'idle' || deviceFlowStatus === 'error' ? (
                <>
                  {/* Primary: OAuth Device Flow login */}
                  <button
                    onClick={handleGithubDeviceFlow}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Github size={14} />
                    <span>Login with GitHub</span>
                  </button>
                  {connectError && <p className="text-red-400 text-[11px]">{connectError}</p>}
                  {/* Fallback: manual token entry */}
                  <details className="text-[11px]">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-400">Use Personal Access Token instead</summary>
                    <div className="flex space-x-2 mt-2">
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={e => setTokenInput(e.target.value)}
                        placeholder="ghp_..."
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
                  </details>
                </>
              ) : deviceFlowStatus === 'waiting' && deviceFlowSession ? (
                /* Device Flow: show code to user */
                <div className="space-y-3">
                  <p className="text-gray-400 text-[11px]">
                    Enter this code at <span className="text-blue-400">github.com/login/device</span>
                  </p>
                  <div className="flex items-center justify-between bg-[#0d1117] rounded-lg border border-[#30363d] px-3 py-2">
                    <span className="text-white font-mono text-lg font-bold tracking-[0.3em] select-all">
                      {deviceFlowSession.userCode}
                    </span>
                    <button
                      onClick={copyDeviceCode}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-[#30363d] rounded transition-colors"
                      title="Copy code"
                    >
                      {codeCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <a
                    href={deviceFlowSession.verificationUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-[#30363d] hover:bg-[#3c444d] text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>Open github.com/login/device</span>
                  </a>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-yellow-500 text-[11px]">
                      <Loader size={10} className="animate-spin" />
                      <span>Waiting for authorization...</span>
                    </span>
                    <button
                      onClick={cancelDeviceFlow}
                      className="text-gray-500 hover:text-red-400 text-[11px] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deviceFlowStatus === 'success' ? (
                <div className="flex items-center space-x-2 text-green-400 text-xs py-2">
                  <CheckCircle size={14} />
                  <span>Connected to GitHub!</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Google */}
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

      {/* ── Storage Info ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Storage</h3>
        <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3">
          <p className="text-gray-400 text-xs mb-1">Files are stored at:</p>
          <p className="text-emerald-400 text-xs font-mono break-all">/storage/emulated/0/{getBasePath()}/</p>
          <p className="text-gray-600 text-[10px] mt-2">Browse with ZArchiver or any file manager</p>
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

          {/* Custom Font — Dropdown + Upload */}
          <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white text-xs font-medium">Editor Font</p>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  {activeFont ? `Active: ${activeFont}` : 'JetBrains Mono (default)'}
                </p>
              </div>
              <button
                onClick={() => fontInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white text-xs rounded-lg transition-colors flex items-center space-x-1.5"
              >
                <Type size={12} />
                <span>Add Font</span>
              </button>
            </div>

            {/* Font Dropdown */}
            {installedFonts.length > 0 && (
              <div className="relative mt-2">
                <button
                  onClick={() => setShowFontDropdown(!showFontDropdown)}
                  className="w-full flex items-center justify-between bg-[#252526] border border-[#3c3c3c] rounded-lg px-3 py-2 text-xs text-white hover:bg-[#2d2d2d] transition-colors"
                >
                  <span>{activeFont || 'Default (JetBrains Mono)'}</span>
                  <ChevronDown size={14} className={`transform transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showFontDropdown && (
                  <div className="absolute left-0 right-0 mt-1 bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {/* Default option */}
                    <button
                      onClick={() => handleSelectFont('')}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#2d2d2d] transition-colors flex items-center justify-between ${
                        !activeFont ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                      }`}
                    >
                      <span>Default (JetBrains Mono)</span>
                      {!activeFont && <span className="text-blue-400">✓</span>}
                    </button>

                    {installedFonts.map(font => (
                      <div
                        key={font}
                        className={`flex items-center justify-between px-3 py-2 text-xs hover:bg-[#2d2d2d] transition-colors ${
                          activeFont === font ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                        }`}
                      >
                        <button
                          onClick={() => handleSelectFont(font)}
                          className="flex-1 text-left"
                        >
                          {font}
                          {activeFont === font && <span className="ml-2 text-blue-400">✓</span>}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteFont(font); }}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded ml-2 flex-shrink-0"
                          title="Remove font"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeFont && (
              <button
                onClick={() => handleSelectFont('')}
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

      {/* ── Sync ── */}
      <div>
        <h3 className="text-white font-semibold mb-3 text-xs uppercase tracking-wider">Cloud Sync</h3>
        
        {/* Sync info */}
        {googleUser && lastSyncTime && (
          <div className="bg-[#1e1e1e] rounded-lg border border-[#2d2d2d] p-3 mb-3">
            <div className="flex items-center space-x-2 text-gray-400">
              <CheckCircle size={12} className="text-green-400" />
              <span className="text-[11px]">Last synced: {lastSyncTime}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {/* Upload to Drive */}
          <button
            onClick={handleSyncUpload}
            disabled={isSyncing || !googleUser}
            className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <CloudUpload size={16} />
            )}
            <span>{isSyncing ? 'Uploading...' : 'Backup to Google Drive'}</span>
          </button>

          {/* Download from Drive */}
          <button
            onClick={handleSyncDownload}
            disabled={isDownloading || !googleUser}
            className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] active:bg-[#444] py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <CloudDownload size={16} />
            )}
            <span>{isDownloading ? 'Downloading...' : 'Restore from Google Drive'}</span>
          </button>

          {/* Refresh token */}
          {googleUser && Capacitor.isNativePlatform() && (
            <button
              onClick={refreshGoogleToken}
              className="w-full flex items-center justify-center space-x-2 text-gray-500 hover:text-gray-300 py-1.5 text-[11px] transition-colors"
            >
              <RefreshCw size={12} />
              <span>Refresh Auth Token</span>
            </button>
          )}
        </div>

        {!googleUser && (
          <p className="text-gray-600 text-[11px] mt-2 text-center">Sign in with Google above to enable sync</p>
        )}

        {syncStatus && (
          <p className={`text-[11px] mt-2 text-center ${syncStatus.includes('✓') ? 'text-green-400' : syncStatus.includes('failed') ? 'text-red-400' : 'text-yellow-400'}`}>
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
          <span>Krypton IDE v2.5 • Mobile Code Editor</span>
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
