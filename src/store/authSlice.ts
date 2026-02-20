import type { User } from "../services/authService";
import { authService } from "../services/authService";
import type { StoreSet, StoreGet } from "./store";
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
let _checkingSession = false;

export const createAuthSlice = (set: StoreSet, get: StoreGet): AuthState => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (email, password) => {
    // Clear old account state before logging in as a (possibly different) user
    set({ loading: true, error: null, boards: [], currentBoard: null });
    try {
      const user = await authService.login(email, password);
      set({ user, isAuthenticated: true });
      await get().fetchBoards(user.id);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  register: async (email, password, name) => {
    // Clear old account state before registering a new account
    set({ loading: true, error: null, boards: [], currentBoard: null });
    try {
      const user = await authService.register(email, password, name);
      set({ user, isAuthenticated: true });
      await get().fetchBoards(user.id);
      set({ loading: false });
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
        currentBoard: null,
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
    if (_checkingSession) {
      console.log("[checkSession] Already checking session, skipping");
      return;
    }
    _checkingSession = true;
    set({ loading: true });

    console.log("[checkSession] Starting session check");

    try {
      const params = new URLSearchParams(window.location.search);
      const oauthUserId = params.get("userId");
      const oauthSecret = params.get("secret");
      const oauthError = params.get("error");
      const isOAuthReturn = !!(oauthUserId && oauthSecret);

      // Clean the URL immediately so a hard-refresh doesn't reuse a spent token.
      if (oauthUserId || oauthSecret || oauthError) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      if (oauthError) {
        console.error("[checkSession] OAuth error from provider:", oauthError);
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      // Exchange the one-time token for a real session (createOAuth2Token flow).
      const user = await authService.handleOAuthCallback(
        oauthUserId ?? undefined,
        oauthSecret ?? undefined,
      );

      if (user) {
        console.log("[checkSession] User resolved:", user.email);
        set({
          user,
          isAuthenticated: true,
          loading: false,
          boards: [],
          currentBoard: null,
        });
        await get().fetchBoards(user.id);

        // Only toast after an active OAuth redirect, not on silent page-refresh restores.
        if (isOAuthReturn) {
          const { toast } = await import("react-hot-toast");
          toast.success(`Signed in as ${user.email}`, { duration: 4000 });
        }
      } else {
        console.log("[checkSession] No active session");
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error: any) {
      console.error("[checkSession] Session check error:", error);
      set({ user: null, isAuthenticated: false, loading: false });
    } finally {
      _checkingSession = false;
      console.log("[checkSession] Session check complete");
    }
  },
});
