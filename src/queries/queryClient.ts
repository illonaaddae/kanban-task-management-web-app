import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/api';

/**
 * The shared cache.
 *
 * Defaults are chosen for a small, frequently-mutated dataset served by a
 * free-tier host that can take a while to wake up.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Board data changes because *this* user changed it, and every mutation
      // invalidates explicitly. A short window still avoids a burst of
      // duplicate requests when several components mount at once.
      staleTime: 30_000,
      gcTime: 5 * 60_000,

      // Refetching on window focus would fire a request every time the user
      // alt-tabs, which on a spun-down host means a 30-second wait for data
      // that has not changed.
      refetchOnWindowFocus: false,

      retry: (failureCount, error) => {
        // Never retry something the server answered deliberately: a 401, 403,
        // 404 or validation error will fail identically every time, and
        // retrying a 401 races the token refresh.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // A mutation is a user action; replaying it silently could duplicate a
      // task. Failures surface to the caller instead.
      retry: false,
    },
  },
});
