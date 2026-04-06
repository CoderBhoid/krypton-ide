import { create } from 'zustand';
import { readAuth, saveAuthDebounced } from '../lib/fileSystemStorage';
import { setDriveAccessToken, clearDriveAccessToken } from '../lib/googleDriveSync';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  html_url: string;
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

interface AuthState {
  // GitHub
  githubToken: string | null;
  githubUser: GitHubUser | null;
  githubRepoLink: { owner: string; repo: string } | null;

  setGithubToken: (token: string) => Promise<boolean>;
  clearGithub: () => void;
  setGithubRepoLink: (link: { owner: string; repo: string } | null) => void;

  // Google
  googleUser: GoogleUser | null;
  googleAccessToken: string | null;
  setGoogleUser: (user: GoogleUser | null) => void;
  setGoogleAuth: (user: GoogleUser, accessToken: string) => void;
  clearGoogle: () => void;

  // Load from disk
  loadFromDisk: () => Promise<void>;
}

function persistAuth(state: AuthState) {
  saveAuthDebounced({
    githubToken: state.githubToken,
    githubUser: state.githubUser,
    githubRepoLink: state.githubRepoLink,
    googleUser: state.googleUser,
    // Note: accessToken is NOT persisted — it's session-only and refreshed via GoogleAuth.refresh()
  });
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    githubToken: null,
    githubUser: null,
    githubRepoLink: null,
    googleUser: null,
    googleAccessToken: null,

    loadFromDisk: async () => {
      try {
        const data = await readAuth();
        if (data) {
          set({
            githubToken: data.githubToken || null,
            githubUser: data.githubUser || null,
            githubRepoLink: data.githubRepoLink || null,
            googleUser: data.googleUser || null,
          });
        }
      } catch (e) {
        console.error('[Auth] Failed to load from disk:', e);
      }
    },

    setGithubToken: async (token: string) => {
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (!res.ok) {
          set({ githubToken: null, githubUser: null });
          return false;
        }
        const user: GitHubUser = await res.json();
        set({ githubToken: token, githubUser: user });
        persistAuth(get());
        return true;
      } catch {
        set({ githubToken: null, githubUser: null });
        return false;
      }
    },

    clearGithub: () => {
      set({ githubToken: null, githubUser: null, githubRepoLink: null });
      persistAuth(get());
    },

    setGithubRepoLink: (link) => {
      set({ githubRepoLink: link });
      persistAuth(get());
    },

    // Set only profile (backward compat for welcome screen mock)
    setGoogleUser: (user) => {
      set({ googleUser: user });
      persistAuth(get());
    },

    // Set both profile AND access token (for Drive API)
    setGoogleAuth: (user, accessToken) => {
      set({ googleUser: user, googleAccessToken: accessToken });
      setDriveAccessToken(accessToken);
      persistAuth(get());
    },

    clearGoogle: () => {
      set({ googleUser: null, googleAccessToken: null });
      clearDriveAccessToken();
      persistAuth(get());
    },
  })
);
