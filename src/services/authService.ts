import { account } from '../lib/appwrite';
import { ID } from 'appwrite';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthService {
  login(email: string, password: string): Promise<User>;
  register(email: string, password: string, name: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
}

// Appwrite Authentication Service
class AppwriteAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    try {
      // Create email session
      await account.createEmailPasswordSession(email, password);
      
      // Get user details
      const user = await account.get();
      
      // Save to localStorage for offline access
      localStorage.setItem('kanban_user', user.name);
      
      return {
        id: user.$id,
        email: user.email,
        name: user.name,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Invalid email or password');
    }
  }

  async register(email: string, password: string, name: string): Promise<User> {
    try {
      // Create account
      const user = await account.create(ID.unique(), email, password, name);
      
      // Auto-login after registration
      await this.login(email, password);
      
      return {
        id: user.$id,
        email: user.email,
        name: user.name,
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
      // Still clear localStorage even if API call fails
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
      };
    } catch {
      // No active session
      return null;
    }
  }
}

// Mock Authentication Service (for development/testing)
class MockAuthService implements AuthService {
  async login(email: string, password: string): Promise<User> {
    if (!email || !password) {
      throw new Error('Invalid credentials');
    }
    
    const user = { 
      id: '1', 
      email, 
      name: email.split('@')[0] 
    };
    
    localStorage.setItem('kanban_user', user.name);
    return user;
  }

  async register(email: string, password: string, name: string): Promise<User> {
    const user = { id: '1', email, name };
    localStorage.setItem('kanban_user', name);
    return user;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('kanban_user');
  }

  async getCurrentUser(): Promise<User | null> {
    const username = localStorage.getItem('kanban_user');
    return username 
      ? { id: '1', email: `${username}@demo.com`, name: username } 
      : null;
  }
}

// Export the appropriate service based on environment
const useAppwrite = import.meta.env.VITE_USE_APPWRITE === 'true';

export const authService: AuthService = useAppwrite
  ? new AppwriteAuthService()
  : new MockAuthService();
