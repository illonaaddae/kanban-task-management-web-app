import { account, storage, STORAGE_BUCKET_ID } from '../lib/appwrite';
import { ID, OAuthProvider } from 'appwrite';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<User>;
  loginWithSlack(): Promise<void>;
  loginWithGoogle(): Promise<void>;
  register(email: string, password: string, name: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  handleOAuthCallback(): Promise<User | null>;
  updateProfile(name: string, avatarFile?: File): Promise<User>;
}

// Appwrite Authentication Service
class AppwriteAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    try {
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      localStorage.setItem('kanban_user', user.name);
      return { 
        id: user.$id, 
        email: user.email, 
        name: user.name,
        avatar: user.prefs?.avatar 
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Invalid email or password');
    }
  }

  async loginWithSlack(): Promise<void> {
    try {
      // Use token-based OAuth to avoid cross-domain cookie issues
      // After auth, Appwrite appends ?userId=...&secret=... to success URL
      account.createOAuth2Token(
        OAuthProvider.Slack,
        `${window.location.origin}/`,
        `${window.location.origin}/login`
      );
    } catch (error) {
      console.error('Slack OAuth error:', error);
      throw new Error('Failed to authenticate with Slack');
    }
  }

  async loginWithGoogle(): Promise<void> {
    try {
      // Use token-based OAuth to avoid cross-domain cookie issues
      // After auth, Appwrite appends ?userId=...&secret=... to success URL
      account.createOAuth2Token(
        OAuthProvider.Google,
        `${window.location.origin}/`,
        `${window.location.origin}/login`
      );
    } catch (error) {
      console.error('Google OAuth error:', error);
      throw new Error('Failed to authenticate with Google');
    }
  }

  async register(email: string, password: string, name: string): Promise<User> {
    try {
      const user = await account.create(ID.unique(), email, password, name);
      await this.login(email, password);
      return { 
        id: user.$id, 
        email: user.email, 
        name: user.name,
        avatar: user.prefs?.avatar 
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error('Failed to create account. Email may already be in use.');
    }
  }

  async logout(): Promise<void> {
    try {
      await account.deleteSession('current');
      localStorage.removeItem('kanban_user');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('kanban_user');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = await account.get();
      return { 
        id: user.$id, 
        email: user.email, 
        name: user.name,
        avatar: user.prefs?.avatar 
      };
    } catch {
      return null;
    }
  }

  async handleOAuthCallback(): Promise<User | null> {
    try {
      // Check for OAuth token params in the URL (?userId=...&secret=...)
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      const secret = params.get('secret');

      if (userId && secret) {
        // Create session from the OAuth token (client-side, no cookies needed)
        await account.createSession(userId, secret);

        // Clean the URL (remove query params)
        window.history.replaceState({}, '', window.location.pathname);
      }

      // Get the authenticated user
      const user = await account.get();
      localStorage.setItem('kanban_user', user.name);
      return { 
        id: user.$id, 
        email: user.email, 
        name: user.name,
        avatar: user.prefs?.avatar 
      };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return null;
    }
  }
  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    try {
      // 1. Update name if changed
      await account.updateName(name);

      let avatarUrl = undefined;

      // 2. Upload avatar if provided
      if (avatarFile) {
        try {
          const file = await storage.createFile(
            STORAGE_BUCKET_ID,
            ID.unique(),
            avatarFile
          );

          // Get file view URL
          const result = storage.getFileView(STORAGE_BUCKET_ID, file.$id);
          avatarUrl = result; // Result is already the URL string

          // Update user preferences with avatar URL
          const user = await account.get();
          await account.updatePrefs({
            ...user.prefs,
            avatar: avatarUrl
          });
        } catch (uploadError) {
          console.error('Failed to upload avatar:', uploadError);
          throw new Error('Failed to upload profile picture');
        }
      }

      // 3. Return updated user
      const updatedUser = await account.get();
      localStorage.setItem('kanban_user', updatedUser.name);
      
      return {
        id: updatedUser.$id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.prefs?.avatar
      };
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
}

// Mock Authentication Service (for development/testing)
class MockAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    if (!email || !password) throw new Error('Invalid credentials');
    const user = { id: '1', email, name: email.split('@')[0], avatar: undefined };
    localStorage.setItem('kanban_user', user.name);
    return user;
  }

  async loginWithSlack(): Promise<void> {
    localStorage.setItem('kanban_user', 'Slack User');
    window.location.href = '/';
  }

  async loginWithGoogle(): Promise<void> {
    localStorage.setItem('kanban_user', 'Google User');
    window.location.href = '/';
  }

  async register(_email: string, password: string, name: string): Promise<User> {
    if (!password) throw new Error('Password is required');
    const user = { id: '1', email: _email, name, avatar: undefined };
    localStorage.setItem('kanban_user', name);
    return user;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('kanban_user');
  }

  async getCurrentUser(): Promise<User | null> {
    const name = localStorage.getItem('kanban_user');
    const avatar = localStorage.getItem('kanban_avatar') || undefined;
    return name ? { id: '1', email: `${name}@demo.com`, name, avatar } : null;
  }

  async handleOAuthCallback(): Promise<User | null> {
    return this.getCurrentUser();
  }

  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    localStorage.setItem('kanban_user', name);
    let avatar = undefined;
    
    if (avatarFile) {
      avatar = URL.createObjectURL(avatarFile);
      localStorage.setItem('kanban_avatar', avatar);
    }
    
    return {
      id: '1',
      email: `${name}@demo.com`,
      name,
      avatar
    };
  }
}

// Export the appropriate service based on environment
const useAppwrite = import.meta.env.VITE_USE_APPWRITE === 'true';

export const authService: AuthService = useAppwrite
  ? new AppwriteAuthService()
  : new MockAuthService();
