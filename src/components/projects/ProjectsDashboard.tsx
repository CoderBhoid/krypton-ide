import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, FolderOpen, Clock, FileCode2, ChevronRight, X, Code2, FileText, Braces, Github, Loader2, Smartphone, MonitorPlay, Server, TerminalSquare, Sparkles } from 'lucide-react';
import { useProjectsStore } from '../../store/useProjectsStore';
import { type ProjectTemplate } from '../../lib/projectTemplates';
import { useAuthStore } from '../../store/useAuthStore';
import { createRepo, listRepos, pullRepo, type GitHubRepo } from '../../lib/githubService';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

import { useIdeStore } from '../../store/useIdeStore';
import { readConfig, saveConfigNow } from '../../lib/fileSystemStorage';

const GOOGLE_CLIENT_ID = '228869160750-nqir9tev4919koqbcsrnhfo5puorqtqa.apps.googleusercontent.com';



const templateCategories = [
  {
    id: 'mobile',
    name: 'Android & Mobile',
    icon: <Smartphone size={18} />,
    templates: [
      { id: 'android-java', name: 'Android (Java)', desc: 'Standard Android app with Java & XML', icon: <Code2 size={24} />, color: 'from-green-500 to-emerald-700' },
      { id: 'android-kotlin', name: 'Android (Kotlin)', desc: 'Modern Android app with Kotlin', icon: <Code2 size={24} />, color: 'from-purple-500 to-indigo-700' },
      { id: 'android-compose', name: 'Android (Compose)', desc: 'Jetpack Compose native UI', icon: <Braces size={24} />, color: 'from-blue-400 to-indigo-600' },
    ]
  },
  {
    id: 'web',
    name: 'Web Frontend',
    icon: <MonitorPlay size={18} />,
    templates: [
      { id: 'html-css-js', name: 'HTML / JS', desc: 'Web project with starter files', icon: <Code2 size={24} />, color: 'from-orange-500 to-rose-500' },
      { id: 'react', name: 'React', desc: 'React app with JSX & CDN', icon: <Braces size={24} />, color: 'from-cyan-400 to-blue-500' },
      { id: 'vite-react', name: 'Vite + React', desc: 'Modern React app with Vite', icon: <Braces size={24} />, color: 'from-indigo-500 to-purple-600' },
      { id: 'nextjs', name: 'Next.js', desc: 'Full-stack React framework', icon: <MonitorPlay size={24} />, color: 'from-gray-700 to-black' },
    ]
  },
  {
    id: 'backend',
    name: 'Backend & APIs',
    icon: <Server size={18} />,
    templates: [
      { id: 'python-fastapi', name: 'FastAPI', desc: 'High-performance Python API', icon: <Server size={24} />, color: 'from-teal-400 to-emerald-500' },
      { id: 'nodejs-express', name: 'Node + Express', desc: 'Express.js backend server', icon: <Server size={24} />, color: 'from-green-600 to-green-800' },
    ]
  },
  {
    id: 'cli',
    name: 'CLI & Scripts',
    icon: <TerminalSquare size={18} />,
    templates: [
      { id: 'python', name: 'Python Script', desc: 'Standalone Python script', icon: <TerminalSquare size={24} />, color: 'from-yellow-400 to-amber-600' },
      { id: 'rust-cli', name: 'Rust CLI', desc: 'Command line tool in Rust', icon: <TerminalSquare size={24} />, color: 'from-orange-600 to-red-700' },
      { id: 'java-cli', name: 'Java Console', desc: 'Simple Java app', icon: <TerminalSquare size={24} />, color: 'from-red-500 to-orange-500' },
      { id: 'kotlin-cli', name: 'Kotlin Console', desc: 'Simple Kotlin app', icon: <TerminalSquare size={24} />, color: 'from-purple-500 to-blue-500' },
    ]
  },
  {
    id: 'other',
    name: 'Blank',
    icon: <FileText size={18} />,
    templates: [
      { id: 'markdown', name: 'Markdown', desc: 'Documentation project', icon: <FileText size={24} />, color: 'from-purple-400 to-pink-500' },
      { id: 'blank', name: 'Blank', desc: 'Empty workspace', icon: <FolderOpen size={24} />, color: 'from-gray-400 to-gray-600' },
    ]
  }
];

