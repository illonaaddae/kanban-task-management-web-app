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

/**
 * jsdom has no `matchMedia`, so any component reading a breakpoint (the sidebar
 * drawer, the header's hamburger) throws on render without this. Reports "does
 * not match", i.e. the desktop layout, which is what the existing tests assume.
 *
 * There was already a mock in src/test/setup.ts - but vitest.config.ts loads
 * *this* file, so it never ran.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
