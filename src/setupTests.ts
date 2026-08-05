import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * Force mock auth for the whole suite.
 *
 * Setup files run before the test module graph is imported, so the
 * `authService` factory sees this when it evaluates. Without it the default
 * provider is `api` and every component test would try to reach a real server.
 */
vi.stubEnv('VITE_AUTH_PROVIDER', 'mock');
