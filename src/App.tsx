import React, { useEffect, useCallback, useState } from 'react';
import { ProjectsDashboard } from './components/projects/ProjectsDashboard';
import { FolderPicker } from './components/projects/FolderPicker';
import { IdeLayout } from './components/layout/IdeLayout';
import { useProjectsStore } from './store/useProjectsStore';
import { useIdeStore } from './store/useIdeStore';
import { useAiStore } from './store/useAiStore';
import { useAuthStore } from './store/useAuthStore';
import { useExtensionsStore } from './store/useExtensionsStore';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { useBuildStore } from './store/useBuildStore';
import {
  isStorageInitialized,
  readConfig,
  saveConfigNow,
  writeProjectFiles,
} from './lib/fileSystemStorage';

export default function App() {
  const { currentProjectId, projects, closeProject } = useProjectsStore();
  const { loadProject, theme, isHapticsEnabled } = useIdeStore();
  const [storageReady, setStorageReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Check if storage is initialized ──
  useEffect(() => {
    async function boot() {
      if (!isStorageInitialized()) {
        // No base path set — show FolderPicker
        setIsLoading(false);
        return;
      }

      // Storage is already initialized — load all data from disk
      setStorageReady(true);
      try {
        // Load config first
        const config = await readConfig();
        if (config) {
          useIdeStore.getState().setTheme(config.theme || 'vs-dark');
          useIdeStore.getState().setHaptics(config.haptics !== false);
        }

        // Load all stores from disk in parallel
        await Promise.all([
          useProjectsStore.getState().loadFromDisk(),
          useAiStore.getState().loadFromDisk(),
          useAuthStore.getState().loadFromDisk(),
          useExtensionsStore.getState().loadFromDisk(),
        ]);
      } catch (e) {
        console.error('[App] Boot error:', e);
      }
      setIsLoading(false);
    }
    boot();
  }, [storageReady]);

  // ── Handle FolderPicker completion ──
  const handleStorageReady = useCallback(async () => {
    setStorageReady(true);
    setIsLoading(true);

    // Load config to check welcomed state
    const config = await readConfig();
    if (config) {
      useIdeStore.getState().setTheme(config.theme || 'vs-dark');
      useIdeStore.getState().setHaptics(config.haptics !== false);
    }

    // Load stores
    await Promise.all([
      useProjectsStore.getState().loadFromDisk(),
      useAiStore.getState().loadFromDisk(),
      useAuthStore.getState().loadFromDisk(),
      useExtensionsStore.getState().loadFromDisk(),
    ]);

    setIsLoading(false);
  }, []);

  // ── Global Theme Injector ──
  useEffect(() => {
    const isDark = theme === 'vs-dark' || theme === 'hc-black';
    const bgColor = isDark ? '#0d1117' : '#ffffff';
    const style = isDark ? Style.Dark : Style.Light;

    // 1. Update DOM class for Tailwind & UI
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Update Meta Theme Color (drives Android Navigation Bar in WebView)
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', bgColor);
    }

    // 3. Update Capacitor Status Bar
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style }).catch(e => console.warn('[App] StatusBar style error:', e));
      if (Capacitor.getPlatform() === 'android') {
        StatusBar.setBackgroundColor({ color: bgColor }).catch(e => console.warn('[App] StatusBar background error:', e));
      }
    }
  }, [theme]);

  useEffect(() => {
    if (currentProjectId && projects[currentProjectId]) {
      loadProject(projects[currentProjectId].files);
    }
  }, [currentProjectId]);

  // ── Global Build Status Poller ──
  const { buildStatus, pollStatus } = useBuildStore();
  useEffect(() => {
    let interval: any;
    const project = currentProjectId ? projects[currentProjectId] : null;
    
    if (buildStatus === 'building' && project?.githubRepo) {
      const [owner, repoName] = project.githubRepo.split('/');
      interval = setInterval(() => {
        pollStatus(owner, repoName);
      }, 5000);
    }
    
    return () => clearInterval(interval);
  }, [buildStatus, currentProjectId, projects, pollStatus]);

  // ── Capacitor native initialization ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    document.documentElement.classList.add('is-native');
    if (Capacitor.getPlatform() === 'android') {
      document.documentElement.classList.add('is-android');
    }

    // Status bar: dark theme by default
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0d1117' }).catch(() => {});

    // Splash screen: hide after app renders
    SplashScreen.hide().catch(() => {});

    // Keyboard: native resize mode
    Keyboard.setResizeMode({ mode: 'native' as any }).catch(() => {});

    // Android back button handler
    const backHandler = CapApp.addListener('backButton', () => {
      const ide = useIdeStore.getState();
      const proj = useProjectsStore.getState();

      if (ide.isPreviewOpen) {
        ide.setPreviewOpen(false);
      } else if (ide.isCommandPaletteOpen) {
        ide.setCommandPaletteOpen(false);
      } else if (ide.isSidebarOpen) {
        ide.toggleSidebar();
      } else if (proj.currentProjectId) {
        saveCurrentProject();
        proj.closeProject();
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backHandler.then(h => h.remove());
    };
  }, []);

  // ── Auto-save: sync IDE files back to project store + disk ──
  const saveCurrentProject = useCallback(async () => {
    const pid = useProjectsStore.getState().currentProjectId;
    if (!pid) return;
    const currentFiles = useIdeStore.getState().files;
    if (Object.keys(currentFiles).length > 0) {
      useProjectsStore.getState().updateProjectFiles(pid, currentFiles);
      // Also write files directly to disk (immediate, not debounced)
      try {
        await writeProjectFiles(pid, currentFiles);
      } catch (e) {
        console.error('[App] Save project to disk error:', e);
      }
    }

    // Also persist config (theme, haptics, etc.)
    try {
      const config = await readConfig();
      if (config) {
        config.theme = useIdeStore.getState().theme;
        config.haptics = useIdeStore.getState().isHapticsEnabled;
        await saveConfigNow(config);
      }
    } catch (e) {
      console.error('[App] Save config error:', e);
    }
  }, []);

  useEffect(() => {
    // Save on visibility change (switching tabs/apps — critical for mobile)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentProject();
      }
    };

    // Save on window blur (alt-tab, switching apps)
    const handleBlur = () => saveCurrentProject();

    // Save before browser closes
    const handleBeforeUnload = () => saveCurrentProject();

    // Periodic auto-save every 30 seconds
    const interval = setInterval(saveCurrentProject, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveCurrentProject]);

  // ── Persist theme and haptics changes to config ──
  useEffect(() => {
    if (!storageReady) return;
    const persistSettings = async () => {
      try {
        const config = await readConfig();
        if (config) {
          config.theme = theme;
          config.haptics = isHapticsEnabled;
          await saveConfigNow(config);
        }
      } catch (e) {
        console.error('[App] Persist settings error:', e);
      }
    };
    persistSettings();
  }, [theme, isHapticsEnabled, storageReady]);

  const handleBackToProjects = () => {
    saveCurrentProject();
    closeProject();
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // ── FolderPicker gate ──
  if (!storageReady) {
    return <FolderPicker onComplete={handleStorageReady} />;
  }

  if (!currentProjectId) {
    return <ProjectsDashboard />;
  }

  return <IdeLayout onBackToProjects={handleBackToProjects} />;
}
