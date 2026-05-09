import { registerPlugin } from '@capacitor/core';

interface FolderPickerResult {
  /** Relative path from /storage/emulated/0/, e.g. "KryptonIDE" */
  path: string;
  /** The raw content URI from SAF */
  uri: string;
}

interface FolderPickerPlugin {
  pickFolder(): Promise<FolderPickerResult>;
}

const FolderPicker = registerPlugin<FolderPickerPlugin>('FolderPicker');

export { FolderPicker };
export type { FolderPickerResult };
