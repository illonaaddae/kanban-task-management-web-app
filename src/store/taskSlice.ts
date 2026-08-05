import type { Board, Task } from '../types';
import { boardService } from '../services/boardService';
import type { StoreSet, StoreGet } from './store';
import type { BoardState } from './boardTypes';

type TaskSlice = Pick<BoardState,
  'createTask' | 'updateTask' | 'deleteTask' | 'moveTask' |
  'reorderColumns' | 'reorderTasksInColumn'
>;

/** Renumbers a column's tasks so `position` matches the array order. */
function withPositions(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({ ...task, position: index }));
}

export const createTaskSlice = (set: StoreSet, get: StoreGet): TaskSlice => ({
  createTask: async (boardId, userId, task) => {
    try {
      const newTask = await boardService.createTask(boardId, userId, task);
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col =>
          // Match on id when the task carries one — two columns can share a name.
          (newTask.columnId && col.id === newTask.columnId) ||
          (!newTask.columnId && col.name === task.status)
            ? { ...col, tasks: [...col.tasks, newTask] }
            : col
        );
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
      }
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  updateTask: async (taskId, updates, boardId) => {
    const { currentBoard } = get();
    const previousBoard = currentBoard; // snapshot for rollback
    try {
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col => ({
          ...col,
          tasks: col.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
        }));
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } }); // optimistic
      }
      await boardService.updateTask(taskId, updates);
    } catch (error: any) {
      set({ currentBoard: previousBoard, boardError: error.message }); // rollback
      throw error;
    }
  },

  deleteTask: async (taskId, boardId) => {
    const previousBoard = get().currentBoard; // snapshot for rollback
    try {
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col => ({
          ...col,
          // Renumber so the remaining tasks stay contiguous, matching the
          // server's own re-compaction.
          tasks: withPositions(col.tasks.filter(t => t.id !== taskId)),
        }));
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
      }
      await boardService.deleteTask(taskId);
    } catch (error: any) {
      set({ currentBoard: previousBoard, boardError: error.message });
      throw error;
    }
  },

  /**
   * Moves a task to `newIndex` in the column named `newStatus`, optimistically
   * first and then for real.
   *
   * Same-column reordering goes through here too: the API treats it as a move
   * into the task's current column, so there is one code path and one set of
   * position semantics rather than two that can disagree.
   *
   * Throws on failure so the caller (the drag handler) can toast and refetch —
   * the local state is left optimistic on purpose, because refetching is what
   * makes it truthful again.
   */
  moveTask: async (taskId, newStatus, newIndex) => {
    const { currentBoard } = get();
    if (!currentBoard) return;

    let task: Task | undefined;
    const columnsAfterRemove = currentBoard.columns.map(col => {
      const found = col.tasks.find(t => t.id === taskId);
      if (found) {
        task = found;
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
      }
      return col;
    });

    if (!task) return;

    const target = currentBoard.columns.find(col => col.name === newStatus);
    if (!target?.id) {
      const message = `Cannot move "${task.title}" — the target column is missing an id. Refresh the board.`;
      set({ boardError: message });
      throw new Error(message);
    }

    const moved: Task = { ...task, status: newStatus, columnId: target.id };
    const columnsAfterAdd = columnsAfterRemove.map(col => {
      if (col.id !== target.id) {
        return { ...col, tasks: withPositions(col.tasks) };
      }
      const newTasks = [...col.tasks];
      newTasks.splice(newIndex, 0, moved);
      return { ...col, tasks: withPositions(newTasks) };
    });

    set({ currentBoard: { ...currentBoard, columns: columnsAfterAdd } }); // optimistic

    try {
      await boardService.moveTask(taskId, target.id, newIndex);
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  /**
   * Persists a column drag.
   *
   * `newColumns` is the board's own columns in their new order, so the reorder
   * endpoint's "must list exactly this board's columns" rule is satisfied by
   * construction. Throws so the drag handler can roll back by refetching.
   */
  reorderColumns: async (boardId, newColumns) => {
    const { currentBoard } = get();
    if (currentBoard?.id !== boardId) return;

    const orderedColumnIds = newColumns.map(col => col.id).filter(Boolean) as string[];
    if (orderedColumnIds.length !== newColumns.length) {
      const message = 'Cannot reorder columns — some columns are missing an id. Refresh the board.';
      set({ boardError: message });
      throw new Error(message);
    }

    const optimistic: Board = {
      ...currentBoard,
      columns: newColumns.map((col, index) => ({ ...col, position: index })),
    };
    set({ currentBoard: optimistic }); // optimistic

    try {
      await boardService.reorderColumns(boardId, orderedColumnIds);
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  /**
   * Local-only reordering inside one column.
   *
   * Kept for callers that just want to reshuffle the array; the drag handler
   * uses `moveTask` instead, which persists. `columnKey` matches on id first so
   * duplicate column names cannot cross-write.
   */
  reorderTasksInColumn: (boardId, columnKey, newTasks) => {
    const { currentBoard } = get();
    if (currentBoard?.id === boardId) {
      const updatedColumns = currentBoard.columns.map(col =>
        col.id === columnKey || col.name === columnKey
          ? { ...col, tasks: withPositions(newTasks) }
          : col
      );
      set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
    }
  },
});
