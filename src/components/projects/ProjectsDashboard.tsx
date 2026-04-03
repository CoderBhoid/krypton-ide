import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FolderOpen, Clock, FileCode2, ChevronRight, X, Code2, FileText, Braces } from 'lucide-react';
import { useProjectsStore, type ProjectTemplate } from '../../store/useProjectsStore';
import { useAuthStore } from '../../store/useAuthStore';

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
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Initialize Google Identity Services
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as any).google?.accounts?.id?.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  const handleGoogleResponse = (response: any) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      setGoogleUser({
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
      });
      localStorage.setItem('krypton-welcomed', 'true');
      onSkip();
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
    setIsLoading(false);
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setIsLoading(false);
        }
      });
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0d1117] flex flex-col items-center justify-center px-8">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-500/[0.05] blur-[100px]" />
      </div>

      <div className={`relative flex flex-col items-center transition-all duration-700 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* App Icon */}
        <div className="mb-8 animate-pulse-glow rounded-3xl overflow-hidden">
          <img src="/icon.png" alt="Krypton IDE" className="w-24 h-24 rounded-3xl shadow-2xl" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight text-center">Krypton IDE</h1>
        <p className="text-gray-400 text-base mb-12 text-center max-w-[280px]">
          The mobile-first code editor for developers on the go
        </p>

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className={`w-full max-w-[300px] flex items-center justify-center space-x-3 bg-white text-gray-800 py-3.5 rounded-2xl font-semibold text-base shadow-xl shadow-white/10 active:scale-[0.97] transition-all duration-200 mb-4 disabled:opacity-60 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
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
          className={`text-gray-400 hover:text-gray-200 text-sm py-2 transition-all duration-300 ${showButton ? 'opacity-100' : 'opacity-0'}`}
        >
          Skip for now
        </button>

        {/* Version */}
        <p className="text-gray-700 text-[11px] mt-10">v1.1 • Sednium</p>
      </div>
    </div>
  );
}

export function ProjectsDashboard() {
  const { projects, createProject, deleteProject, renameProject, openProject } = useProjectsStore();
  const { googleUser } = useAuthStore();
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
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Welcome Screen */}
      {showWelcome && (
        <WelcomeScreen onSkip={() => setShowWelcome(false)} />
      )}

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative px-5 pt-12 pb-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <img src="/icon.png" alt="Krypton" className="w-14 h-14 rounded-2xl shadow-lg shadow-blue-500/25" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Krypton IDE</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {googleUser ? `Welcome, ${googleUser.name.split(' ')[0]}` : 'Mobile Code Editor'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-8">
        {/* New Project Button */}
        <button 
          onClick={() => setShowNewProject(true)}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3.5 rounded-xl font-semibold text-base shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all duration-200 mb-6"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span>New Project</span>
        </button>

        {/* Projects List */}
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 opacity-60">
            <img src="/icon.png" alt="" className="w-16 h-16 rounded-2xl opacity-30 mb-5" />
            <p className="text-lg font-medium text-gray-400 text-center">No projects yet</p>
            <p className="text-sm text-gray-500 mt-1 text-center">Tap "New Project" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Your Projects</h2>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{sortedProjects.length}</span>
            </div>
            
            {sortedProjects.map((project, i) => {
              const fileCount = countFiles(project.files);
              const templateInfo = templateOptions.find(t => t.id === project.template);
              
              return (
                <div
                  key={project.id}
                  className="group bg-[#161b22] border border-[#21262d] rounded-xl p-4 active:bg-[#1c2333] transition-all duration-200 cursor-pointer animate-fade-slide-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                  onClick={() => {
                    if (editingId !== project.id) openProject(project.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${templateInfo?.color || 'from-gray-500 to-gray-700'} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        {templateInfo?.icon || <FolderOpen size={20} />}
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
                            className="bg-[#0d1117] border border-blue-500 rounded px-2 py-0.5 text-white text-base w-full focus:outline-none"
                          />
                        ) : (
                          <h3 className="font-semibold text-white truncate text-base">{project.name}</h3>
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
                        className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 active:bg-white/20"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 active:bg-red-500/20"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowNewProject(false)} />
          
          <div className="relative w-full max-w-md bg-[#161b22] border-t sm:border border-[#21262d] rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Project</h2>
              <button onClick={() => setShowNewProject(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Project Name */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-400 mb-2 block">Project Name</label>
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Awesome Project"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>

            {/* Template Selection */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-400 mb-3 block">Template</label>
              <div className="space-y-2">
                {templateOptions.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                      selectedTemplate === t.id
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/5'
                        : 'border-[#21262d] bg-[#0d1117] hover:border-[#30363d] active:bg-[#1c2333]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                      {t.icon}
                    </div>
                    <div>
                      <div className="font-medium text-white">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.desc}</div>
                    </div>
                    {selectedTemplate === t.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Create Button */}
            <button 
              onClick={handleCreate}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white py-3.5 rounded-xl font-semibold text-base shadow-lg active:scale-[0.98] transition-all duration-200"
            >
              Create Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
