/**
 * googleDriveSync.ts
 * 
 * Google Drive sync service for Krypton IDE.
 * Implements a dual-sync model:
 *   Local filesystem ←→ Google Drive (appDataFolder)
 * 
 * Uses Google Drive REST API v3 directly (no SDK needed).
 * Files are zipped before upload for efficiency.
 */

import JSZip from 'jszip';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getBasePath } from './fileSystemStorage';

const DRIVE_API = 'https://www.googleapis.com/';
const DRIVE_FILES = `${DRIVE_API}drive/v3/files`;
const DRIVE_UPLOAD = `${DRIVE_API}upload/drive/v3/files`;

// ─── Types ───────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  message: string;
  timestamp?: number;
  filesUploaded?: number;
  filesDownloaded?: number;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

// ─── Token Management ────────────────────────────────────────

let _accessToken: string | null = null;

export function setDriveAccessToken(token: string) {
  _accessToken = token;
}

export function getDriveAccessToken(): string | null {
  return _accessToken;
}

export function clearDriveAccessToken() {
  _accessToken = null;
}

function authHeaders(): Record<string, string> {
  if (!_accessToken) throw new Error('Not authenticated with Google Drive');
  return {
    'Authorization': `Bearer ${_accessToken}`,
  };
}

// ─── Drive API Helpers ───────────────────────────────────────

/**
 * List files in appDataFolder with given name
 */
async function findFileByName(name: string): Promise<DriveFile | null> {
  const query = `name='${name}' and trashed=false`;
  const params = new URLSearchParams({
    q: query,
    spaces: 'appDataFolder',
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    pageSize: '10',
  });

  const res = await fetch(`${DRIVE_FILES}?${params}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive list failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.files?.[0] || null;
}

/**
 * List all backup files in appDataFolder
 */
async function listBackupFiles(): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: "name contains 'krypton-backup' and trashed=false",
    spaces: 'appDataFolder',
    fields: 'files(id,name,mimeType,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '20',
  });

  const res = await fetch(`${DRIVE_FILES}?${params}`, {
    headers: authHeaders(),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

/**
 * Upload a file to appDataFolder (create or update)
 */
async function uploadFile(
  name: string,
  content: Blob,
  mimeType: string,
  existingFileId?: string
): Promise<string> {
  const metadata: any = { name, mimeType };

  if (existingFileId) {
    // Update existing file (PATCH)
    const res = await fetch(
      `${DRIVE_UPLOAD}/${existingFileId}?uploadType=multipart&fields=id`,
      {
        method: 'PATCH',
        headers: {
          ...authHeaders(),
        },
        body: buildMultipartBody(metadata, content, mimeType),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive upload (update) failed: ${res.status} — ${err}`);
    }
    const data = await res.json();
    return data.id;
  } else {
    // Create new file
    metadata.parents = ['appDataFolder'];

    const res = await fetch(
      `${DRIVE_UPLOAD}?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
        },
        body: buildMultipartBody(metadata, content, mimeType),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive upload (create) failed: ${res.status} — ${err}`);
    }
    const data = await res.json();
    return data.id;
  }
}

/**
 * Download a file's content from Drive
 */
