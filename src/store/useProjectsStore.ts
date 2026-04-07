import { create } from 'zustand';
import type { FileNode } from './useIdeStore';
import {
  saveProjectMeta,
  writeProjectFiles,
  writeProjectFilesDebounced,
  readProjectFiles,
  loadAllProjectMetas,
  deleteProjectFolder,
  type ProjectMeta,
} from '../lib/fileSystemStorage';
import { type ProjectTemplate, getTemplateFiles } from '../lib/projectTemplates';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: Record<string, FileNode>;
  template: ProjectTemplate;
  githubRepo?: string;
}

interface ProjectsState {
  projects: Record<string, Project>;
  currentProjectId: string | null;
  isLoaded: boolean;
  
  createProject: (name: string, template: ProjectTemplate) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, newName: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  updateProjectFiles: (projectId: string, files: Record<string, FileNode>) => void;
  getCurrentProject: () => Project | null;
  loadFromDisk: () => Promise<void>;
  saveProjectToDisk: (projectId: string) => Promise<void>;
  setProjectGitHubRepo: (projectId: string, repo: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

export const useProjectsStore = create<ProjectsState>()(
  (set, get) => ({
    projects: {},
    currentProjectId: null,
    isLoaded: false,

    loadFromDisk: async () => {
      try {
        const metas = await loadAllProjectMetas();
        const projects: Record<string, Project> = {};

        for (const meta of metas) {
          const loadedFiles = await readProjectFiles(meta.id);
          const files = loadedFiles || { root: { id: 'root', name: meta.name, type: 'folder', parentId: null, children: [] } };
          
          if (files.root) {
            files.root.name = meta.name;
          }

          projects[meta.id] = {
            id: meta.id,
            name: meta.name,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
            files: files,
            template: meta.template as ProjectTemplate,
            githubRepo: meta.githubRepo,
          };
        }

        set({ projects, isLoaded: true });
      } catch (e) {
        console.error('[Projects] Failed to load from disk:', e);
        set({ isLoaded: true });
      }
    },

    createProject: (name, template) => {
      const id = generateId();
      const now = Date.now();
      const files = getTemplateFiles(template);
      
      // Update root folder name to project name
      files.root = { ...files.root, name };

      const project: Project = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        files,
        template,
      };

      set((state) => ({
        projects: { ...state.projects, [id]: project },
      }));

      // Save to disk
      const meta: ProjectMeta = { id, name, createdAt: now, updatedAt: now, template };
      saveProjectMeta(meta).catch(e => console.error('[Projects] Save meta error:', e));
      writeProjectFiles(id, files).catch(e => console.error('[Projects] Write files error:', e));

      return id;
    },

    deleteProject: (id) => {
      set((state) => {
        const { [id]: _, ...rest } = state.projects;
        return {
          projects: rest,
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        };
      });

      // Delete from disk
      deleteProjectFolder(id).catch(e => console.error('[Projects] Delete error:', e));
    },

    renameProject: (id, newName) => {
      set((state) => {
        const project = state.projects[id];
        if (!project) return state;

        const updated = {
          ...project,
          name: newName,
          updatedAt: Date.now(),
          files: {
            ...project.files,
            root: { ...project.files.root, name: newName },
          },
        };

        // Save to disk
        const meta: ProjectMeta = {
          id, name: newName,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          template: updated.template,
          githubRepo: updated.githubRepo,
        };
        saveProjectMeta(meta).catch(e => console.error('[Projects] Rename save error:', e));

        return {
          projects: { ...state.projects, [id]: updated },
        };
      });
    },

    openProject: (id) => {
      set({ currentProjectId: id });
      // Load AI sessions scoped to this project
      import('./useAiStore').then(({ useAiStore }) => {
        useAiStore.getState().switchProject(id);
      });
    },

    closeProject: () => {
      // Save current project files before closing
      const state = get();
      if (state.currentProjectId && state.projects[state.currentProjectId]) {
        // Files should already be synced via updateProjectFiles
      }
      set({ currentProjectId: null });
      // Clear AI sessions — no project open means no sessions
      import('./useAiStore').then(({ useAiStore }) => {
        useAiStore.getState().clearSessions();
      });
    },

    updateProjectFiles: (projectId, files) => {
      set((state) => ({
        projects: {
          ...state.projects,
          [projectId]: {
            ...state.projects[projectId],
            files,
            updatedAt: Date.now(),
          },
        },
      }));

      // Debounced write to disk
      writeProjectFilesDebounced(projectId, files);

      // Also update meta timestamp
      const project = get().projects[projectId];
      if (project) {
        const meta: ProjectMeta = {
          id: projectId,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: Date.now(),
          template: project.template,
          githubRepo: project.githubRepo,
        };
        saveProjectMeta(meta).catch(e => console.error('[Projects] Meta update error:', e));
      }
    },

    getCurrentProject: () => {
      const state = get();
      if (!state.currentProjectId) return null;
      return state.projects[state.currentProjectId] || null;
    },

    saveProjectToDisk: async (projectId) => {
      const project = get().projects[projectId];
      if (!project) return;

      const meta: ProjectMeta = {
        id: projectId,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        template: project.template,
        githubRepo: project.githubRepo,
      };

      await saveProjectMeta(meta);
      await writeProjectFiles(projectId, project.files);
    },

    setProjectGitHubRepo: (projectId, repo) => {
      set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;

        const updated = { ...project, githubRepo: repo };
        
        const meta: ProjectMeta = {
          id: projectId,
          name: updated.name,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          template: updated.template,
          githubRepo: updated.githubRepo,
        };
        saveProjectMeta(meta).catch(e => console.error('[Projects] Meta update error:', e));

        return {
          projects: { ...state.projects, [projectId]: updated }
        };
      });
    },
  })
);
