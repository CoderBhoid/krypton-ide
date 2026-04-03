import React, { useState, useEffect } from 'react';
import { GitCommit, GitPullRequest, GitMerge, Check, RefreshCw, Loader, Github, CloudUpload, CloudDownload, Plus, Link, Unlink, ExternalLink, Search, Lock, Globe } from 'lucide-react';
import { useIdeStore } from '../../store/useIdeStore';
import { useAuthStore, type GitHubUser } from '../../store/useAuthStore';
import { getGitStatus, commitChanges } from '../../lib/gitService';
import { listRepos, createRepo, pushProject, pullRepo, type GitHubRepo, type PushResult } from '../../lib/githubService';

type GitTab = 'changes' | 'github';

export function GitPanel() {
  const { files } = useIdeStore();
  const { githubToken, githubUser, githubRepoLink, setGithubRepoLink } = useAuthStore();
  const [activeTab, setActiveTab] = useState<GitTab>('changes');

  return (
    <div className="flex h-full flex-col text-sm text-gray-300">
      {/* Tab bar */}
      <div className="flex border-b border-[#3c3c3c] px-2 text-xs">
        <button
          className={`flex-1 py-2 text-center uppercase tracking-wider font-semibold transition-colors ${activeTab === 'changes' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}
          onClick={() => setActiveTab('changes')}
        >
          Changes
        </button>
        <button
          className={`flex-1 py-2 text-center uppercase tracking-wider font-semibold transition-colors ${activeTab === 'github' ? 'text-white border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}
          onClick={() => setActiveTab('github')}
        >
          GitHub
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'changes' && <ChangesTab />}
        {activeTab === 'github' && <GitHubTab />}
      </div>
    </div>
  );
}

// ─── Changes Tab (local git) ────────────────────────────────

function ChangesTab() {
  const { files } = useIdeStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [changedFiles, setChangedFiles] = useState<{ filepath: string; status: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const refreshStatus = async () => {
    setIsLoading(true);
    try {
      const status = await getGitStatus();
      setChangedFiles(status);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refreshStatus(); }, [files]);

  const handleCommit = async () => {
    if (!commitMessage.trim() || changedFiles.length === 0) return;
    setIsCommitting(true);
    try {
      await commitChanges(commitMessage);
      setCommitMessage('');
      await refreshStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <textarea
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder="Message (Press Ctrl+Enter to commit)"
        className="w-full resize-none rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) handleCommit();
        }}
      />
      <button
        onClick={handleCommit}
        className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg disabled:opacity-50 transition-colors font-medium"
        disabled={changedFiles.length === 0 || !commitMessage.trim() || isCommitting}
      >
        {isCommitting ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
        <span>{isCommitting ? 'Committing...' : 'Commit'}</span>
      </button>

      <div className="flex items-center justify-between">
        <span className="font-semibold text-white uppercase text-xs tracking-wider">Changes</span>
        <div className="flex items-center space-x-2">
          {isLoading && <Loader size={12} className="animate-spin text-gray-400" />}
          <span className="bg-[#333333] text-xs px-1.5 rounded-full">{changedFiles.length}</span>
        </div>
      </div>

      {changedFiles.length === 0 ? (
        <div className="text-center text-gray-500 mt-4">
          <GitCommit size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">No changes to commit.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {changedFiles.map(file => (
            <div key={file.filepath} className="flex items-center justify-between group hover:bg-[#2a2d2e] p-1.5 rounded cursor-pointer">
              <span className="truncate text-xs">{file.filepath}</span>
              <span className={`text-xs font-mono ${file.status === 'added' ? 'text-green-500' : file.status === 'deleted' ? 'text-red-500' : 'text-blue-500'}`}>
                {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button onClick={refreshStatus} className="w-full flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] py-2 rounded-lg text-xs">
        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
        <span>Refresh</span>
      </button>
    </div>
  );
}

// ─── GitHub Tab ─────────────────────────────────────────────

function GitHubTab() {
  const { githubToken, githubUser, githubRepoLink, setGithubToken, setGithubRepoLink, clearGithub } = useAuthStore();
  const [tokenInput, setTokenInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  // Repo operations state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [showRepoList, setShowRepoList] = useState(false);

  // Push/Pull state
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Create repo state
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setIsConnecting(true);
    setError('');
    const success = await setGithubToken(tokenInput.trim());
    if (!success) {
      setError('Invalid token. Make sure it has "repo" scope.');
    }
    setIsConnecting(false);
    setTokenInput('');
  };

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const r = await listRepos();
      setRepos(r);
    } catch (e: any) {
      setStatusMessage(`Failed to load repos: ${e.message}`);
    }
    setLoadingRepos(false);
  };

  const handleLinkRepo = (repo: GitHubRepo) => {
    const [owner, name] = repo.full_name.split('/');
    setGithubRepoLink({ owner, repo: name });
    setShowRepoList(false);
    setStatusMessage(`Linked to ${repo.full_name}`);
  };

  const handlePush = async () => {
    if (!githubRepoLink) return;
    setIsPushing(true);
    setStatusMessage('');
    setPushResult(null);
    try {
      const result = await pushProject(githubRepoLink.owner, githubRepoLink.repo);
      setPushResult(result);
      if (result.commitSha) {
        setStatusMessage(`✅ Pushed: ${result.created} new, ${result.updated} updated, ${result.deleted} deleted`);
      } else {
        setStatusMessage('✅ Everything is up to date!');
      }
    } catch (e: any) {
      setStatusMessage(`❌ Push failed: ${e.message}`);
    }
    setIsPushing(false);
  };

  const handlePull = async () => {
    if (!githubRepoLink) return;
    setIsPulling(true);
    setStatusMessage('');
    try {
      const count = await pullRepo(githubRepoLink.owner, githubRepoLink.repo);
      setStatusMessage(`✅ Pulled ${count} files from ${githubRepoLink.owner}/${githubRepoLink.repo}`);
    } catch (e: any) {
      setStatusMessage(`❌ Pull failed: ${e.message}`);
    }
    setIsPulling(false);
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setIsCreating(true);
    setStatusMessage('');
    try {
      const repo = await createRepo(newRepoName.trim(), newRepoDesc, newRepoPrivate);
      const user = useAuthStore.getState().githubUser;
      setGithubRepoLink({ owner: user!.login, repo: repo.name });
      setShowCreateRepo(false);
      setNewRepoName('');
      setNewRepoDesc('');
      setStatusMessage(`✅ Created & linked to ${repo.full_name}`);
      // Auto-push after create
      setTimeout(handlePush, 1500);
    } catch (e: any) {
      setStatusMessage(`❌ ${e.message}`);
    }
    setIsCreating(false);
  };

  // ── Not connected ──
  if (!githubToken || !githubUser) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-6">
          <Github size={40} className="mx-auto mb-3 text-gray-500" />
          <h3 className="text-white font-semibold mb-1">Connect GitHub</h3>
          <p className="text-gray-500 text-xs leading-relaxed mb-4">
            Link your account to push/pull repos directly from Krypton IDE.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="Paste your GitHub Personal Access Token"
            className="w-full rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleConnect}
            disabled={isConnecting || !tokenInput.trim()}
            className="w-full flex items-center justify-center space-x-2 bg-[#238636] hover:bg-[#2ea043] text-white py-2.5 rounded-lg disabled:opacity-50 transition-colors font-medium"
          >
            {isConnecting ? <Loader size={14} className="animate-spin" /> : <Github size={14} />}
            <span>{isConnecting ? 'Validating...' : 'Connect'}</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 bg-[#1e1e1e] p-3 rounded-lg border border-[#2d2d2d] space-y-1.5">
          <p className="font-semibold text-gray-400">How to get a token:</p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>Go to github.com → Settings → Developer settings</li>
            <li>Personal access tokens → Tokens (classic)</li>
            <li>Generate new token with <strong className="text-blue-400">repo</strong> scope</li>
            <li>Copy and paste it above</li>
          </ol>
          <a
            href="https://github.com/settings/tokens/new?description=Krypton%20IDE&scopes=repo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 mt-2"
          >
            <ExternalLink size={11} />
            <span>Create token directly →</span>
          </a>
        </div>
      </div>
    );
  }

  // ── Connected ──
  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4">
      {/* User profile */}
      <div className="flex items-center space-x-3 bg-[#1e1e1e] p-3 rounded-lg border border-[#2d2d2d]">
        <img src={githubUser.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border border-[#3c3c3c]" />
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{githubUser.name || githubUser.login}</p>
          <p className="text-gray-500 text-xs truncate">@{githubUser.login}</p>
        </div>
        <button
          onClick={clearGithub}
          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Linked repo */}
      {githubRepoLink ? (
        <div className="bg-[#1e1e1e] p-3 rounded-lg border border-[#2d2d2d] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <Link size={12} className="text-green-400 flex-shrink-0" />
              <span className="text-white text-xs font-mono truncate">{githubRepoLink.owner}/{githubRepoLink.repo}</span>
            </div>
            <button
              onClick={() => { setGithubRepoLink(null); setStatusMessage(''); setPushResult(null); }}
              className="text-gray-500 hover:text-white hover:bg-white/10 p-1 rounded"
              title="Unlink"
            >
              <Unlink size={12} />
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handlePush}
              disabled={isPushing}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg disabled:opacity-50 transition-colors text-xs font-medium"
            >
              {isPushing ? <Loader size={12} className="animate-spin" /> : <CloudUpload size={12} />}
              <span>{isPushing ? 'Pushing...' : 'Push'}</span>
            </button>
            <button
              onClick={handlePull}
              disabled={isPulling}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] text-white py-2 rounded-lg disabled:opacity-50 transition-colors text-xs font-medium"
            >
              {isPulling ? <Loader size={12} className="animate-spin" /> : <CloudDownload size={12} />}
              <span>{isPulling ? 'Pulling...' : 'Pull'}</span>
            </button>
          </div>

          <a
            href={`https://github.com/${githubRepoLink.owner}/${githubRepoLink.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <ExternalLink size={11} />
            <span>View on GitHub</span>
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex space-x-2">
            <button
              onClick={() => { setShowRepoList(true); loadRepos(); }}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <Link size={12} />
              <span>Link Existing Repo</span>
            </button>
            <button
              onClick={() => setShowCreateRepo(true)}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus size={12} />
              <span>Publish New</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Repo Dialog */}
      {showCreateRepo && (
        <div className="bg-[#1e1e1e] p-3 rounded-lg border border-blue-500/30 space-y-3">
          <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Create & Publish Repository</h4>
          <input
            value={newRepoName}
            onChange={e => setNewRepoName(e.target.value.replace(/\s+/g, '-'))}
            placeholder="repository-name"
            className="w-full rounded-lg border border-[#3c3c3c] bg-[#252526] p-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm font-mono"
          />
          <input
            value={newRepoDesc}
            onChange={e => setNewRepoDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[#3c3c3c] bg-[#252526] p-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
          />
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setNewRepoPrivate(false)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs border transition-colors ${!newRepoPrivate ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-[#3c3c3c] text-gray-500 hover:text-white'}`}
            >
              <Globe size={12} />
              <span>Public</span>
            </button>
            <button
              onClick={() => setNewRepoPrivate(true)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs border transition-colors ${newRepoPrivate ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' : 'border-[#3c3c3c] text-gray-500 hover:text-white'}`}
            >
              <Lock size={12} />
              <span>Private</span>
            </button>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCreateRepo(false)}
              className="flex-1 py-2 rounded-lg bg-[#2d2d2d] hover:bg-[#3a3a3a] text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRepo}
              disabled={isCreating || !newRepoName.trim()}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg disabled:opacity-50 text-xs font-medium transition-colors"
            >
              {isCreating ? <Loader size={12} className="animate-spin" /> : <CloudUpload size={12} />}
              <span>{isCreating ? 'Creating...' : 'Create & Push'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Repo list */}
      {showRepoList && (
        <div className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] overflow-hidden">
          <div className="p-2 border-b border-[#2d2d2d]">
            <div className="flex items-center space-x-2 bg-[#252526] rounded-lg px-2">
              <Search size={12} className="text-gray-500 flex-shrink-0" />
              <input
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                placeholder="Search repos..."
                className="flex-1 bg-transparent py-2 text-white placeholder-gray-500 focus:outline-none text-xs"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-6">
                <Loader size={18} className="animate-spin text-gray-500" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <p className="text-center text-gray-500 text-xs py-4">No repos found</p>
            ) : (
              filteredRepos.map(r => (
                <button
                  key={r.full_name}
                  onClick={() => handleLinkRepo(r)}
                  className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-[#2a2d2e] text-left border-b border-[#2d2d2d]/50 last:border-0"
                >
                  {r.private ? <Lock size={11} className="text-yellow-500 flex-shrink-0" /> : <Globe size={11} className="text-green-500 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{r.name}</p>
                    {r.description && <p className="text-gray-500 text-[10px] truncate">{r.description}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => { setShowRepoList(false); setRepoSearch(''); }}
            className="w-full p-2 text-xs text-gray-500 hover:text-white hover:bg-[#2a2d2e] border-t border-[#2d2d2d]"
          >
            Close
          </button>
        </div>
      )}

      {/* Status message */}
      {statusMessage && (
        <div className={`text-xs p-2.5 rounded-lg ${statusMessage.startsWith('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : statusMessage.startsWith('❌') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
