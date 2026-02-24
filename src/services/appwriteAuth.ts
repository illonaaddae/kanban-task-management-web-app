import { account, storage, STORAGE_BUCKET_ID } from "../lib/appwrite";
import { ID, OAuthProvider } from "appwrite";
import type { User, AuthService } from "./authTypes";

/** Basic email format check so typos like "user@gmailcom" are caught early. */
function validateEmail(email: string): void {
  // Matches: local@domain.tld (at minimum)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error(
      `"${email}" doesn't look like a valid email address. Check for typos (e.g. missing dot in the domain).`,
    );
  }
}

export class AppwriteAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    validateEmail(email);
    try {
      // Destroy any existing session so Appwrite allows a new one
      try {
        await account.deleteSession("current");
      } catch {
        /* no session — fine */
      }
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      localStorage.setItem("kanban_user", user.name);
      return {
        id: user.$id,
        email: user.email,
        name: user.name,
        avatar: user.prefs?.avatar,
      };
    } catch (error: any) {
      console.error("Login error:", error);
      const message = error?.message || "Invalid email or password";
      throw new Error(message);
    }
  }

  async loginWithSlack(): Promise<void> {
    try {
      // createOAuth2Token redirects to Slack and returns ?userId=...&secret=...
      // on the success URL. The session is then created via createSession() in
      // handleOAuthCallback — a direct XHR that works with Firefox's cookie policy.
      account.createOAuth2Token(
        OAuthProvider.Slack,
        `${window.location.origin}/login`,
        `${window.location.origin}/login`,
      );
    } catch (error) {
      console.error("Slack OAuth error:", error);
      throw new Error("Failed to authenticate with Slack");
    }
  }

  async loginWithGoogle(): Promise<void> {
    try {
      // createOAuth2Token redirects to Google and returns ?userId=...&secret=...
      // on the success URL. The session is then created via createSession() in
      // handleOAuthCallback — a direct XHR that works with Firefox's cookie policy.
      // NOTE: To sign in with a DIFFERENT Google account, the user must first
      // sign out of Google (accounts.google.com) so Google shows the picker.
      account.createOAuth2Token(
        OAuthProvider.Google,
        `${window.location.origin}/login`,
        `${window.location.origin}/login`,
      );
    } catch (error) {
      console.error("Google OAuth error:", error);
      throw new Error("Failed to authenticate with Google");
    }
  }

  async register(email: string, password: string, name: string): Promise<User> {
    console.log("[Register] Starting registration for:", email);
    
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error("Name is required");
    }
    if (!email || email.trim().length === 0) {
      throw new Error("Email is required");
    }
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    
    validateEmail(email);
    
    try {
      // Destroy any existing session before registering
      try {
        await account.deleteSessions();
        console.log("[Register] Cleared existing sessions");
      } catch {
        /* no session — fine */
      }
      
      console.log("[Register] Creating user account...");
      const user = await account.create(ID.unique(), email, password, name);
      console.log("[Register] User created with ID:", user.$id);
      
      console.log("[Register] Creating email/password session...");
      await account.createEmailPasswordSession(email, password);
      console.log("[Register] Session created successfully");
      
      return {
        id: user.$id,
        email: user.email,
        name: user.name,
        avatar: user.prefs?.avatar,
      };
    } catch (error: any) {
      console.error("[Register] Registration error:", error);
      console.error("[Register] Error details:", {
        message: error?.message,
        code: error?.code,
        type: error?.type,
        response: error?.response,
      });
      
      // Parse Appwrite error codes to give actionable messages
      const code = error?.code;
      const type = error?.type;
      let message: string;
      
      if (code === 409 || type === "user_already_exists") {
        message =
          "An account with this email already exists. Try signing in instead.";
      } else if (
        type === "general_argument_invalid" ||
        type === "password_personal_data"
      ) {
        message =
          "Registration failed. Your password may be too common or contain personal data. Try a stronger, more unique password.";
      } else if (type === "user_password_mismatch" || type === "user_invalid_credentials") {
        message = "Invalid password. Please use a different password.";
      } else if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
        message = "Network error. Please check your internet connection and try again.";
      } else {
        message =
          error?.message || "Failed to create account. Please try again.";
      }
      throw new Error(message);
    }
  }

  async logout(): Promise<void> {
    try {
      await account.deleteSessions();
      localStorage.removeItem("kanban_user");
      localStorage.removeItem("cookieFallback");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("kanban_user");
      localStorage.removeItem("cookieFallback");
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await account.get();
      return {
        id: user.$id,
        email: user.email,
        name: user.name,
        avatar: user.prefs?.avatar,
      };
    } catch {
      return null;
    }
  }

  async handleOAuthCallback(
    oauthUserId?: string,
    oauthSecret?: string,
  ): Promise<User | null> {
    try {
      if (oauthUserId && oauthSecret) {
        console.log("[OAuth] Exchanging token for session — userId:", oauthUserId);

        // Delete any stale session first so there's no conflict.
        try { await account.deleteSession('current'); } catch { /* no active session */ }

        // createSession() is a direct XHR call — the Appwrite SDK stores the
        // resulting session in localStorage (cookieFallback), bypassing Firefox's
        // cross-site cookie restrictions entirely.
        await account.createSession(oauthUserId, oauthSecret);
        const user = await account.get();

        console.log("[OAuth] Session created — user:", user.email, "(id:", user.$id + ")");

        if (user.$id !== oauthUserId) {
          console.error("[OAuth] User ID mismatch — expected:", oauthUserId, "got:", user.$id);
        }

        localStorage.setItem("kanban_user", user.name);
        return {
          id: user.$id,
          email: user.email,
          name: user.name,
          avatar: user.prefs?.avatar,
        };
      }

      // No OAuth params — silently check for an existing session (page refresh).
      try {
        const user = await account.get();
        localStorage.setItem("kanban_user", user.name);
        return {
          id: user.$id,
          email: user.email,
          name: user.name,
          avatar: user.prefs?.avatar,
        };
      } catch {
        return null;
      }
    } catch (error: any) {
      console.error("[OAuth] handleOAuthCallback error:", error?.message);
      return null;
    }
  }

  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    try {
      await account.updateName(name);
      if (avatarFile) {
        try {
          const file = await storage.createFile(
            STORAGE_BUCKET_ID,
            ID.unique(),
            avatarFile,
          );
          const avatarUrl = storage.getFileView(STORAGE_BUCKET_ID, file.$id);
          const user = await account.get();
          await account.updatePrefs({ ...user.prefs, avatar: avatarUrl.toString() });
        } catch (uploadError) {
          console.error("Failed to upload avatar:", uploadError);
          throw new Error("Failed to upload profile picture");
        }
      }
      const updatedUser = await account.get();
      localStorage.setItem("kanban_user", updatedUser.name);
      return {
        id: updatedUser.$id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.prefs?.avatar,
      };
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  }
}
