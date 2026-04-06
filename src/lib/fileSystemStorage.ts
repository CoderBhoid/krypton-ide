import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import type { FileNode } from '../store/useIdeStore';
import { getLanguageFromFilename } from '../store/useIdeStore';

// ─── Constants ───────────────────────────────────────────────
const BASE_PATH_KEY = 'krypton-base-path'; // bootstrap key stored in localStorage
const DEFAULT_FOLDER = 'KryptonIDE';

// ─── Types ───────────────────────────────────────────────────
export interface SavedModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface KryptonConfig {
  welcomed: boolean;
  haptics: boolean;
  theme: 'vs-dark' | 'light' | 'hc-black';
  activeFont: string; // name of active font, empty = default
  installedFonts: string[]; // list of font names saved in fonts/ folder
  ai: {
    provider: string;
    model: string;
    activeSessionId: string | null;
    savedModels?: SavedModel[];
    activeModelId?: string;
  };
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  template: string;
  githubRepo?: string; // Format: "owner/repo"
}

// API key is stored separately in Directory.Data for privacy
const API_KEY_FILE = 'krypton-api-key.json';

const DEFAULT_CONFIG: KryptonConfig = {
  welcomed: false,
  haptics: true,
  theme: 'vs-dark',
  activeFont: '',
  installedFonts: [],
  ai: {
    provider: 'openai',
    model: 'gpt-4o',
    activeSessionId: null,
    savedModels: [],
    activeModelId: undefined,
  },
};

// ─── Debounce Queue ──────────────────────────────────────────
const writeTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedWrite(key: string, fn: () => Promise<void>, delayMs = 500) {
  if (writeTimers[key]) clearTimeout(writeTimers[key]);
  writeTimers[key] = setTimeout(async () => {
    try {
      await fn();
    } catch (e) {
      console.error(`[FS] Debounced write failed for ${key}:`, e);
    }
  }, delayMs);
}

// ─── Flush all pending writes immediately ────────────────────
export async function flushAllWrites(): Promise<void> {
  const keys = Object.keys(writeTimers);
  for (const key of keys) {
    clearTimeout(writeTimers[key]);
    delete writeTimers[key];
  }
  // The actual pending write functions are lost when we clear timers.
  // Instead, callers should use saveConfigNow / saveProjectNow etc.
}

// ─── Path Helpers ────────────────────────────────────────────

export function getBasePath(): string {
  return localStorage.getItem(BASE_PATH_KEY) || '';
}

export function setBasePath(path: string): void {
  localStorage.setItem(BASE_PATH_KEY, path);
}

export function isStorageInitialized(): boolean {
  return !!getBasePath();
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ─── Low-Level FS Ops ────────────────────────────────────────

async function readTextFile(path: string, directory: Directory = Directory.ExternalStorage): Promise<string | null> {
  try {
    const result = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 });
    return typeof result.data === 'string' ? result.data : null;
  } catch {
    return null;
  }
}

async function writeTextFile(path: string, data: string, directory: Directory = Directory.ExternalStorage): Promise<void> {
  await Filesystem.writeFile({ path, data, directory, encoding: Encoding.UTF8 });
}

async function mkdirSafe(path: string, directory: Directory = Directory.ExternalStorage): Promise<void> {
  try {
    await Filesystem.mkdir({ path, directory, recursive: true });
  } catch (e: any) {
    if (!e?.message?.includes('exists')) throw e;
  }
}

async function deletePathSafe(path: string, directory: Directory = Directory.ExternalStorage): Promise<void> {
  try {
    await Filesystem.rmdir({ path, directory, recursive: true });
  } catch {
    try {
      await Filesystem.deleteFile({ path, directory });
    } catch {
      // already gone
    }
  }
}

async function listDir(path: string, directory: Directory = Directory.ExternalStorage) {
  try {
    const result = await Filesystem.readdir({ path, directory });
    return result.files;
  } catch {
    return [];
  }
}

// ─── Web Fallback (localStorage) ─────────────────────────────
// When running in the browser (non-native), we fall back to localStorage
// so the app still works for dev/testing.

function webRead(key: string): string | null {
  return localStorage.getItem(`kfs:${key}`);
}
function webWrite(key: string, data: string): void {
  localStorage.setItem(`kfs:${key}`, data);
}
function webDelete(key: string): void {
  localStorage.removeItem(`kfs:${key}`);
}
function webList(prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`kfs:${prefix}`)) keys.push(k.replace('kfs:', ''));
  }
  return keys;
}

