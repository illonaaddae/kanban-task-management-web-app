import type { AuthService } from './authTypes';
import { ApiAuthService } from './apiAuth';
import { AppwriteAuthService } from './appwriteAuth';
import { MockAuthService } from './mockAuth';

export type { User, AuthService } from './authTypes';

export type AuthProvider = 'api' | 'appwrite' | 'mock';

/**
 * Picks the auth implementation.
 *
 * `VITE_AUTH_PROVIDER` wins; the legacy `VITE_USE_APPWRITE=true` flag is still
 * honoured when it is unset, so an existing `.env` keeps working. Anything
 * unrecognised falls back to the API rather than silently running mock auth
 * against a real deployment.
 */
function resolveProvider(): AuthProvider {
  const configured = import.meta.env.VITE_AUTH_PROVIDER as string | undefined;

  switch (configured?.trim().toLowerCase()) {
    case 'api':
      return 'api';
    case 'appwrite':
      return 'appwrite';
    case 'mock':
      return 'mock';
    default:
      return import.meta.env.VITE_USE_APPWRITE === 'true' ? 'appwrite' : 'api';
  }
}

export const authProvider: AuthProvider = resolveProvider();

function createAuthService(provider: AuthProvider): AuthService {
  switch (provider) {
    case 'appwrite':
      return new AppwriteAuthService();
    case 'mock':
      return new MockAuthService();
    case 'api':
    default:
      return new ApiAuthService();
  }
}

export const authService: AuthService = createAuthService(authProvider);
