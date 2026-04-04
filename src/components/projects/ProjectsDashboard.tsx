import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FolderOpen, Clock, FileCode2, ChevronRight, X, Code2, FileText, Braces } from 'lucide-react';
import { useProjectsStore, type ProjectTemplate } from '../../store/useProjectsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { useIdeStore } from '../../store/useIdeStore';

const GOOGLE_CLIENT_ID = '228869160750-nqir9tev4919koqbcsrnhfo5puorqtqa.apps.googleusercontent.com';

const templateOptions: { id: ProjectTemplate; name: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'html-css-js', name: 'HTML / CSS / JS', desc: 'Web project with starter files', icon: <Code2 size={24} />, color: 'from-orange-500 to-rose-500' },
  { id: 'react', name: 'React', desc: 'React app with JSX & CDN', icon: <Braces size={24} />, color: 'from-cyan-400 to-blue-500' },
  { id: 'python', name: 'Python', desc: 'Python script template', icon: <FileCode2 size={24} />, color: 'from-yellow-400 to-green-500' },
  { id: 'markdown', name: 'Markdown', desc: 'Documentation project', icon: <FileText size={24} />, color: 'from-purple-400 to-pink-500' },
  { id: 'blank', name: 'Blank', desc: 'Empty project', icon: <FolderOpen size={24} />, color: 'from-gray-400 to-gray-600' },
];

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function countFiles(files: Record<string, any>): number {
  return Object.values(files).filter((f: any) => f.type === 'file').length;
}

