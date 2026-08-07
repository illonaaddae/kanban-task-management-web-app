import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as boardApi from '../services/boardApi';
import * as taskApi from '../services/taskApi';
import * as collaboratorApi from '../services/collaboratorApi';
import { queryKeys } from './keys';
import type { Board, CollaboratorRole, Task } from '../types';

/**
 * Mutations for board data.
 *
 * Two rules hold throughout:
 *
 * 1. **Invalidate, do not hand-patch.** Writing the new state into the cache
 *    ourselves is how lists drifted from the server before. The exceptions are
 *    the two drag-and-drop mutations, where waiting for a round trip would make
 *    the card visibly snap back.
 *
 * 2. **Snapshot before an optimistic write.** `onMutate` returns the previous
 *    cache entry and `onError` restores it, so a rejected move is undone exactly
 *    rather than approximately - which is what a locally reconstructed "undo"
 *    could never guarantee.
 */

/** Renumbers a column's tasks so `position` matches array order. */
function withPositions(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({ ...task, position: index }));
}

// ── Boards ─────────────────────────────────────────────────────────────────

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (board: Omit<Board, 'id'>) => boardApi.createBoard('', board),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.boards.all() }),
  });
}

export function useUpdateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, updates }: { boardId: string; updates: Partial<Board> }) =>
      boardApi.updateBoard(boardId, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.boards.all() }),
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boardId: string) => boardApi.deleteBoard(boardId),

    // Optimistic, because the caller closes the modal and navigates away
    // immediately. Waiting for the refetch left the deleted board visible in the
    // dashboard and sidebar for as long as the round trip took - on a
    // spun-down free-tier API, several seconds of a board that is already gone.
    onMutate: async (boardId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.boards.list() });
      const previous = queryClient.getQueryData<Board[]>(queryKeys.boards.list());

      queryClient.setQueryData<Board[]>(
        queryKeys.boards.list(),
        (boards) => boards?.filter((board) => board.id !== boardId) ?? boards,
      );

      return { previous };
    },

    onError: (_error, _boardId, context) => {
      // Put the board back rather than refetching: this is the exact list from
      // before, so the failure leaves no window where it is missing.
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.boards.list(), context.previous);
      }
    },

    onSuccess: (_result, boardId) => {
      // Drop the detail entry outright: the board is gone, so a refetch would
      // only 404.
      queryClient.removeQueries({ queryKey: queryKeys.boards.detail(boardId) });
    },

    // Reconcile either way - the optimistic list is a guess, and a concurrent
    // change by someone else should not be lost behind it.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.list() });
    },
  });
}

export function useCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, name }: { boardId: string; name: string }) =>
      boardApi.createColumn(boardId, name),
    onSuccess: (board) => {
      // The call already returns the refreshed board, so seed it rather than
      // making the UI wait for another round trip.
      queryClient.setQueryData(queryKeys.boards.detail(board.id as string), board);
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.list() });
    },
  });
}

/**
 * Column drag. Optimistic: the columns move under the cursor immediately.
 */
