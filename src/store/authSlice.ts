import type { User } from "../services/authService";
import { authService } from "../services/authService";
import { useKanbanStore } from "./kanbanStore";
import { queryClient } from "../queries/queryClient";
import toast from "react-hot-toast";
import type { StoreSet } from "./store";

/**
 * Applies the theme the server has stored for this account.
 *
 * Called on every path that establishes a session - login, register, OAuth
 * return and session restore - so the preference follows the user across
 * devices rather than living only in this browser's local state.
 */
function applyServerTheme(user: User | null): void {
  if (user?.themePreference) {
    useKanbanStore.getState().setTheme(user.themePreference);
  }
}
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

export const createAuthSlice = (set: StoreSet): AuthState => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (email, password) => {
    // Clear old account state before logging in as a (possibly different) user
    set({ loading: true, error: null });
    try {
      const user = await authService.login(email, password);
      applyServerTheme(user);
      set({ user, isAuthenticated: true });
      queryClient.clear();
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  register: async (email, password, name) => {
    // Clear old account state before registering a new account
    set({ loading: true, error: null });
    try {
      const user = await authService.register(email, password, name);
      applyServerTheme(user);
      set({ user, isAuthenticated: true });
      queryClient.clear();
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
      });
      // Boards live in the query cache now, so signing out has to empty it -
      // otherwise the next account to sign in on this browser is served the
      // previous one's boards from cache before any request goes out.
      queryClient.clear();
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
    if (_checkingSession) return;
    _checkingSession = true;
    set({ loading: true });

    try {
      // The API backend reports a failed Google sign-in in the URL *fragment*
      // (`#error=…&error_description=…`), matching where it puts tokens on
      // success. Handled before anything else so a failed return never falls
      // through to the token path.
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const hashError = hashParams.get("error");

      if (hashError) {
        // Strip the fragment so a refresh does not replay the error.
        window.history.replaceState(
          {},
          "",
          window.location.pathname + window.location.search,
        );

        toast.error(
          hashParams.get("error_description") ||
            "Google sign-in failed. Please try again.",
          { duration: 6000 },
        );
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

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
        // Show a user-friendly toast so the user knows why sign-in failed
        try {
          const parsed = JSON.parse(oauthError);
          if (parsed.type === "user_missing_id") {
            toast.error(
              "Slack sign-in failed: the app is misconfigured. Please contact the admin.",
              { duration: 6000 },
            );
          } else {
            toast.error(parsed.message || "Sign-in failed. Please try again.", {
              duration: 5000,
            });
          }
        } catch {
          // oauthError wasn't JSON - show a generic message
          toast.error("Sign-in failed. Please try again.", { duration: 5000 });
        }
        set({ user: null, isAuthenticated: false, loading: false });
        return;
      }

      // Exchange the one-time token for a real session (createOAuth2Token flow).
      const user = await authService.handleOAuthCallback(
        oauthUserId ?? undefined,
        oauthSecret ?? undefined,
      );

      if (user) {
        // Covers both the OAuth return and a silent session restore on reload,
        // so a reload never flashes the wrong theme.
        applyServerTheme(user);
        set({
          user,
          isAuthenticated: true,
          loading: false,
        });
        queryClient.clear();

        // Only toast after an active OAuth redirect, not on silent page-refresh restores.
        if (isOAuthReturn) {
          toast.success(`Signed in as ${user.email}`, { duration: 4000 });
        }
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    } catch (error: any) {
      console.error("[checkSession] Session check error:", error);
      set({ user: null, isAuthenticated: false, loading: false });
    } finally {
      _checkingSession = false;
    }
  },
});