// ── Welcome Screen for first-time users ──
function WelcomeScreen({ onSkip }: { onSkip: () => void }) {
  const { setGoogleUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 100);
    const t2 = setTimeout(() => setShowButton(true), 500);
    
    // Web fallback initialization removed to prevent GAPI origin errors
    
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      if (!Capacitor.isNativePlatform()) {
        // Mock web login for local UI testing to bypass Google's strict origin policies
        await new Promise(resolve => setTimeout(resolve, 800));
        setGoogleUser({
          name: "Test User",
          email: "developer@sednium.com",
          picture: "",
        });
        localStorage.setItem('krypton-welcomed', 'true');
        onSkip();
        return;
      }

      const response = await GoogleAuth.signIn();
      const givenName = response.givenName || '';
      const familyName = response.familyName || '';
      setGoogleUser({
        name: response.name || `${givenName} ${familyName}`.trim() || response.email,
        email: response.email,
        picture: response.imageUrl || '',
      });
      localStorage.setItem('krypton-welcomed', 'true');
      onSkip();
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // More robust check for common error objects or strings
      const errorStr = typeof err === 'string' ? err : (err?.message || err?.error || JSON.stringify(err));
      const shouldAlert = !errorStr.includes('cancelled') && !errorStr.includes('closed_by_user');
      
      if (shouldAlert) {
        alert('Google sign-in failed. If you are in a web browser, please ensure the origin is authorized in Google Cloud Console.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-[#050505] flex flex-col items-center justify-center px-8 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/[0.12] blur-[120px] animate-ambient-drift" />
        <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-purple-500/[0.1] blur-[120px] animate-ambient-drift" style={{ animationDelay: '-10s' }} />
      </div>

      <div className={`relative flex flex-col items-center transition-all duration-1000 ease-out ${showContent ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`}>
        {/* App Icon */}
        <div className="mb-8 animate-float">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-3xl animate-pulse-glow" />
            <img src="/icon.png" alt="Krypton IDE" className="relative w-28 h-28 rounded-[2rem] shadow-2xl shadow-black/50 border border-white/10" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-300 to-indigo-400 mb-3 tracking-tight text-center pb-1">Krypton IDE</h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-12 text-center max-w-[300px] font-medium leading-relaxed">
          The premium mobile-first workspace for developers
        </p>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className={`w-full max-w-[320px] flex items-center justify-center space-x-3 bg-gray-50 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/15 py-4 rounded-2xl font-semibold text-lg shadow-2xl active:scale-[0.97] transition-all duration-300 mb-4 disabled:opacity-60 premium-glow ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="20" height="20" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Get Started / Skip */}
        <button
          onClick={() => {
            localStorage.setItem('krypton-welcomed', 'true');
            onSkip();
          }}
          className={`text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm py-2 transition-all duration-300 ${showButton ? 'opacity-100' : 'opacity-0'}`}
        >
          Skip for now
        </button>

        {/* Version */}
        <p className="text-gray-400 dark:text-gray-700 text-[11px] mt-10">v2.0 • Sednium</p>
      </div>
    </div>
  );
}

export function ProjectsDashboard() {
  const { projects, createProject, deleteProject, renameProject, openProject } = useProjectsStore();
  const { googleUser } = useAuthStore();
  const { isGlassmorphismEnabled } = useIdeStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>('html-css-js');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  // Show welcome screen for first-time users
  useEffect(() => {
    const welcomed = localStorage.getItem('krypton-welcomed');
    if (!welcomed) {
      setShowWelcome(true);
    }
  }, []);

  const sortedProjects = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreate = () => {
    const name = newProjectName.trim() || 'Untitled Project';
    const id = createProject(name, selectedTemplate);
    setShowNewProject(false);
    setNewProjectName('');
    openProject(id);
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameProject(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this project? This cannot be undone.')) {
      deleteProject(id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white flex flex-col relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.08] blur-[120px] animate-ambient-drift" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.06] blur-[120px] animate-ambient-drift" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Welcome Screen */}
      {showWelcome && (
        <WelcomeScreen onSkip={() => setShowWelcome(false)} />
      )}

      {/* Header */}
      <div className={`relative z-10 border-x-0 border-t-0 border-b border-gray-200 dark:border-white/5 sticky top-0 ${isGlassmorphismEnabled ? 'glass-panel' : 'bg-white dark:bg-[#161b22]'}`}>
        <div className="relative px-6 pt-[var(--safe-area-top,48px)] pb-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative shadow-lg shadow-blue-500/20 rounded-[1.25rem]">
              <img src="/icon.png" alt="Krypton" className="w-16 h-16 rounded-[1.25rem] border border-white/10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-300 dark:to-indigo-300">Krypton IDE</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {googleUser ? `Good to see you, ${googleUser.name.split(' ')[0]}` : 'Your digital workspace'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-8 relative z-10 mt-6">
        {/* New Project Button */}
        <button 
          onClick={() => setShowNewProject(true)}
          className={`w-full flex items-center justify-center space-x-2 py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all duration-300 mb-8 premium-glow ${isGlassmorphismEnabled ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-gray-900/10 dark:shadow-white/10' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          <Plus size={22} strokeWidth={2.5} />
          <span>Create New Project</span>
        </button>

        {/* Projects List */}
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 opacity-60">
            <img src="/icon.png" alt="" className="w-16 h-16 rounded-2xl opacity-30 dark:opacity-30 mb-5 invert dark:invert-0" />
            <p className="text-lg font-medium text-gray-400 text-center">No projects yet</p>
            <p className="text-sm text-gray-500 mt-1 text-center">Tap "New Project" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Projects</h2>
              <span className="text-xs text-gray-600 dark:text-gray-500 bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full">{sortedProjects.length}</span>
            </div>
            
            {sortedProjects.map((project, i) => {
              const fileCount = countFiles(project.files);
              const templateInfo = templateOptions.find(t => t.id === project.template);
              
              return (
                <div
                  key={project.id}
                  className={`group rounded-2xl p-4 transition-all duration-300 cursor-pointer animate-fade-slide-up relative overflow-hidden ${
                    isGlassmorphismEnabled 
                      ? 'glass-panel glass-panel-active glass-panel-hover' 
                      : 'bg-white dark:bg-[#161b22] border border-gray-200 dark:border-[#30363d]'
                  }`}
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                  onClick={() => {
                    if (editingId !== project.id) openProject(project.id);
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/[0.02] to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${templateInfo?.color || 'from-gray-500 to-gray-700'} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        {templateInfo?.icon || <FolderOpen size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingId === project.id ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleRename(project.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(project.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-black/5 dark:bg-white/10 backdrop-blur-md border border-blue-400 rounded-lg px-3 py-1 text-gray-900 dark:text-white text-base font-semibold w-full focus:outline-none shadow-lg"
                          />
                        ) : (
                          <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg">{project.name}</h3>
                        )}
                        <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center space-x-1">
                            <Clock size={11} />
                            <span>{formatDate(project.updatedAt)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <FileCode2 size={11} />
                            <span>{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(project.id);
                          setEditName(project.name);
                        }}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200 dark:active:bg-white/20"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 dark:active:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={16} className="text-gray-600 ml-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setShowNewProject(false)} />
          
          <div className={`relative w-full max-w-md sm:border rounded-t-[2rem] sm:rounded-[2rem] p-6 max-h-[85vh] overflow-y-auto animate-slide-up shadow-2xl ${isGlassmorphismEnabled ? 'glass-panel border-gray-200 dark:border-white/10 dark:shadow-black/80 shadow-gray-400/50' : 'bg-white dark:bg-[#161b22] border-gray-200 dark:border-[#30363d]'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">New Project</h2>
              <button 
                onClick={() => setShowNewProject(false)} 
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors active:bg-gray-200 dark:active:bg-white/20"
              >
                <X size={22} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Project Name */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2.5 block uppercase tracking-wider">Project Name</label>
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Awesome Project"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full bg-gray-50 dark:bg-[#050505]/50 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white text-lg placeholder-gray-400 dark:placeholder-gray-600 focus:border-blue-500/70 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-semibold"
              />
            </div>

            {/* Template Selection */}
            <div className="mb-8">
              <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 block uppercase tracking-wider">Environment</label>
              <div className="grid grid-cols-2 gap-3">
                {templateOptions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`flex flex-col items-start p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                      selectedTemplate === t.id
                        ? 'border-blue-500/50 bg-blue-50 dark:bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.02]'
                        : 'border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center mb-3 shadow-lg`}>
                      {t.icon}
                    </div>
                    <div className="text-left w-full">
                      <div className="font-bold text-gray-900 dark:text-white/90 mb-1 leading-tight">{t.name}</div>
                      <div className="text-[11px] text-gray-500 leading-snug line-clamp-2">{t.desc}</div>
                    </div>
                    {/* Active Selector Ring */}
                    <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedTemplate === t.id ? 'border-blue-500 bg-blue-500' : 'border-gray-200 dark:border-white/20'}`}>
                      {selectedTemplate === t.id && (
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <button 
              onClick={handleCreate}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all duration-300 premium-glow ${isGlassmorphismEnabled ? 'bg-gray-900 text-white dark:bg-white dark:text-black shadow-gray-900/10 dark:shadow-white/10' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              Create Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
