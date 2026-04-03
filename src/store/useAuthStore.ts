import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  githubRepoLink: { owner: string; repo: string } | null; // linked repo for current project

  setGithubToken: (token: string) => Promise<boolean>;
  clearGithub: () => void;
  setGithubRepoLink: (link: { owner: string; repo: string } | null) => void;

  // Google (placeholder — needs Client ID)
  googleUser: GoogleUser | null;
  setGoogleUser: (user: GoogleUser | null) => void;
  clearGoogle: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      githubToken: null,
      githubUser: null,
      githubRepoLink: null,

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
          return true;
        } catch {
          set({ githubToken: null, githubUser: null });
          return false;
        }
      },

      clearGithub: () => set({ githubToken: null, githubUser: null, githubRepoLink: null }),

      setGithubRepoLink: (link) => set({ githubRepoLink: link }),

      googleUser: null,
      setGoogleUser: (user) => set({ googleUser: user }),
      clearGoogle: () => set({ googleUser: null }),
    }),
    {
      name: 'krypton-auth-storage',
      partialize: (state) => ({
        githubToken: state.githubToken,
        githubUser: state.githubUser,
        githubRepoLink: state.githubRepoLink,
        googleUser: state.googleUser,
      }),
    }
  )
);