// ─── Initialize Storage ──────────────────────────────────────

export async function initializeStorage(folderName: string): Promise<void> {
  const basePath = folderName || DEFAULT_FOLDER;

  if (isNative()) {
    await mkdirSafe(basePath, Directory.ExternalStorage);
    await mkdirSafe(`${basePath}/projects`, Directory.ExternalStorage);
    await mkdirSafe(`${basePath}/ai-sessions`, Directory.ExternalStorage);
    await mkdirSafe(`${basePath}/fonts`, Directory.ExternalStorage);
  }

  setBasePath(basePath);

  // Write default config if none exists
  const existing = await readConfig();
  if (!existing) {
    await saveConfigNow(DEFAULT_CONFIG);
  }
}

// ─── Config (krypton.config.json) ────────────────────────────

export async function readConfig(): Promise<KryptonConfig | null> {
  const base = getBasePath();
  if (!base) return null;

  if (!isNative()) {
    const raw = webRead(`${base}/krypton.config.json`);
    return raw ? JSON.parse(raw) : null;
  }

  const raw = await readTextFile(`${base}/krypton.config.json`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConfigNow(config: KryptonConfig): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const data = JSON.stringify(config, null, 2);
  if (!isNative()) {
    webWrite(`${base}/krypton.config.json`, data);
    return;
  }
  await writeTextFile(`${base}/krypton.config.json`, data);
}

export function saveConfigDebounced(config: KryptonConfig): void {
  debouncedWrite('config', () => saveConfigNow(config));
}

// ─── API Key (private storage) ───────────────────────────────

export async function readApiKey(): Promise<string> {
  if (!isNative()) {
    return localStorage.getItem('kfs:api-key') || '';
  }
  try {
    const raw = await readTextFile(API_KEY_FILE, Directory.Data);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.apiKey || '';
    }
  } catch { /* empty */ }
  return '';
}

export async function saveApiKey(apiKey: string): Promise<void> {
  if (!isNative()) {
    localStorage.setItem('kfs:api-key', apiKey);
    return;
  }
  await writeTextFile(API_KEY_FILE, JSON.stringify({ apiKey }), Directory.Data);
}

// ─── Auth (auth.json in external) ────────────────────────────

export async function readAuth(): Promise<any | null> {
  const base = getBasePath();
  if (!base) return null;

  if (!isNative()) {
    const raw = webRead(`${base}/auth.json`);
    return raw ? JSON.parse(raw) : null;
  }

  const raw = await readTextFile(`${base}/auth.json`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveAuth(data: any): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const json = JSON.stringify(data, null, 2);
  if (!isNative()) {
    webWrite(`${base}/auth.json`, json);
    return;
  }
  await writeTextFile(`${base}/auth.json`, json);
}

export function saveAuthDebounced(data: any): void {
  debouncedWrite('auth', () => saveAuth(data));
}

// ─── Extensions (extensions.json) ────────────────────────────

export async function readExtensions(): Promise<any | null> {
  const base = getBasePath();
  if (!base) return null;

  if (!isNative()) {
    const raw = webRead(`${base}/extensions.json`);
    return raw ? JSON.parse(raw) : null;
  }

  const raw = await readTextFile(`${base}/extensions.json`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveExtensions(data: any): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const json = JSON.stringify(data, null, 2);
  if (!isNative()) {
    webWrite(`${base}/extensions.json`, json);
    return;
  }
  await writeTextFile(`${base}/extensions.json`, json);
}

export function saveExtensionsDebounced(data: any): void {
  debouncedWrite('extensions', () => saveExtensions(data));
}

// ─── AI Sessions (per-project) ───────────────────────────────

/** Get the session directory path for a given project, or global if no project */
function sessionDir(projectId?: string): string {
  const base = getBasePath();
  if (projectId) {
    return `${base}/projects/project_${projectId}/ai-sessions`;
  }
  return `${base}/ai-sessions`;
}

export async function readAllSessions(projectId?: string): Promise<any[]> {
  const base = getBasePath();
  if (!base) return [];

  const dir = sessionDir(projectId);

  if (!isNative()) {
    const keys = webList(`${dir}/`);
    return keys
      .map(k => { try { return JSON.parse(webRead(k) || ''); } catch { return null; } })
      .filter(Boolean);
  }

  // Ensure directory exists
  await mkdirSafe(dir);

  const entries = await listDir(dir);
  const sessions: any[] = [];
  for (const entry of entries) {
    if (entry.name.endsWith('.json')) {
      const raw = await readTextFile(`${dir}/${entry.name}`);
      if (raw) {
        try { sessions.push(JSON.parse(raw)); } catch { /* skip corrupt */ }
      }
    }
  }
  return sessions;
}

export async function saveSession(session: any, projectId?: string): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const dir = sessionDir(projectId);
  const fname = `session_${session.id}.json`;
  const data = JSON.stringify(session, null, 2);

  if (!isNative()) {
    webWrite(`${dir}/${fname}`, data);
    return;
  }
  await mkdirSafe(dir);
  await writeTextFile(`${dir}/${fname}`, data);
}

export function saveSessionDebounced(session: any, projectId?: string): void {
  debouncedWrite(`session-${session.id}`, () => saveSession(session, projectId));
}

export async function deleteSessionFile(sessionId: string, projectId?: string): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const dir = sessionDir(projectId);
  const fname = `session_${sessionId}.json`;
  if (!isNative()) {
    webDelete(`${dir}/${fname}`);
    return;
  }
  try {
    await Filesystem.deleteFile({ path: `${dir}/${fname}`, directory: Directory.ExternalStorage });
  } catch { /* already gone */ }
}

