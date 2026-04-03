import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileNode } from './useIdeStore';

export type ProjectTemplate = 'blank' | 'html-css-js' | 'react' | 'python' | 'markdown';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: Record<string, FileNode>;
  template: ProjectTemplate;
}

interface ProjectsState {
  projects: Record<string, Project>;
  currentProjectId: string | null;
  
  createProject: (name: string, template: ProjectTemplate) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, newName: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  updateProjectFiles: (projectId: string, files: Record<string, FileNode>) => void;
  getCurrentProject: () => Project | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

function getTemplateFiles(template: ProjectTemplate): Record<string, FileNode> {
  const root: FileNode = {
    id: 'root',
    name: 'Project',
    type: 'folder',
    parentId: null,
    children: [],
  };

  switch (template) {
    case 'html-css-js': {
      root.children = ['index_html', 'style_css', 'app_js'];
      return {
        root,
        index_html: {
          id: 'index_html',
          name: 'index.html',
          type: 'file',
          content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="app">\n    <h1>Hello World!</h1>\n    <p>Start coding your app here.</p>\n    <button id="btn">Click Me</button>\n  </div>\n  <script src="app.js"></script>\n</body>\n</html>',
          parentId: 'root',
          language: 'html',
        },
        style_css: {
          id: 'style_css',
          name: 'style.css',
          type: 'file',
          content: '* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  background: #0f0f0f;\n  color: #e0e0e0;\n  min-height: 100vh;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n}\n\n#app {\n  text-align: center;\n  padding: 2rem;\n  background: #1a1a2e;\n  border-radius: 16px;\n  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);\n}\n\nh1 {\n  background: linear-gradient(135deg, #667eea, #764ba2);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  margin-bottom: 0.5rem;\n}\n\nbutton {\n  margin-top: 1rem;\n  padding: 12px 32px;\n  background: linear-gradient(135deg, #667eea, #764ba2);\n  color: white;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n  transition: transform 0.2s, box-shadow 0.2s;\n}\n\nbutton:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);\n}\n',
          parentId: 'root',
          language: 'css',
        },
        app_js: {
          id: 'app_js',
          name: 'app.js',
          type: 'file',
          content: 'document.addEventListener("DOMContentLoaded", () => {\n  const btn = document.getElementById("btn");\n  let count = 0;\n\n  btn.addEventListener("click", () => {\n    count++;\n    btn.textContent = `Clicked ${count} time${count !== 1 ? "s" : ""}`;\n  });\n\n  console.log("App initialized!");\n});\n',
          parentId: 'root',
          language: 'javascript',
        },
      };
    }

    case 'react': {
      root.children = ['index_html_r', 'app_jsx', 'style_css_r'];
      return {
        root,
        index_html_r: {
          id: 'index_html_r',
          name: 'index.html',
          type: 'file',
          content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>\n  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div id="root"></div>\n  <script type="text/babel" src="app.jsx"></script>\n</body>\n</html>',
          parentId: 'root',
          language: 'html',
        },
        app_jsx: {
          id: 'app_jsx',
          name: 'app.jsx',
          type: 'file',
          content: 'const { useState } = React;\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="app">\n      <h1>React App</h1>\n      <p>You clicked {count} times</p>\n      <button onClick={() => setCount(c => c + 1)}>\n        Click me\n      </button>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n',
          parentId: 'root',
          language: 'javascript',
        },
        style_css_r: {
          id: 'style_css_r',
          name: 'style.css',
          type: 'file',
          content: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f0f0f;\n  color: #e0e0e0;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n\n.app {\n  text-align: center;\n  padding: 2rem;\n  background: #1a1a2e;\n  border-radius: 16px;\n  box-shadow: 0 20px 60px rgba(0,0,0,0.5);\n}\n\nh1 {\n  color: #61dafb;\n}\n\nbutton {\n  margin-top: 1rem;\n  padding: 12px 32px;\n  background: #61dafb;\n  color: #000;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n}\n',
          parentId: 'root',
          language: 'css',
        },
      };
    }

    case 'python': {
      root.children = ['main_py', 'readme_md_p'];
      return {
        root,
        main_py: {
          id: 'main_py',
          name: 'main.py',
          type: 'file',
          content: '# Krypton IDE - Python Project\n\ndef greet(name: str) -> str:\n    """Return a greeting message."""\n    return f"Hello, {name}! Welcome to Krypton IDE."\n\ndef main():\n    print(greet("Developer"))\n    \n    # Example: Simple calculator\n    numbers = [1, 2, 3, 4, 5]\n    total = sum(numbers)\n    average = total / len(numbers)\n    \n    print(f"Numbers: {numbers}")\n    print(f"Sum: {total}")\n    print(f"Average: {average}")\n\nif __name__ == "__main__":\n    main()\n',
          parentId: 'root',
          language: 'python',
        },
        readme_md_p: {
          id: 'readme_md_p',
          name: 'README.md',
          type: 'file',
          content: '# Python Project\n\nA Python project created with Krypton IDE.\n\n## Getting Started\n\nEdit `main.py` to start coding!\n',
          parentId: 'root',
          language: 'markdown',
        },
      };
    }

    case 'markdown': {
      root.children = ['readme_md_m', 'notes_md'];
      return {
        root,
        readme_md_m: {
          id: 'readme_md_m',
          name: 'README.md',
          type: 'file',
          content: '# My Document\n\nStart writing your markdown content here.\n\n## Features\n\n- Easy to write\n- Supports formatting\n- Great for documentation\n\n## Code Example\n\n```javascript\nconsole.log("Hello from Krypton!");\n```\n',
          parentId: 'root',
          language: 'markdown',
        },
        notes_md: {
          id: 'notes_md',
          name: 'notes.md',
          type: 'file',
          content: '# Notes\n\n- [ ] First task\n- [ ] Second task\n- [x] Completed task\n',
          parentId: 'root',
          language: 'markdown',
        },
      };
    }

    case 'blank':
    default: {
      return { root };
    }
  }
}

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: {},
      currentProjectId: null,

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
      },

      renameProject: (id, newName) => {
        set((state) => ({
          projects: {
            ...state.projects,
            [id]: {
              ...state.projects[id],
              name: newName,
              updatedAt: Date.now(),
              files: {
                ...state.projects[id].files,
                root: { ...state.projects[id].files.root, name: newName },
              },
            },
          },
        }));
      },

      openProject: (id) => {
        set({ currentProjectId: id });
      },

      closeProject: () => {
        // Save current project files before closing
        const state = get();
        if (state.currentProjectId && state.projects[state.currentProjectId]) {
          // Files should already be synced via updateProjectFiles
        }
        set({ currentProjectId: null });
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
      },

      getCurrentProject: () => {
        const state = get();
        if (!state.currentProjectId) return null;
        return state.projects[state.currentProjectId] || null;
      },
    }),
    {
      name: 'krypton-projects-storage',
    }
  )
);
