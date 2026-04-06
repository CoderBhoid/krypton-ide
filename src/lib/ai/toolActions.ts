import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { useIdeStore } from '../../store/useIdeStore';

// ─── Helpers ─────────────────────────────────────────────────

/** Sync file content with the IDE store after any write operation */
function syncWithIdeStore(path: string, newContent: string) {
  const state = useIdeStore.getState();
  const fileName = path.split('/').pop() || path;
  
  const fileId = Object.entries(state.files).find(([_, f]) => {
    return f.name === fileName;
  })?.[0];

  if (fileId) {
    state.updateFileContent(fileId, newContent);
  }
}

// ─── read_file ───────────────────────────────────────────────

/**
 * Reads a file and returns its content with line numbers prepended.
 * Supports optional line range for partial reads.
 */
export async function CapacitorFilesystemRead(
  path: string,
  startLine?: number,
  endLine?: number
): Promise<string> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    const content = typeof result.data === 'string' ? result.data : '';
    const lines = content.split('\n');
    
    // Apply line range if specified
    const start = startLine ? Math.max(1, startLine) : 1;
    const end = endLine ? Math.min(lines.length, endLine) : lines.length;
    
    // Prepend line numbers for context
    const numbered = lines
      .slice(start - 1, end)
      .map((line, i) => `${start + i}: ${line}`)
      .join('\n');
    
    const header = `File: ${path} (${lines.length} lines total, showing ${start}-${end})`;
    return `${header}\n${numbered}`;
  } catch (error: any) {
    console.error('Filesystem Read Error:', error);
    throw new Error(`Could not read file at ${path}: ${error.message}`);
  }
}

/** Internal: read raw content without line numbers (for edit operations) */
async function readRawContent(path: string): Promise<string> {
  const result = await Filesystem.readFile({
    path,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return typeof result.data === 'string' ? result.data : '';
}

/** Internal: write content to disk */
async function writeContent(path: string, content: string): Promise<void> {
  await Filesystem.writeFile({
    path,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
}

// ─── edit_lines ──────────────────────────────────────────────

/**
 * Replaces a specific range of lines in a file.
 * Line numbers are 1-indexed and inclusive on both ends.
 */
export async function CapacitorFilesystemEditLines(
  path: string,
  startLine: number,
  endLine: number,
  newContent: string
): Promise<string> {
  try {
    const content = await readRawContent(path);
    const lines = content.split('\n');
    
    // Validate range
    if (startLine < 1 || startLine > lines.length) {
      return `Error: start_line ${startLine} is out of range (file has ${lines.length} lines)`;
    }
    if (endLine < startLine) {
      return `Error: end_line ${endLine} cannot be less than start_line ${startLine}`;
    }
    if (endLine > lines.length) {
      endLine = lines.length; // Clamp to file length
    }
    
    // Split new content into lines (handle empty string = deletion)
    const newLines = newContent === '' ? [] : newContent.split('\n');
    
    // Splice: remove old lines, insert new ones
    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const result = [...before, ...newLines, ...after];
    
    const newFileContent = result.join('\n');
    await writeContent(path, newFileContent);
    syncWithIdeStore(path, newFileContent);
    
    const removedCount = endLine - startLine + 1;
    const insertedCount = newLines.length;
    return `Success: Replaced lines ${startLine}-${endLine} (${removedCount} lines removed, ${insertedCount} lines inserted). File now has ${result.length} lines.`;
  } catch (error: any) {
    throw new Error(`Could not edit lines in ${path}: ${error.message}`);
  }
}

// ─── insert_lines ────────────────────────────────────────────

/**
 * Inserts new lines BEFORE the specified line number.
 * Does not remove any existing content.
 */
export async function CapacitorFilesystemInsertLines(
  path: string,
  atLine: number,
  content: string
): Promise<string> {
  try {
    const fileContent = await readRawContent(path);
    const lines = fileContent.split('\n');
    
    const newLines = content.split('\n');
    const insertIdx = Math.min(Math.max(atLine - 1, 0), lines.length);
    
    lines.splice(insertIdx, 0, ...newLines);
    
    const newFileContent = lines.join('\n');
    await writeContent(path, newFileContent);
    syncWithIdeStore(path, newFileContent);
    
    return `Success: Inserted ${newLines.length} lines at line ${atLine}. File now has ${lines.length} lines.`;
  } catch (error: any) {
    throw new Error(`Could not insert lines in ${path}: ${error.message}`);
  }
}

// ─── patch_file ──────────────────────────────────────────────

/**
 * Patches a file by replacing a search string with a replacement string.
 */
export async function CapacitorFilesystemPatch(
  path: string, 
  searchString: string, 
  replaceString: string
): Promise<boolean> {
  try {
    const content = await readRawContent(path);
    
    if (!content.includes(searchString)) {
      console.warn(`Patch failed: Search string not found in ${path}`);
      return false;
    }
    
    const newContent = content.replace(searchString, replaceString);
    await writeContent(path, newContent);
    syncWithIdeStore(path, newContent);
    
    return true;
  } catch (error: any) {
    console.error('Filesystem Patch Error:', error);
    throw new Error(`Could not patch file at ${path}: ${error.message}`);
  }
}

// ─── create_directory ────────────────────────────────────────

export async function CapacitorFilesystemMkdir(path: string, options: { recursive: boolean }): Promise<void> {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Documents,
      recursive: options.recursive,
    });
  } catch (error: any) {
    if (error.message.includes('exists')) return;
    throw new Error(`Could not create directory at ${path}: ${error.message}`);
  }
}

// ─── write_new_file ──────────────────────────────────────────

export async function CapacitorFilesystemWrite(path: string, content: string): Promise<void> {
  try {
    await writeContent(path, content);

    const state = useIdeStore.getState();
    const fileName = path.split('/').pop() || path;
    const existingId = Object.entries(state.files).find(([_, f]) => f.name === fileName)?.[0];
    
    if (existingId) {
      state.updateFileContent(existingId, content);
    } else {
      state.createFile(fileName, 'root', 'file', content);
    }
  } catch (error: any) {
    throw new Error(`Could not write file at ${path}: ${error.message}`);
  }
}