// ─── Projects (real files on disk!) ──────────────────────────

export async function loadAllProjectMetas(): Promise<ProjectMeta[]> {
  const base = getBasePath();
  if (!base) return [];

  if (!isNative()) {
    const keys = webList(`${base}/projects/`);
    const metaKeys = keys.filter(k => k.endsWith('/project.meta.json'));
    return metaKeys
      .map(k => { try { return JSON.parse(webRead(k) || ''); } catch { return null; } })
      .filter(Boolean);
  }

  const entries = await listDir(`${base}/projects`);
  const metas: ProjectMeta[] = [];
  for (const entry of entries) {
    if (entry.type === 'directory') {
      const raw = await readTextFile(`${base}/projects/${entry.name}/project.meta.json`);
      if (raw) {
        try { metas.push(JSON.parse(raw)); } catch { /* skip */ }
      }
    }
  }
  return metas;
}

export async function saveProjectMeta(meta: ProjectMeta): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const dir = `${base}/projects/project_${meta.id}`;
  const data = JSON.stringify(meta, null, 2);

  if (!isNative()) {
    webWrite(`${dir}/project.meta.json`, data);
    return;
  }

  await mkdirSafe(dir);
  await writeTextFile(`${dir}/project.meta.json`, data);
}

/**
 * Writes the FileNode tree as real files to disk.
 * Folders become real directories, files become real files.
 */
export async function writeProjectFiles(
  projectId: string,
  files: Record<string, FileNode>
): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const projectDir = `${base}/projects/project_${projectId}`;

  if (!isNative()) {
    // Web fallback: store as JSON blob
    webWrite(`${projectDir}/files.json`, JSON.stringify(files));
    return;
  }

  await mkdirSafe(projectDir);

  // Build path map: nodeId → full relative path
  const pathMap = new Map<string, string>();

  function buildPath(nodeId: string): string {
    if (pathMap.has(nodeId)) return pathMap.get(nodeId)!;
    const node = files[nodeId];
    if (!node) return '';
    if (nodeId === 'root' || !node.parentId) {
      pathMap.set(nodeId, '');
      return '';
    }
    const parentPath = buildPath(node.parentId);
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    pathMap.set(nodeId, fullPath);
    return fullPath;
  }

  // Build all paths first
  for (const nodeId of Object.keys(files)) {
    buildPath(nodeId);
  }

  // Create directories first, then write files
  for (const [nodeId, node] of Object.entries(files)) {
    if (nodeId === 'root') continue;
    const relativePath = pathMap.get(nodeId) || node.name;
    const fullPath = `${projectDir}/${relativePath}`;

    if (node.type === 'folder') {
      await mkdirSafe(fullPath);
    }
  }

  for (const [nodeId, node] of Object.entries(files)) {
    if (nodeId === 'root') continue;
    const relativePath = pathMap.get(nodeId) || node.name;
    const fullPath = `${projectDir}/${relativePath}`;

    if (node.type === 'file' && node.content !== undefined) {
      await writeTextFile(fullPath, node.content);
    }
  }

  // Also save the FileNode structure for internal use (IDs, parentId, etc.)
  await writeTextFile(`${projectDir}/._krypton_tree.json`, JSON.stringify(files, null, 2));
}

export function writeProjectFilesDebounced(
  projectId: string,
  files: Record<string, FileNode>
): void {
  debouncedWrite(`project-${projectId}`, () => writeProjectFiles(projectId, files), 1000);
}

