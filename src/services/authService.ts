import type { AuthService, User } from './authTypes';
import { ApiAuthService } from './apiAuth';

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

/**
 * `api` is constructed eagerly; the other two are imported on first use.
 *
 * The Appwrite SDK was 107 kB minified (33 kB gzipped) of the initial bundle, sent
 * to every visitor of a deployment configured with `VITE_AUTH_PROVIDER=api` that
 * never touched it. A static import cannot be tree-shaken away, because the
 * provider is only known at runtime.
 *
 * Every AuthService method already returns a Promise, so awaiting the module costs
 * callers nothing and none of them had to change.
 */
let pending: Promise<AuthService> | null = null;

function load(): Promise<AuthService> {
  // Memoised on the promise, not the result, so two calls that race still share
  // one import and one instance.
  pending ??= (async () => {
    switch (authProvider) {
      case 'appwrite': {
        const { AppwriteAuthService } = await import('./appwriteAuth');
        return new AppwriteAuthService();
      }
      case 'mock': {
        const { MockAuthService } = await import('./mockAuth');
        return new MockAuthService();
      }
      default:
        return new ApiAuthService();
    }
  })();

  return pending;
}

/**
 * The same synchronous-looking object as before, forwarding to whichever
 * implementation the build is configured for.
 */
export const authService: AuthService = {
  login: async (email: string, password: string): Promise<User> =>
    (await load()).login(email, password),

  loginWithSlack: async (): Promise<void> => (await load()).loginWithSlack(),

  loginWithGoogle: async (): Promise<void> => (await load()).loginWithGoogle(),

  register: async (email: string, password: string, name: string): Promise<User> =>
    (await load()).register(email, password, name),

  logout: async (): Promise<void> => (await load()).logout(),

  getCurrentUser: async (): Promise<User | null> => (await load()).getCurrentUser(),

  handleOAuthCallback: async (
    userId?: string,
    secret?: string,
  ): Promise<User | null> => (await load()).handleOAuthCallback(userId, secret),

  updateProfile: async (name: string, avatarFile?: File): Promise<User> =>
    (await load()).updateProfile(name, avatarFile),
};
