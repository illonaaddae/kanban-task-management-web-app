import type { Task } from '../types';
import { boardService } from '../services/boardService';
import type { StoreSet, StoreGet } from './store';
import type { BoardState } from './boardTypes';

type TaskSlice = Pick<BoardState,
  'createTask' | 'updateTask' | 'deleteTask' | 'moveTask' |
  'reorderColumns' | 'reorderTasksInColumn'
>;

export const createTaskSlice = (set: StoreSet, get: StoreGet): TaskSlice => ({
  createTask: async (boardId, userId, task) => {
    try {
      const newTask = await boardService.createTask(boardId, userId, task);
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col =>
          col.name === task.status ? { ...col, tasks: [...col.tasks, newTask] } : col
        );
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
      }
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  updateTask: async (taskId, updates, boardId) => {
    try {
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col => ({
          ...col,
          tasks: col.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
        }));
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
      }
      await boardService.updateTask(taskId, updates);
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  deleteTask: async (taskId, boardId) => {
    try {
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        const updatedColumns = currentBoard.columns.map(col => ({
          ...col,
          tasks: col.tasks.filter(t => t.id !== taskId)
        }));
        set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
      }
      await boardService.deleteTask(taskId);
    } catch (error: any) {
      set({ boardError: error.message });
      throw error;
    }
  },

  moveTask: async (taskId, newStatus, newIndex) => {
    try {
      const { currentBoard } = get();
      if (!currentBoard) return;

      let task: Task | undefined;
      const columnsAfterRemove = currentBoard.columns.map(col => {
        const t = col.tasks.find(t => t.id === taskId);
        if (t) {
          task = t;
          return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
        }
        return col;
      });

      if (task) {
        const updatedTask = { ...task, status: newStatus };
        const columnsAfterAdd = columnsAfterRemove.map(col => {
          if (col.name === newStatus) {
            const newTasks = [...col.tasks];
            newTasks.splice(newIndex, 0, updatedTask);
            return { ...col, tasks: newTasks };
          }
          return col;
        });
        set({ currentBoard: { ...currentBoard, columns: columnsAfterAdd } });
        await boardService.updateTask(taskId, { status: newStatus });
      }
    } catch (error: any) {
      set({ boardError: error.message });
    }
  },

  reorderColumns: async (boardId, newColumns) => {
    try {
      const { currentBoard } = get();
      if (currentBoard?.id === boardId) {
        set({ currentBoard: { ...currentBoard, columns: newColumns } });
        await boardService.updateBoard(boardId, { columns: newColumns });
      }
    } catch (error: any) {
      set({ boardError: error.message });
    }
  },

  reorderTasksInColumn: (boardId, columnId, newTasks) => {
    const { currentBoard } = get();
    if (currentBoard?.id === boardId) {
      const updatedColumns = currentBoard.columns.map(col =>
        col.name === columnId ? { ...col, tasks: newTasks } : col
      );
      set({ currentBoard: { ...currentBoard, columns: updatedColumns } });
    }
  },
});
