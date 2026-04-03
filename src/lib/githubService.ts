// GitHub REST API service for Krypton IDE
// Smart-diff push: only uploads changed/new files, deletes removed files

import { useAuthStore } from '../store/useAuthStore';
import { useIdeStore, type FileNode } from '../store/useIdeStore';

const API = 'https://api.github.com';

function headers(): Record<string, string> {
  const token = useAuthStore.getState().githubToken;
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

// ─── Repo Operations ────────────────────────────────────────

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
}

export async function listRepos(): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const res = await fetch(`${API}/user/repos?sort=updated&per_page=${perPage}&page=${page}`, { headers: headers() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data: GitHubRepo[] = await res.json();
    repos.push(...data);
    if (data.length < perPage) break;
    page++;
    if (page > 5) break; // Safety cap at 250 repos
  }

  return repos;
}

export async function createRepo(name: string, description: string = '', isPrivate: boolean = false): Promise<GitHubRepo> {
  const res = await fetch(`${API}/user/repos`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true, // creates initial commit with README
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create repo (${res.status})`);
  }

  return res.json();
}

// ─── Smart-Diff Push ────────────────────────────────────────
// Only pushes changed/new files, removes deleted files

interface RemoteFile {
  path: string;
  sha: string;
}

async function getRemoteTree(owner: string, repo: string, branch: string): Promise<RemoteFile[]> {
  try {
    const res = await fetch(`${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.tree || [])
      .filter((item: any) => item.type === 'blob')
      .map((item: any) => ({ path: item.path, sha: item.sha }));
  } catch {
    return [];
  }
}

function collectProjectFiles(files: Record<string, FileNode>): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = [];

  const walk = (nodeId: string, currentPath: string) => {
    const node = files[nodeId];
    if (!node) return;

    if (node.type === 'file' && node.content !== undefined) {
      const filePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      result.push({ path: filePath, content: node.content });
    } else if (node.type === 'folder' && node.children) {
      const newPath = nodeId === 'root' ? '' : (currentPath ? `${currentPath}/${node.name}` : node.name);
      node.children.forEach(childId => walk(childId, newPath));
    }
  };

  walk('root', '');
  return result;
}

// Compute blob SHA the same way git does (for diff comparison)
async function computeGitSha(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`blob ${encoder.encode(content).length}\0${content}`);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface PushResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  commitSha: string;
  commitUrl: string;
}