// Flat list for easy lookup
const templateOptions = templateCategories.flatMap(c => c.templates);

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
  const { setGoogleUser, setGoogleAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showButton, setShowButton] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 100);
    const t2 = setTimeout(() => setShowButton(true), 500);
    
    try {
      GoogleAuth.initialize({
        clientId: GOOGLE_CLIENT_ID,
        scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
        grantOfflineAccess: true,
      });
    } catch (e) {
      console.warn('GoogleAuth init failed', e);
    }
    
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
        readConfig().then(c => { if (c) { c.welcomed = true; saveConfigNow(c); } });
        onSkip();
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
      if (accessToken) {
        setGoogleAuth(user, accessToken);
      } else {
        setGoogleUser(user);
      }
      readConfig().then(c => { if (c) { c.welcomed = true; saveConfigNow(c); } });
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
            <div 
              className="relative w-28 h-28 rounded-[2rem] shadow-2xl shadow-black/50 border border-white/10 bg-cover bg-center" 
              style={{ backgroundImage: "url('/icon.png')" }} 
            />
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
          className={`w-full max-w-[320px] flex items-center justify-center space-x-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a] py-4 rounded-2xl font-semibold text-lg shadow-xl active:scale-[0.97] transition-all duration-300 mb-4 disabled:opacity-60 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
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
            readConfig().then(c => { if (c) { c.welcomed = true; saveConfigNow(c); } });
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
  const { projects, createProject, deleteProject, renameProject, openProject, setProjectGitHubRepo } = useProjectsStore();
  const { googleUser, githubUser, githubToken } = useAuthStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>('html-css-js');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [linkGitHub, setLinkGitHub] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCloneRepo, setShowCloneRepo] = useState(false);
  const [cloneSearch, setCloneSearch] = useState('');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [isCloning, setIsCloning] = useState<string | null>(null);

  // Show welcome screen for first-time users
  useEffect(() => {
    readConfig().then(config => {
      if (config && !config.welcomed) {
        setShowWelcome(true);
      }
    });
  }, []);

  const sortedProjects = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const name = newProjectName.trim() || 'Untitled Project';
      const id = createProject(name, selectedTemplate);
      
      if (linkGitHub && githubToken && githubUser) {
        try {
          // Name formatting: replace spaces/special chars with hyphens
          const repoSafeName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const repo = await createRepo(repoSafeName, `Created with Krypton IDE`, true);
          setProjectGitHubRepo(id, repo.full_name);
          // Note: Actual push will happen automatically later when user opens project and saves/pushes
        } catch (e: any) {
          console.error('Failed to create GitHub repo', e);
          alert(`Project created, but GitHub repo creation failed: ${e.message}`);
        }
      }

      setShowNewProject(false);
      setNewProjectName('');
      setLinkGitHub(true);
      openProject(id);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClone = async (repo: GitHubRepo) => {
    if (isCloning) return;
    setIsCloning(repo.full_name);
    try {
      const id = createProject(repo.name, 'blank');
      setProjectGitHubRepo(id, repo.full_name);
      openProject(id);
      
      const [owner, name] = repo.full_name.split('/');
      await pullRepo(owner, name);
      
      setShowCloneRepo(false);
    } catch (e: any) {
      console.error('Clone failed:', e);
      alert(`Clone failed: ${e.message}`);
    } finally {
      setIsCloning(null);
    }
  };

  const loadGitHubRepos = async () => {
    if (!githubToken) return;
    setLoadingRepos(true);
    try {
      const r = await listRepos();
      setRepos(r);
    } catch (e) {
      console.error(e);
    }
    setLoadingRepos(false);
  };

  useEffect(() => {
    if (showCloneRepo && repos.length === 0) {
      loadGitHubRepos();
    }
  }, [showCloneRepo, githubToken]);

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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.15] blur-[100px] animate-ambient-drift" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/[0.12] blur-[100px] animate-ambient-drift" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Welcome Screen */}
      {showWelcome && (
        <WelcomeScreen onSkip={() => setShowWelcome(false)} />
      )}

      {/* Header */}
      <div className="relative z-10 px-6 pt-[var(--safe-area-top,48px)] pb-4">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative shadow-lg shadow-blue-500/20 rounded-[1.25rem]">
            <div 
              className="w-16 h-16 rounded-[1.25rem] border border-white/10 bg-cover bg-center" 
              style={{ backgroundImage: "url('/icon.png')" }} 
            />
          </div>
          <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 pb-1">Krypton IDE</h1>
              <p className="text-sm text-gray-400 font-medium tracking-wide">
                {googleUser ? `Good to see you, ${googleUser.name.split(' ')[0]}` : 'Your digital workspace'}
              </p>
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-8 relative z-10 mt-6">
        {/* Action Buttons */}
        <div className="flex space-x-3 mb-8">
          <button 
            onClick={() => setShowNewProject(true)}
            className="flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl font-bold text-[15px] shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 border border-white/10"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span>New Project</span>
          </button>
          
          <button 
            onClick={() => setShowCloneRepo(true)}
            className="flex-1 flex items-center justify-center space-x-2 py-4 rounded-2xl font-bold text-[15px] shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-all duration-300 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 border border-white/10"
          >
            <Github size={20} strokeWidth={2.5} />
            <span>Clone Repo</span>
          </button>
        </div>

        {/* Projects List */}
        {sortedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 opacity-60">
            <div 
              className="w-16 h-16 rounded-[1.25rem] opacity-30 mb-5 bg-cover bg-center" 
              style={{ backgroundImage: "url('/icon.png')" }} 
            />
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
                  className="group rounded-2xl p-4 transition-all duration-300 cursor-pointer animate-fade-slide-up relative overflow-hidden bg-[#111] border border-white/10 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.99]"
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
                            className="bg-gray-50 dark:bg-black/40 border border-blue-400 rounded-lg px-3 py-1 text-gray-900 dark:text-white text-base font-semibold w-full focus:outline-none shadow-lg"
                          />
                        ) : (
                          <h3 className="font-bold text-white truncate text-lg group-hover:text-blue-300 transition-colors">{project.name}</h3>
                        )}
                        <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
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
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ChevronRight size={16} className="text-gray-500 group-hover:text-blue-400 ml-1 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowNewProject(false)} />
          
          <div className="relative w-full max-w-4xl sm:border rounded-t-[2rem] sm:rounded-[2rem] p-6 max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl bg-[#0a0a0a] border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                <Sparkles className="text-blue-400" size={24} />
                <span>New Project</span>
              </h2>
              <button 
                onClick={() => setShowNewProject(false)} 
                className="p-2 text-gray-400 hover:bg-white/10 rounded-full transition-colors active:bg-white/20"
              >
                <X size={22} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Project Name */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-400 mb-2.5 block uppercase tracking-wider">Project Name</label>
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Awesome Project"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-full bg-[#111] border border-white/10 rounded-2xl px-5 py-4 text-white text-lg placeholder-gray-600 focus:border-blue-500/70 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-semibold shadow-inner shadow-black/50"
              />
            </div>

            {/* Template Selection */}
            <div className="mb-8">
              <label className="text-sm font-semibold text-gray-400 mb-3 block uppercase tracking-wider">Choose a Template</label>
              <div className="space-y-6">
                {templateCategories.map((category) => (
                  <div key={category.id}>
                    <h3 className="flex items-center space-x-2 text-[13px] font-bold text-gray-300 mb-3 ml-1">
                      {category.icon}
                      <span>{category.name}</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {category.templates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id as ProjectTemplate)}
                          className={`flex flex-col items-start p-3 sm:p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                            selectedTemplate === t.id
                              ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.02]'
                              : 'border-white/5 bg-[#111] hover:bg-white/5 hover:border-white/20'
                          }`}
                        >
                          {/* Glare effect */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 dark:via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                          
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${t.color} flex items-center justify-center mb-3 shadow-lg transform transition-transform group-hover:scale-110`}>
                            {React.cloneElement(t.icon as React.ReactElement, { size: 20 })}
                          </div>
                          <div className="text-left w-full">
                            <div className="font-bold text-white mb-1 leading-tight text-sm sm:text-base">{t.name}</div>
                            <div className="text-[10px] sm:text-[11px] text-gray-400 leading-snug line-clamp-2">{t.desc}</div>
                          </div>
                          {/* Active Selector Ring */}
                          <div className={`absolute top-4 right-4 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedTemplate === t.id ? 'border-blue-500 bg-blue-500' : 'border-white/20 bg-[#222]'}`}>
                            {selectedTemplate === t.id && (
                              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub Auto-link */}
            {githubToken && githubUser && (
              <div className="mb-8">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={linkGitHub}
                      onChange={(e) => setLinkGitHub(e.target.checked)}
                    />
                    <div className="w-6 h-6 border-2 border-gray-600 rounded-md peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-colors bg-[#111]" />
                    <svg viewBox="0 0 14 10" className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 5l4 4 8-8" />
                    </svg>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Github size={18} className="text-gray-300 group-hover:text-white transition-colors" />
                    <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                      Create Private GitHub Repository
                    </span>
                  </div>
                </label>
              </div>
            )}

            <button 
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 border border-white/10 text-white hover:from-blue-500 hover:to-indigo-500 mt-4 flex items-center justify-center space-x-2 disabled:opacity-70"
            >
              {isCreating ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Clone Repository Modal */}
      {showCloneRepo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowCloneRepo(false)} />
          
          <div className="relative w-full max-w-2xl sm:border rounded-t-[2rem] sm:rounded-[2rem] p-6 max-h-[85vh] flex flex-col animate-slide-up shadow-2xl bg-[#0a0a0a] border-white/10">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-xl font-bold tracking-tight flex items-center space-x-2 text-white">
                <Github size={24} className="text-emerald-400" />
                <span>Clone from GitHub</span>
              </h2>
              <button 
                onClick={() => setShowCloneRepo(false)} 
                className="p-2 text-gray-400 hover:bg-white/10 rounded-full transition-colors active:bg-white/20"
              >
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            {!githubToken ? (
              <div className="text-center py-12 flex-1">
                <Github size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-bold mb-2">GitHub Not Connected</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                  To clone repositories, you first need to connect your GitHub account in the Source Control panel.
                </p>
                <button
                  onClick={() => setShowCloneRepo(false)}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="mb-4">
                  <input
                    value={cloneSearch}
                    onChange={(e) => setCloneSearch(e.target.value)}
                    placeholder="Search your repositories..."
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:border-emerald-500/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner shadow-black/50"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-[300px] border border-white/10 rounded-xl bg-[#111]">
                  {loadingRepos ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 size={24} className="animate-spin text-gray-500" />
                    </div>
                  ) : repos.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-gray-500">
                      No matching repositories found.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {repos
                        .filter(r => r.name.toLowerCase().includes(cloneSearch.toLowerCase()) || r.full_name.toLowerCase().includes(cloneSearch.toLowerCase()))
                        .map(repo => (
                        <div key={repo.full_name} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group">
                          <div className="flex-1 min-w-0 mr-4">
                            <h4 className="font-semibold text-white text-base truncate group-hover:text-emerald-400 transition-colors">{repo.name}</h4>
                            <p className="text-gray-500 text-xs truncate mt-0.5">{repo.full_name}</p>
                          </div>
                          <button
                            onClick={() => handleClone(repo)}
                            disabled={isCloning !== null}
                            className="bg-[#2ea043] hover:bg-[#2c974b] text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center space-x-2 disabled:opacity-50 transition-colors shrink-0"
                          >
                            {isCloning === repo.full_name ? <Loader2 size={16} className="animate-spin" /> : <MonitorPlay size={16} />}
                            <span>{isCloning === repo.full_name ? 'Cloning...' : 'Clone'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