export function useReorderColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, orderedColumnIds }: { boardId: string; orderedColumnIds: string[] }) =>
      boardApi.reorderColumns(boardId, orderedColumnIds),

    onMutate: async ({ boardId, orderedColumnIds }) => {
      const key = queryKeys.boards.detail(boardId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);

      if (previous) {
        const byId = new Map(previous.columns.map((column) => [column.id, column]));
        queryClient.setQueryData<Board>(key, {
          ...previous,
          columns: orderedColumnIds
            .map((id, index) => {
              const column = byId.get(id);
              return column ? { ...column, position: index } : undefined;
            })
            .filter((column): column is NonNullable<typeof column> => Boolean(column)),
        });
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    // Settled, not success: reconcile with the server whether it worked or not.
    onSettled: (_data, _error, { boardId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) }),
  });
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, task }: { boardId: string; task: Omit<Task, 'id'> }) =>
      taskApi.createTask(boardId, '', task),
    onSuccess: (_task, { boardId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.list() });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; boardId: string; updates: Partial<Task> }) =>
      taskApi.updateTask(taskId, updates),

    // Subtask toggling goes through here, and a checkbox that waits for the
    // network feels broken - so this one is optimistic too.
    onMutate: async ({ taskId, boardId, updates }) => {
      const key = queryKeys.boards.detail(boardId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);

      if (previous) {
        queryClient.setQueryData<Board>(key, {
          ...previous,
          columns: previous.columns.map((column) => ({
            ...column,
            tasks: column.tasks.map((task) =>
              task.id === taskId ? { ...task, ...updates } : task,
            ),
          })),
        });
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_data, _error, { boardId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; boardId: string }) => taskApi.deleteTask(taskId),

    // Optimistic for the same reason as deleting a board: the modal closes at
    // once, so anything slower than the network leaves the deleted card sitting
    // on the board.
    onMutate: async ({ taskId, boardId }) => {
      const key = queryKeys.boards.detail(boardId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);

      if (previous) {
        queryClient.setQueryData<Board>(key, {
          ...previous,
          columns: previous.columns.map((column) => {
            const tasks = column.tasks.filter((task) => task.id !== taskId);
            // Renumber, because the server re-compacts the source column and a
            // stale gap would show up as soon as anything else read `position`.
            return tasks.length === column.tasks.length
              ? column
              : { ...column, tasks: tasks.map((task, index) => ({ ...task, position: index })) };
          }),
        });
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_data, _error, { boardId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.list() });
    },
  });
}

/**
 * Task drag. The one that has to feel instant.
 *
 * Positions are renumbered in both affected columns so the optimistic state
 * matches what the server will produce - it rebalances both sides in one
 * bulkWrite - rather than leaving a gap the next render would expose.
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, columnId, position }: {
      taskId: string;
      columnId: string;
      position: number;
      boardId: string;
    }) => taskApi.moveTask(taskId, columnId, position),

    onMutate: async ({ taskId, columnId, position, boardId }) => {
      const key = queryKeys.boards.detail(boardId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Board>(key);

      if (previous) {
        const target = previous.columns.find((column) => column.id === columnId);
        let moving: Task | undefined;

        const withoutTask = previous.columns.map((column) => {
          const found = column.tasks.find((task) => task.id === taskId);
          if (!found) return column;
          moving = found;
          return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) };
        });

        if (moving && target) {
          const moved: Task = {
            ...moving,
            columnId,
            // The API rewrites status to the target column's name; mirror that
            // so the card does not flicker the old value.
            status: target.name,
          };

          queryClient.setQueryData<Board>(key, {
            ...previous,
            columns: withoutTask.map((column) => {
              if (column.id !== columnId) return { ...column, tasks: withPositions(column.tasks) };
              const tasks = [...column.tasks];
              tasks.splice(position, 0, moved);
              return { ...column, tasks: withPositions(tasks) };
            }),
          });
        }
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    onSettled: (_data, _error, { boardId }) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) }),
  });
}

// ── Collaborators ──────────────────────────────────────────────────────────

export function useInviteCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, email, role }: { boardId: string; email: string; role: CollaboratorRole }) =>
      collaboratorApi.inviteCollaborator(boardId, email, role),
    onSuccess: (members, { boardId }) =>
      queryClient.setQueryData(queryKeys.boards.members(boardId), members),
  });
}

export function useUpdateCollaboratorRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, userId, role }: { boardId: string; userId: string; role: CollaboratorRole }) =>
      collaboratorApi.updateCollaboratorRole(boardId, userId, role),
    onSuccess: (members, { boardId }) =>
      queryClient.setQueryData(queryKeys.boards.members(boardId), members),
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boardId, userId }: { boardId: string; userId: string }) =>
      collaboratorApi.removeCollaborator(boardId, userId),
    onSuccess: (members, { boardId }) => {
      queryClient.setQueryData(queryKeys.boards.members(boardId), members);
      // Removal clears their assignments server-side, so the board is stale.
      void queryClient.invalidateQueries({ queryKey: queryKeys.boards.detail(boardId) });
    },
  });
}
