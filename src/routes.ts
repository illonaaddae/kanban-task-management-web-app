/**
 * Route paths, in one place.
 *
 * The dashboard moved off `/` when the landing page took it, and it was reachable
 * from eight scattered `to="/"` links plus three `pathname === '/'` comparisons.
 * Naming them means the next move is one edit rather than a grep.
 */
export const PATHS = {
  /** Public marketing page. Signed-in visitors are redirected to the dashboard. */
  landing: '/',
  login: '/login',
  docs: '/docs',
  dashboard: '/boards',
  board: (boardId: string) => `/board/${boardId}`,
  myTasks: '/my-tasks',
  teams: '/teams',
  admin: '/admin',
  invite: (token: string) => `/invite/${token}`,
} as const;