async function downloadFile(fileId: string): Promise<Blob> {
  const res = await fetch(
    `${DRIVE_FILES}/${fileId}?alt=media`,
    {
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }
  return await res.blob();
}

/**
 * Delete a file from Drive
 */
async function deleteFile(fileId: string): Promise<void> {
  await fetch(`${DRIVE_FILES}/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

/**
 * Build a multipart/related body for Drive API uploads
 */
function buildMultipartBody(metadata: any, content: Blob, contentType: string): Blob {
  const boundary = '-------krypton_boundary_' + Date.now();
  
  const metadataPart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    '',
  ].join('\r\n');

  const closingBoundary = `\r\n--${boundary}--`;
  
  const contentHeader = [
    `--${boundary}`,
    `Content-Type: ${contentType}`,
    '',
    '',
  ].join('\r\n');

  return new Blob(
    [metadataPart, '\r\n', contentHeader, content, closingBoundary],
    { type: `multipart/related; boundary=${boundary}` }
  );
}

// ─── Zip Helpers ─────────────────────────────────────────────

/**
 * Create a zip of all project files from the local filesystem
 */
async function zipLocalProjects(): Promise<Blob> {
  const zip = new JSZip();
  const base = getBasePath();

  if (!base) throw new Error('Storage not initialized');

  if (!Capacitor.isNativePlatform()) {
    // Web fallback: zip all kfs: keys
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('kfs:')) {
        data[k] = localStorage.getItem(k) || '';
      }
    }
    zip.file('_web_backup.json', JSON.stringify(data, null, 2));
    return await zip.generateAsync({ type: 'blob' });
  }

  // Native: read the actual directory tree
  async function addDirToZip(dirPath: string, zipFolder: JSZip) {
    try {
      const entries = await Filesystem.readdir({ path: dirPath, directory: Directory.ExternalStorage });
      for (const entry of entries.files) {
        const fullPath = `${dirPath}/${entry.name}`;
        if (entry.type === 'directory') {
          const subFolder = zipFolder.folder(entry.name)!;
          await addDirToZip(fullPath, subFolder);
        } else {
          try {
            const file = await Filesystem.readFile({ path: fullPath, directory: Directory.ExternalStorage, encoding: Encoding.UTF8 });
            if (typeof file.data === 'string') {
              zipFolder.file(entry.name, file.data);
            }
          } catch {
            // Skip binary/unreadable files
          }
        }
      }
    } catch {
      // Directory doesn't exist yet — skip
    }
  }

  await addDirToZip(base, zip);
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Unzip Google Drive backup into local filesystem
 */
async function unzipToLocal(blob: Blob): Promise<number> {
  const zip = await JSZip.loadAsync(blob);
  const base = getBasePath();
  if (!base) throw new Error('Storage not initialized');

  let count = 0;

  if (!Capacitor.isNativePlatform()) {
    // Web fallback: restore kfs: keys
    const webBackup = zip.file('_web_backup.json');
    if (webBackup) {
      const raw = await webBackup.async('string');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(k, v as string);
        count++;
      }
    }
    return count;
  }

  // Native: write files to disk
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) {
      try {
        await Filesystem.mkdir({
          path: `${base}/${relativePath}`,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
      } catch { /* exists */ }
    } else {
      const content = await zipEntry.async('string');
      const fullPath = `${base}/${relativePath}`;
      
      // Ensure parent directory exists
      const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      try {
        await Filesystem.mkdir({ path: parentDir, directory: Directory.ExternalStorage, recursive: true });
      } catch { /* exists */ }

      await Filesystem.writeFile({
        path: fullPath,
        data: content,
        directory: Directory.ExternalStorage,
        encoding: Encoding.UTF8,
      });
      count++;
    }
  }

  return count;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Upload local projects to Google Drive
 */
export async function syncUpToDrive(): Promise<SyncResult> {
  try {
    if (!_accessToken) {
      return { success: false, message: 'Not signed in to Google' };
    }

    // 1. Zip local data
    const zipBlob = await zipLocalProjects();

    // 2. Check if backup already exists
    const backupName = 'krypton-backup.zip';
    const existing = await findFileByName(backupName);

    // 3. Upload (create or update)
    await uploadFile(backupName, zipBlob, 'application/zip', existing?.id);

    // 4. Save sync timestamp to a metadata file  
    const meta = JSON.stringify({
      lastSync: Date.now(),
      sizeBytes: zipBlob.size,
      device: Capacitor.getPlatform(),
    });
    const metaBlob = new Blob([meta], { type: 'application/json' });
    const existingMeta = await findFileByName('krypton-sync-meta.json');
    await uploadFile('krypton-sync-meta.json', metaBlob, 'application/json', existingMeta?.id);

    return {
      success: true,
      message: `Backed up to Google Drive (${(zipBlob.size / 1024).toFixed(0)} KB)`,
      timestamp: Date.now(),
      filesUploaded: 1,
    };
  } catch (err: any) {
    console.error('[DriveSync] Upload error:', err);
    return { success: false, message: err.message || 'Upload failed' };
  }
}

/**
 * Download backup from Google Drive and restore locally
 */
export async function syncDownFromDrive(): Promise<SyncResult> {
  try {
    if (!_accessToken) {
      return { success: false, message: 'Not signed in to Google' };
    }

    // 1. Find the backup
    const backupFile = await findFileByName('krypton-backup.zip');
    if (!backupFile) {
      return { success: false, message: 'No backup found on Google Drive' };
    }

    // 2. Download
    const blob = await downloadFile(backupFile.id);

    // 3. Unzip to local FS
    const fileCount = await unzipToLocal(blob);

    return {
      success: true,
      message: `Restored ${fileCount} files from Google Drive`,
      timestamp: Date.now(),
      filesDownloaded: fileCount,
    };
  } catch (err: any) {
    console.error('[DriveSync] Download error:', err);
    return { success: false, message: err.message || 'Download failed' };
  }
}

/**
 * Get info about the last sync from Drive
 */
export async function getLastSyncInfo(): Promise<{ lastSync: number; sizeBytes: number; device: string } | null> {
  try {
    if (!_accessToken) return null;
    
    const metaFile = await findFileByName('krypton-sync-meta.json');
    if (!metaFile) return null;

    const blob = await downloadFile(metaFile.id);
    const text = await blob.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Check if a Drive backup exists
 */
export async function hasCloudBackup(): Promise<boolean> {
  try {
    if (!_accessToken) return false;
    const file = await findFileByName('krypton-backup.zip');
    return !!file;
  } catch {
    return false;
  }
}

/**
 * Delete all backups from Drive
 */
export async function clearCloudBackups(): Promise<void> {
  const files = await listBackupFiles();
  for (const f of files) {
    await deleteFile(f.id);
  }
  // Also delete meta
  const meta = await findFileByName('krypton-sync-meta.json');
  if (meta) await deleteFile(meta.id);
}
