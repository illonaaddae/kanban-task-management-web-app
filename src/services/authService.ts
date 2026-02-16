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

// Export the appropriate service based on environment
import { AppwriteAuthService } from './appwriteAuth';
import { MockAuthService } from './mockAuth';

const useAppwrite = import.meta.env.VITE_USE_APPWRITE === 'true';

export const authService: AuthService = useAppwrite
  ? new AppwriteAuthService()
  : new MockAuthService();
