import { api, API_URL, tokenStore } from "./api";
import type { AuthService, User } from "./authTypes";

/** The user shape the API returns - `id` already mapped from `_id` server-side. */
interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  themePreference: "light" | "dark";
  avatar?: string;
}

interface AuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

function toUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    themePreference: user.themePreference,
  };
}

/**
 * Reads a data URL out of a File.
 *
 * The API stores `avatar` as a string, so an upload becomes a data URL rather
 * than a multipart body. The server caps JSON at 1mb, which bounds the size.
 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image"));
    reader.readAsDataURL(file);
  });
}

/**
 * `AuthService` backed by the Express API.
 *
 * Tokens live in localStorage via `tokenStore`; `kanban_user` is still written
 * because parts of the existing app read it directly as a "someone is signed
 * in" hint.
 */
export class ApiAuthService implements AuthService {
  private store(response: AuthResponse): User {
    tokenStore.set(response.accessToken, response.refreshToken);
    localStorage.setItem("kanban_user", response.user.name);
    return toUser(response.user);
  }

  async login(email: string, password: string): Promise<User> {
    const response = await api.post<AuthResponse>(
      "/auth/login",
      { email, password },
      { skipAuth: true },
    );

    return this.store(response);
  }

  async register(email: string, password: string, name: string): Promise<User> {
    const response = await api.post<AuthResponse>(
      "/auth/register",
      { name, email, password },
      { skipAuth: true },
    );

    return this.store(response);
  }

  async logout(): Promise<void> {
    try {
      // Bumps tokenVersion server-side, killing every other session too.
      await api.post("/auth/logout");
    } catch {
      // An expired or already-invalid token still means "log me out" locally -
      // never leave the user stuck on a screen they cannot leave.
    } finally {
      tokenStore.clear();
      localStorage.removeItem("kanban_user");
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!tokenStore.isAuthenticated) return null;

    try {
      const { user } = await api.get<{ user: ApiUser }>("/auth/me");
      return toUser(user);
    } catch {
      // The token was rejected and could not be refreshed - treat as signed out
      // rather than surfacing an error on every page load.
      tokenStore.clear();
      localStorage.removeItem("kanban_user");
      return null;
    }
  }

  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    const payload: { name: string; avatar?: string } = { name };
    if (avatarFile) payload.avatar = await readAsDataUrl(avatarFile);

    const { user } = await api.patch<{ user: ApiUser }>("/users/me", payload);

    localStorage.setItem("kanban_user", user.name);
    return toUser(user);
  }

  /**
   * Hands the browser to the backend, which redirects to Google and comes back
   * to `/login#token=…&refresh=…`. Never resolves - the page is navigating.
   */
  async loginWithGoogle(): Promise<void> {
    window.location.href = `${API_URL}/auth/google`;
  }

  async loginWithSlack(): Promise<void> {
    throw new Error("Slack sign-in is not supported");
  }

  /**
   * Completes the Google round trip.
   *
   * Tokens arrive in the URL **hash** rather than the query string, so they
   * never reach the server's access logs. The hash is cleared immediately with
   * `replaceState`, so the tokens do not sit in history or get copy-pasted with
   * the URL.
   *
   * The Appwrite implementation took `(userId, secret)`; those are ignored here
   * because the tokens come from the fragment. The signature stays the same so
   * the store's call site does not have to branch on the provider.
   */
  async handleOAuthCallback(): Promise<User | null> {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (hash) {
      const params = new URLSearchParams(hash);
      const accessToken = params.get("token");
      const refreshToken = params.get("refresh");

      if (accessToken) {
        tokenStore.set(accessToken, refreshToken ?? undefined);

        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
    }

    return this.getCurrentUser();
  }
}

export default ApiAuthService;