/**
 * Reads project files back into a FileNode tree.
 * Uses the saved ._krypton_tree.json for internal structure.
 */
export async function readProjectFiles(projectId: string): Promise<Record<string, FileNode> | null> {
  const base = getBasePath();
  if (!base) return null;

  const projectDir = `${base}/projects/project_${projectId}`;

  if (!isNative()) {
    const raw = webRead(`${projectDir}/files.json`);
    return raw ? JSON.parse(raw) : null;
  }

  // Try reading the internal tree structure
  const treeRaw = await readTextFile(`${projectDir}/._krypton_tree.json`);
  if (treeRaw) {
    try {
      const tree = JSON.parse(treeRaw) as Record<string, FileNode>;

      // Re-read actual file contents from disk (source of truth)
      for (const [nodeId, node] of Object.entries(tree)) {
        if (nodeId === 'root' || node.type !== 'file') continue;

        const pathMap = new Map<string, string>();
        function buildPath(nId: string): string {
          if (pathMap.has(nId)) return pathMap.get(nId)!;
          const n = tree[nId];
          if (!n) return '';
          if (nId === 'root' || !n.parentId) { pathMap.set(nId, ''); return ''; }
          const pp = buildPath(n.parentId);
          const fp = pp ? `${pp}/${n.name}` : n.name;
          pathMap.set(nId, fp);
          return fp;
        }

        const relativePath = buildPath(nodeId);
        const content = await readTextFile(`${projectDir}/${relativePath}`);
        if (content !== null) {
          tree[nodeId] = { ...node, content };
        }
      }

      return tree;
    } catch { /* fall through to scan */ }
  }

  // Fallback: scan directory and build tree from scratch
  return await scanDirectoryToTree(projectDir);
}

/**
 * Scan a directory and build a FileNode tree from raw files.
 */
async function scanDirectoryToTree(dirPath: string): Promise<Record<string, FileNode> | null> {
  if (!isNative()) return null;

  const root: FileNode = {
    id: 'root',
    name: 'Project',
    type: 'folder',
    parentId: null,
    children: [],
  };

  const tree: Record<string, FileNode> = { root };
  const generateId = () => Math.random().toString(36).substring(2, 9);

  async function scanDir(path: string, parentId: string) {
    const entries = await listDir(path);
    for (const entry of entries) {
      // Skip internal files
      if (entry.name.startsWith('._krypton') || entry.name === 'project.meta.json') continue;

      const id = generateId();

      if (entry.type === 'directory') {
        tree[id] = {
          id,
          name: entry.name,
          type: 'folder',
          parentId,
          children: [],
        };
        tree[parentId].children!.push(id);
        await scanDir(`${path}/${entry.name}`, id);
      } else {
        const content = await readTextFile(`${path}/${entry.name}`);
        tree[id] = {
          id,
          name: entry.name,
          type: 'file',
          content: content || '',
          parentId,
          language: getLanguageFromFilename(entry.name),
        };
        tree[parentId].children!.push(id);
      }
    }
  }

  await scanDir(dirPath, 'root');
  return Object.keys(tree).length > 1 ? tree : null;
}

export async function deleteProjectFolder(projectId: string): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  const dir = `${base}/projects/project_${projectId}`;

  if (!isNative()) {
    // Remove all webRead keys with this prefix
    const keys = webList(`${dir}/`);
    keys.forEach(k => webDelete(k));
    webDelete(`${dir}/project.meta.json`);
    webDelete(`${dir}/files.json`);
    return;
  }

  await deletePathSafe(dir);
}

// ─── Fonts ───────────────────────────────────────────────────

export async function saveFontFile(fileName: string, base64Data: string): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  if (!isNative()) {
    webWrite(`${base}/fonts/${fileName}`, base64Data);
    return;
  }

  await mkdirSafe(`${base}/fonts`);
  // base64Data is a data URL, write it as-is for later @font-face usage
  await writeTextFile(`${base}/fonts/${fileName}.b64`, base64Data);
}

export async function readFontFile(fileName: string): Promise<string | null> {
  const base = getBasePath();
  if (!base) return null;

  if (!isNative()) {
    return webRead(`${base}/fonts/${fileName}`);
  }

  return await readTextFile(`${base}/fonts/${fileName}.b64`);
}

export async function deleteFontFile(fileName: string): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  if (!isNative()) {
    webDelete(`${base}/fonts/${fileName}`);
    return;
  }

  try {
    await Filesystem.deleteFile({ path: `${base}/fonts/${fileName}.b64`, directory: Directory.ExternalStorage });
  } catch { /* already gone */ }
}

