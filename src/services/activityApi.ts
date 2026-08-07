import { api } from "./api";
import { toActivityEntry, type ApiActivityEntry } from "./apiShapes";
import type { ActivityEntry, Pagination } from "../types";

export interface ActivityPage {
  entries: ActivityEntry[];
  pagination: Pagination;
}

/**
 * A page of the board's activity feed, newest first.
 *
 * Readable by anyone who can see the board, viewers included - it is the one
 * board feature a viewer gets in full.
 */
export async function getActivity(
  boardId: string,
  page = 1,
  limit = 20,
): Promise<ActivityPage> {
  const data = await api.get<{
    activity: ApiActivityEntry[];
    pagination: Pagination;
  }>(`/boards/${boardId}/activity?page=${page}&limit=${limit}`);

  return {
    entries: (data.activity ?? []).map(toActivityEntry),
    pagination: data.pagination,
  };
}
