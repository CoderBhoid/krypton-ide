import React, { useEffect, useCallback } from 'react';
import { ProjectsDashboard } from './components/projects/ProjectsDashboard';
import { IdeLayout } from './components/layout/IdeLayout';
import { useProjectsStore } from './store/useProjectsStore';
import { useIdeStore } from './store/useIdeStore';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';

export default function App() {
  const { currentProjectId, projects, closeProject } = useProjectsStore();
  const { loadProject } = useIdeStore();

  // When a project is opened, load its files into the IDE store
  useEffect(() => {
    if (currentProjectId && projects[currentProjectId]) {
      loadProject(projects[currentProjectId].files);
    }
  }, [currentProjectId]);

  // ── Capacitor native initialization ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

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

  // ── Auto-save: sync IDE files back to project store ──
  const saveCurrentProject = useCallback(() => {
    const pid = useProjectsStore.getState().currentProjectId;
    if (!pid) return;
    const currentFiles = useIdeStore.getState().files;
    if (Object.keys(currentFiles).length > 0) {
      useProjectsStore.getState().updateProjectFiles(pid, currentFiles);
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

  const handleBackToProjects = () => {
    saveCurrentProject();
    closeProject();
  };

  if (!currentProjectId) {
    return <ProjectsDashboard />;
  }

  return <IdeLayout onBackToProjects={handleBackToProjects} />;
}
