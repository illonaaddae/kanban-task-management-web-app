import type { User } from '../services/authService';
import { authService } from '../services/authService';
import type { StoreSet, StoreGet } from './store';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithSlack: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const createAuthSlice = (set: StoreSet, get: StoreGet): AuthState => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.login(email, password);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ loading: true, error: null });
    try {
      const user = await authService.register(email, password, name);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await authService.logout();
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        boards: [],
        currentBoard: null
      });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      await authService.loginWithGoogle();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  loginWithSlack: async () => {
    set({ loading: true, error: null });
    try {
      await authService.loginWithSlack();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  checkSession: async () => {
    set({ loading: true });
    try {
      const params = new URLSearchParams(window.location.search);
      const hasOAuthParams = params.has('userId') && params.has('secret');
      let user = null;

      if (hasOAuthParams) {
        user = await authService.handleOAuthCallback();
      } else {
        user = await authService.getCurrentUser();
      }

      if (user) {
        set({ user, isAuthenticated: true, loading: false });
        const { fetchBoards } = get();
        await fetchBoards(user.id);
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error) {
      console.error('Session check error:', error);
      set({ user: null, isAuthenticated: false, loading: false });
    }
  },
});
