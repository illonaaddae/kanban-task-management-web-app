/**
 * Query keys, in one place.
 *
 * Every key is a function so call sites cannot drift into slightly different
 * array shapes - the commonest way a cache invalidation silently misses.
 * Hierarchical on purpose: invalidating `boards.all()` also invalidates every
 * `boards.detail(id)`, because React Query matches keys by prefix.
 */
export const queryKeys = {
  boards: {
    all: () => ['boards'] as const,
    list: () => ['boards', 'list'] as const,
    detail: (boardId: string) => ['boards', 'detail', boardId] as const,
    members: (boardId: string) => ['boards', 'members', boardId] as const,
    activity: (boardId: string, page: number, limit: number) =>
      ['boards', 'activity', boardId, page, limit] as const,
    progress: (boardId: string) => ['boards', 'progress', boardId] as const,
  },
  tasks: {
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
    /** Assigned to the signed-in user, across every board they can reach. */
    mine: () => ['tasks', 'mine'] as const,
  },
  orgs: {
    all: () => ['orgs'] as const,
    list: () => ['orgs', 'list'] as const,
    detail: (orgId: string) => ['orgs', 'detail', orgId] as const,
    invitations: (orgId: string) => ['orgs', 'invitations', orgId] as const,
    /** Spans every team the caller is in, so it is not keyed by one org. */
    teammates: () => ['orgs', 'teammates'] as const,
    analytics: (orgId: string) => ['orgs', 'analytics', orgId] as const,
  },
  invitations: {
    /** Waiting for the signed-in user's own address. */
    mine: () => ['invitations', 'mine'] as const,
    /** Public preview, keyed by the token from the link. */
    preview: (token: string) => ['invitations', 'preview', token] as const,
  },
} as const;
