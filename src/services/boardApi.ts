import { api } from "./api";
import {
  toBoard,
  type ApiBoardSummary,
  type ApiColumnDocument,
  type ApiFullBoard,
} from "./apiShapes";
import type { Board, Column } from "../types";

/**
 * Board data access against the Express API.
 *
 * Exported signatures are unchanged from the Appwrite version so the store
 * barely moves. There is deliberately **no localStorage fallback**: a failed
 * request now throws, the store records it in `boardError`, and the UI says so.
 * Silently serving stale local data made a broken backend look like a working
 * app, and let a user "edit" a board whose writes were going nowhere.
 */

/** The nested board the UI renders — one request per board. */
export async function getFullBoard(boardId: string): Promise<Board> {
  const full = await api.get<ApiFullBoard>(`/boards/${boardId}/full`);
  return toBoard(full);
}

/**
 * Every board the user can see, each fully hydrated.
 *
 * `GET /boards` returns summaries without columns, so the nested shape is
 * fetched per board — concurrently, not in series. `userId` is ignored: the
 * server derives ownership from the token, which is also why a client can no
 * longer ask for somebody else's boards.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBoards(_userId?: string): Promise<Board[]> {
  const { boards } = await api.get<{ boards: ApiBoardSummary[]; count: number }>(
    "/boards",
  );

  return Promise.all(boards.map((board) => getFullBoard(board.id)));
}

/**
 * Creates the board, then its columns in order.
 *
 * The API models columns as their own collection, so a board with columns is
 * two round trips. Columns are created in sequence, not with `Promise.all`,
 * because each one's position is `maxPosition + 1` — issuing them concurrently
 * would race on that read and produce duplicate positions.
 */
export async function createBoard(
  _userId: string,
  board: Omit<Board, "id">,
): Promise<Board> {
  const { board: created } = await api.post<{ board: ApiBoardSummary }>("/boards", {
    name: board.name,
  });

  for (const column of board.columns ?? []) {
    await api.post(`/boards/${created.id}/columns`, { name: column.name });
  }

  return getFullBoard(created.id);
}

/** Rewrites column order in one request. Must list exactly the board's columns. */
export async function reorderColumns(
  boardId: string,
  orderedColumnIds: string[],
): Promise<Board> {
  await api.patch(`/boards/${boardId}/columns/reorder`, { orderedColumnIds });
  return getFullBoard(boardId);
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Updates a board by diffing it against the server's current state.
 *
 * The old implementation stored columns as a JSON blob, so any change was one
 * write. Columns are now their own documents with their own ids and positions,
 * and tasks reference them — so replacing the set wholesale would delete and
 * recreate every column, orphaning every task on the board. Instead each column
 * is matched by id and only the actual difference is sent:
 *
 *   • present in both, name changed  → PUT /columns/:id   (also syncs task.status)
 *   • present on the server only     → DELETE /columns/:id
 *   • no id                          → POST /boards/:id/columns
 *   • order changed                  → PATCH /boards/:id/columns/reorder
 */
export async function updateBoard(
  boardId: string,
  updates: Partial<Board>,
): Promise<Board> {
  if (updates.name !== undefined) {
    await api.put(`/boards/${boardId}`, { name: updates.name });
  }

  if (!updates.columns) return getFullBoard(boardId);

  const current = await getFullBoard(boardId);
  const existing = new Map<string, Column>(
    current.columns.filter((c) => c.id).map((c) => [c.id as string, c]),
  );

  const next = updates.columns;
  const keptIds = new Set(next.map((c) => c.id).filter(Boolean) as string[]);

  // Deletes first: a column removed in the same edit that adds another should
  // not briefly push the new one to a position that is about to close up.
  for (const [id] of existing) {
    if (!keptIds.has(id)) await api.delete(`/columns/${id}`);
  }

  // Renames, and creates for columns the client invented locally.
  const orderedIds: string[] = [];
  for (const column of next) {
    const previous = column.id ? existing.get(column.id) : undefined;

    if (previous) {
      if (previous.name !== column.name) {
        await api.put(`/columns/${column.id}`, { name: column.name });
      }
      orderedIds.push(column.id as string);
      continue;
    }

    const { column: created } = await api.post<{ column: ApiColumnDocument }>(
      `/boards/${boardId}/columns`,
      { name: column.name },
    );
    orderedIds.push(created.id);
  }

  // Only when the order actually moved — the endpoint rejects a partial list,
  // and a no-op reorder is a pointless write.
  const serverOrder = current.columns
    .filter((c) => c.id && keptIds.has(c.id))
    .map((c) => c.id as string);

  if (orderedIds.length > 0 && !sameOrder(orderedIds, serverOrder)) {
    await api.patch(`/boards/${boardId}/columns/reorder`, {
      orderedColumnIds: orderedIds,
    });
  }

  return getFullBoard(boardId);
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}