export async function listFonts(): Promise<string[]> {
  const base = getBasePath();
  if (!base) return [];

  if (!isNative()) {
    const keys = webList(`${base}/fonts/`);
    return keys.map(k => {
      const parts = k.split('/');
      return parts[parts.length - 1];
    });
  }

  const entries = await listDir(`${base}/fonts`);
  return entries
    .filter(e => e.name.endsWith('.b64'))
    .map(e => e.name.replace('.b64', ''));
}

// ─── Migration from localStorage ─────────────────────────────

export async function migrateFromLocalStorage(): Promise<void> {
  const base = getBasePath();
  if (!base) return;

  // Check if already migrated
  const migrated = localStorage.getItem('krypton-migrated-to-fs');
  if (migrated === 'true') return;

  console.log('[FS] Starting migration from localStorage...');

  try {
    // 1. Migrate config
    const config: KryptonConfig = { ...DEFAULT_CONFIG };
    config.welcomed = localStorage.getItem('krypton-welcomed') === 'true';
    config.haptics = localStorage.getItem('krypton-haptics') !== 'false';

    // AI config
    config.ai.provider = localStorage.getItem('krypton-ai-provider') || 'openai';
    config.ai.model = localStorage.getItem('krypton-ai-model') || 'gpt-4o';
    config.ai.activeSessionId = localStorage.getItem('krypton-active-session') || null;

    // Font
    const fontName = localStorage.getItem('krypton-custom-font-name');
    const fontData = localStorage.getItem('krypton-custom-font-data');
    if (fontName && fontData) {
      config.activeFont = fontName;
      config.installedFonts = [fontName];
      await saveFontFile(fontName, fontData);
    }

    await saveConfigNow(config);

    // 2. Migrate API key
    const apiKey = localStorage.getItem('krypton-ai-apiKey') || '';
    if (apiKey) {
      await saveApiKey(apiKey);
    }

    // 3. Migrate projects
    const projectsRaw = localStorage.getItem('krypton-projects-storage');
    if (projectsRaw) {
      try {
        const parsed = JSON.parse(projectsRaw);
        const projectsState = parsed.state || parsed;
        const projectsMap = projectsState.projects || {};

        for (const [id, project] of Object.entries(projectsMap) as [string, any][]) {
          const meta: ProjectMeta = {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            template: project.template,
          };
          await saveProjectMeta(meta);
          await writeProjectFiles(project.id, project.files);
        }
      } catch (e) {
        console.error('[FS] Failed to migrate projects:', e);
      }
    }

    // 4. Migrate AI sessions
    const sessionsRaw = localStorage.getItem('krypton-ai-sessions-v2');
    if (sessionsRaw) {
      try {
        const sessions = JSON.parse(sessionsRaw);
        for (const session of sessions) {
          await saveSession(session);
        }
      } catch (e) {
        console.error('[FS] Failed to migrate AI sessions:', e);
      }
    }

    // 5. Migrate auth
    const authRaw = localStorage.getItem('krypton-auth-storage');
    if (authRaw) {
      try {
        const parsed = JSON.parse(authRaw);
        const authState = parsed.state || parsed;
        await saveAuth({
          githubToken: authState.githubToken,
          githubUser: authState.githubUser,
          githubRepoLink: authState.githubRepoLink,
          googleUser: authState.googleUser,
        });
      } catch (e) {
        console.error('[FS] Failed to migrate auth:', e);
      }
    }

    // 6. Migrate extensions
    const extRaw = localStorage.getItem('krypton-extensions-storage');
    if (extRaw) {
      try {
        const parsed = JSON.parse(extRaw);
        const extState = parsed.state || parsed;
        await saveExtensions({
          installedExtensions: extState.installedExtensions || [],
          activeThemeExtension: extState.activeThemeExtension || null,
        });
      } catch (e) {
        console.error('[FS] Failed to migrate extensions:', e);
      }
    }

    // Mark as migrated
    localStorage.setItem('krypton-migrated-to-fs', 'true');
    console.log('[FS] Migration complete!');

  } catch (e) {
    console.error('[FS] Migration error:', e);
  }
}

// ─── Get project base path for AI tool actions ───────────────

export function getProjectPath(projectId: string): string {
  return `${getBasePath()}/projects/project_${projectId}`;
}

export function getProjectDirectory(): Directory {
  return isNative() ? Directory.ExternalStorage : Directory.Documents;
}
