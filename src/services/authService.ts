import type { AuthService } from './authTypes';
import { AppwriteAuthService } from './appwriteAuth';
import { MockAuthService } from './mockAuth';

export type { User, AuthService } from './authTypes';

// Export the appropriate service based on environment
const useAppwrite = import.meta.env.VITE_USE_APPWRITE === 'true';

export const authService: AuthService = useAppwrite
  ? new AppwriteAuthService()
  : new MockAuthService();
