/**
 * Query keys, in one place.
 *
 * Every key is a function so call sites cannot drift into slightly different
 * array shapes — the commonest way a cache invalidation silently misses.
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
  },
  tasks: {
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  },
} as const;
