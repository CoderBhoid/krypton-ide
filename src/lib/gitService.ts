import FS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import { useIdeStore } from '../store/useIdeStore';

export const fs = new FS('krypton-fs');
const DIR = '/repo';

let isInitialized = false;

// Helpers to make fs compatible with isomorphic-git
const gitFs = {
  promises: fs.promises
};

export async function initGitFs() {
  if (isInitialized) return;
  try {
    await fs.promises.mkdir(DIR);
  } catch (error) {
    if (error.code !== 'EEXIST') console.error(error);
  }
  
  // Try to init a repo if not exists
  try {
    await git.init({ fs: gitFs, dir: DIR });
    isInitialized = true;
  } catch (error) {
    console.error('Git init error:', error);
  }
}

export async function syncStateToFs() {
  await initGitFs();
  const state = useIdeStore.getState();
  
  for (const file of Object.values(state.files)) {
    if (file.type === 'file' && file.content !== undefined) {
      try {
        await fs.promises.writeFile(`${DIR}/${file.name}`, file.content);
      } catch (e) {
        console.error('Write sync error', e);
      }
    }
  }
}

export async function getGitStatus() {
  await syncStateToFs();
  const statusMatrix = await git.statusMatrix({ fs: gitFs, dir: DIR });
  
  // [filepath, headStatus, workdirStatus, stageStatus]
  const modifiedFiles = statusMatrix
    .filter((row) => row[1] !== row[2] || row[2] !== row[3])
    .map(row => ({
      filepath: row[0],
      status: row[2] === 0 ? 'deleted' : row[1] === 0 ? 'added' : 'modified'
    }));

  return modifiedFiles;
}

export async function stageAllFiles() {
  const status = await getGitStatus();
  for (const { filepath, status: stat } of status) {
    if (stat === 'deleted') {
      await git.remove({ fs: gitFs, dir: DIR, filepath });
    } else {
      await git.add({ fs: gitFs, dir: DIR, filepath });
    }
  }
}

export async function commitChanges(message: string) {
  await stageAllFiles();
  const sha = await git.commit({
    fs: gitFs,
    dir: DIR,
    author: {
      name: 'Krypton User',
      email: 'user@krypton.local',
    },
    message
  });
  return sha;
}
