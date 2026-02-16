import { account, storage, STORAGE_BUCKET_ID } from '../lib/appwrite';
import { ID, OAuthProvider } from 'appwrite';
import type { User, AuthService } from './authService';

export class AppwriteAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    try {
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      localStorage.setItem('kanban_user', user.name);
      return { id: user.$id, email: user.email, name: user.name, avatar: user.prefs?.avatar };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Invalid email or password');
    }
  }

  async loginWithSlack(): Promise<void> {
    try {
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
      return { id: user.$id, email: user.email, name: user.name, avatar: user.prefs?.avatar };
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
      return { id: user.$id, email: user.email, name: user.name, avatar: user.prefs?.avatar };
    } catch {
      return null;
    }
  }

  async handleOAuthCallback(): Promise<User | null> {
    try {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      const secret = params.get('secret');

      if (userId && secret) {
        await account.createSession(userId, secret);
        window.history.replaceState({}, '', window.location.pathname);
      }

      const user = await account.get();
      localStorage.setItem('kanban_user', user.name);
      return { id: user.$id, email: user.email, name: user.name, avatar: user.prefs?.avatar };
    } catch (error) {
      console.error('OAuth callback error:', error);
      return null;
    }
  }

  async updateProfile(name: string, avatarFile?: File): Promise<User> {
    try {
      await account.updateName(name);
      if (avatarFile) {
        try {
          const file = await storage.createFile(STORAGE_BUCKET_ID, ID.unique(), avatarFile);
          const avatarUrl = storage.getFileView(STORAGE_BUCKET_ID, file.$id);
          const user = await account.get();
          await account.updatePrefs({ ...user.prefs, avatar: avatarUrl });
        } catch (uploadError) {
          console.error('Failed to upload avatar:', uploadError);
          throw new Error('Failed to upload profile picture');
        }
      }
      const updatedUser = await account.get();
      localStorage.setItem('kanban_user', updatedUser.name);
      return {
        id: updatedUser.$id, email: updatedUser.email,
        name: updatedUser.name, avatar: updatedUser.prefs?.avatar
      };
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
}
