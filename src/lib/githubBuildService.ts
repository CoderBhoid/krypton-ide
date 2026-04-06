import { useAuthStore } from '../store/useAuthStore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

const API = 'https://api.github.com';

function headers() {
  const token = useAuthStore.getState().githubToken;
  if (!token) throw new Error('Not authenticated with GitHub');
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

export interface Artifact {
  id: number;
  name: string;
  archive_download_url: string;
  size_in_bytes: number;
}

export async function triggerBuild(owner: string, repo: string, buildType: 'debug' | 'release' = 'debug'): Promise<void> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/workflows/build.yml/dispatches`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      ref: 'main', // defaulting to main branch
      inputs: {
        build_type: buildType
      }
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Failed to trigger build: ${res.status}`);
  }
}

export async function getLatestRun(owner: string, repo: string): Promise<WorkflowRun | null> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/runs?per_page=1`, {
    headers: headers()
  });
  
  if (!res.ok) return null;
  const data = await res.json();
  if (data.workflow_runs && data.workflow_runs.length > 0) {
    return data.workflow_runs[0] as WorkflowRun;
  }
  return null;
}

export async function getRunArtifacts(owner: string, repo: string, runId: number): Promise<Artifact[]> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, {
    headers: headers()
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.artifacts as Artifact[];
}

export async function downloadArtifactToDevice(artifactDownloadUrl: string): Promise<string> {
  // Use Capacitor filesystem to download
  // But wait, it redirects to a zip file. We need to fetch the zip and save it.
  const res = await fetch(artifactDownloadUrl, {
    headers: headers(), // need auth to download artifact
  });

  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const blob = await res.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        // Strip out the data URL prefix if present
        const base64 = base64data.split(',')[1] || base64data;
        
        await Filesystem.writeFile({
          path: 'krypton-apk.zip',
          data: base64,
          directory: Directory.Data,
        });

        const uriResult = await Filesystem.getUri({
          path: 'krypton-apk.zip',
          directory: Directory.Data,
        });

        resolve(uriResult.uri);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
