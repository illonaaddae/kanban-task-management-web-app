import { useQuery } from '@tanstack/react-query';
import * as boardApi from '../services/boardApi';
import * as collaboratorApi from '../services/collaboratorApi';
import { getActivity, type ActivityPage } from '../services/activityApi';
import { tokenStore } from '../services/api';
import { queryKeys } from './keys';
import type { Board, BoardMember } from '../types';

/**
 * Read hooks for board data.
 *
 * Each owns its own loading and error state, which is the point: the previous
 * single `boardLoading` flag was shared by reads *and* mutations, so adding one
 * column blanked the whole page. A query cannot do that to a sibling.
 */

/** Every board the signed-in user can see, each fully hydrated. */
export function useBoards() {
  return useQuery({
    queryKey: queryKeys.boards.list(),
    queryFn: () => boardApi.getBoards(),
    // Nothing to fetch before sign-in; avoids a guaranteed 401 on the login page.
    enabled: tokenStore.isAuthenticated,
  });
}

/** One board, nested. `undefined` id disables the query rather than guessing. */
export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boards.detail(boardId ?? 'none'),
    queryFn: () => boardApi.getFullBoard(boardId as string),
    enabled: Boolean(boardId) && tokenStore.isAuthenticated,
  });
}

/**
 * Owner + collaborators. Also the source for the assignee select, so it is
 * requested by the task modals as well as the share modal — one cache entry
 * serves both instead of each fetching its own copy.
 */
export function useBoardMembers(boardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boards.members(boardId ?? 'none'),
    queryFn: () => collaboratorApi.getMembers(boardId as string),
    enabled: Boolean(boardId) && tokenStore.isAuthenticated,
  });
}

/** A page of the activity feed. Paging changes the key, so pages cache separately. */
export function useBoardActivity(
  boardId: string | undefined,
  page: number,
  limit: number,
) {
  return useQuery({
    queryKey: queryKeys.boards.activity(boardId ?? 'none', page, limit),
    queryFn: () => getActivity(boardId as string, page, limit),
    enabled: Boolean(boardId) && tokenStore.isAuthenticated,
    // The feed is append-only from the user's perspective; a page they already
    // hold will not change under them.
    staleTime: 15_000,
  });
}

export type { Board, BoardMember, ActivityPage };