export async function pushProject(owner: string, repo: string): Promise<PushResult> {
  // 1. Get repo info for default branch
  const repoRes = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers() });
  if (!repoRes.ok) throw new Error(`Repo not found: ${owner}/${repo}`);
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch || 'main';

  // 2. Get current remote tree
  const remoteFiles = await getRemoteTree(owner, repo, branch);
  const remoteMap = new Map(remoteFiles.map(f => [f.path, f.sha]));

  // 3. Collect local project files
  const files = useIdeStore.getState().files;
  const localFiles = collectProjectFiles(files);

  // 4. Smart diff
  const toCreate: typeof localFiles = [];
  const toUpdate: typeof localFiles = [];
  let unchanged = 0;

  for (const file of localFiles) {
    const remoteSha = remoteMap.get(file.path);
    if (!remoteSha) {
      toCreate.push(file);
    } else {
      const localSha = await computeGitSha(file.content);
      if (localSha !== remoteSha) {
        toUpdate.push(file);
      } else {
        unchanged++;
      }
      remoteMap.delete(file.path);
    }
  }

  // Remaining in remoteMap = files to delete
  const toDelete = Array.from(remoteMap.keys());

  // 5. If nothing changed, skip
  if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
    return { created: 0, updated: 0, deleted: 0, unchanged, commitSha: '', commitUrl: '' };
  }

  // 6. Get the latest commit SHA
  const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers: headers() });
  if (!refRes.ok) throw new Error('Failed to get branch ref');
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 7. Get the base tree
  const commitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers: headers() });
  if (!commitRes.ok) throw new Error('Failed to get commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 8. Create blobs for new/updated files
  const treeItems: any[] = [];

  for (const file of [...toCreate, ...toUpdate]) {
    const blobRes = await fetch(`${API}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ content: btoa(unescape(encodeURIComponent(file.content))), encoding: 'base64' }),
    });
    if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
    const blobData = await blobRes.json();

    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // Mark deletions
  for (const path of toDelete) {
    treeItems.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: null, // null sha = delete
    });
  }

  // 9. Create new tree
  const treeRes = await fetch(`${API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 10. Create commit
  const user = useAuthStore.getState().githubUser;
  const newCommitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      message: `Krypton IDE: sync ${toCreate.length} new, ${toUpdate.length} updated, ${toDelete.length} deleted`,
      tree: treeData.sha,
      parents: [latestCommitSha],
      author: {
        name: user?.name || user?.login || 'Krypton User',
        email: `${user?.login || 'user'}@users.noreply.github.com`,
      },
    }),
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // 11. Update branch ref
  const updateRefRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error('Failed to update branch ref');

  return {
    created: toCreate.length,
    updated: toUpdate.length,
    deleted: toDelete.length,
    unchanged,
    commitSha: newCommitData.sha,
    commitUrl: newCommitData.html_url || `https://github.com/${owner}/${repo}/commit/${newCommitData.sha}`,
  };
}

// ─── Pull (clone repo contents into IDE) ────────────────────

export async function pullRepo(owner: string, repo: string): Promise<number> {
  const repoRes = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers() });
  if (!repoRes.ok) throw new Error(`Repo not found: ${owner}/${repo}`);
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch || 'main';

  // Get full tree
  const treeRes = await fetch(`${API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers: headers() });
  if (!treeRes.ok) throw new Error('Failed to get repo tree');
  const treeData = await treeRes.json();

  const blobs = (treeData.tree || []).filter((item: any) => item.type === 'blob');

  // Build file structure
  const generateId = () => Math.random().toString(36).substring(2, 9);
  const newFiles: Record<string, FileNode> = {
    root: {
      id: 'root',
      name: repo,
      type: 'folder',
      parentId: null,
      children: [],
    },
  };

  // Track created folders
  const folderMap = new Map<string, string>(); // path -> id
  folderMap.set('', 'root');

  const ensureFolder = (folderPath: string): string => {
    if (folderMap.has(folderPath)) return folderMap.get(folderPath)!;

    const parts = folderPath.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = ensureFolder(parentPath);
    const folderId = generateId();
    const folderName = parts[parts.length - 1];

    newFiles[folderId] = {
      id: folderId,
      name: folderName,
      type: 'folder',
      parentId,
      children: [],
    };

    if (newFiles[parentId].children) {
      newFiles[parentId].children!.push(folderId);
    }

    folderMap.set(folderPath, folderId);
    return folderId;
  };

  // Fetch each file's content
  let fileCount = 0;
  for (const blob of blobs) {
    try {
      const contentRes = await fetch(`${API}/repos/${owner}/${repo}/git/blobs/${blob.sha}`, { headers: headers() });
      if (!contentRes.ok) continue;
      const contentData = await contentRes.json();

      let content = '';
      if (contentData.encoding === 'base64') {
        content = decodeURIComponent(escape(atob(contentData.content.replace(/\n/g, ''))));
      } else {
        content = contentData.content;
      }

      const pathParts = blob.path.split('/');
      const fileName = pathParts.pop()!;
      const folderPath = pathParts.join('/');
      const parentId = ensureFolder(folderPath);

      const fileId = generateId();
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      let language = 'plaintext';
      const langMap: Record<string, string> = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        html: 'html', htm: 'html', css: 'css', scss: 'css', less: 'css',
        json: 'json', md: 'markdown', py: 'python', go: 'go', rs: 'rust',
        java: 'java', kt: 'kotlin', rb: 'ruby', php: 'php', sh: 'shell',
        yaml: 'yaml', yml: 'yaml', xml: 'xml', svg: 'xml', sql: 'sql',
      };
      language = langMap[ext] || 'plaintext';

      newFiles[fileId] = {
        id: fileId,
        name: fileName,
        type: 'file',
        content,
        parentId,
        language,
      };
      newFiles[parentId].children!.push(fileId);
      fileCount++;
    } catch {
      continue;
    }
  }

  // Load into IDE
  useIdeStore.getState().loadProject(newFiles);
  return fileCount;
}
