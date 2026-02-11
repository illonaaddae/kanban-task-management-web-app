import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import boardsData from '../../data.json';
import type { Board, Task, Theme } from '../types';

interface KanbanState {
  boards: Board[];
  activeBoard: number | null;
  theme: Theme;
  isSidebarOpen: boolean;

  // Board & task actions
  setActiveBoard: (index: number) => void;
  addBoard: (board: Board) => void;
  updateBoard: (index: number, board: Board) => void;
  deleteBoard: (index: number) => void;

  addTask: (boardIndex: number, columnIndex: number, task: Task) => void;
  updateTask: (boardIndex: number, columnIndex: number, taskIndex: number, task: Task) => void;
  deleteTask: (boardIndex: number, columnIndex: number, taskIndex: number) => void;
  toggleSubtask: (boardIndex: number, columnIndex: number, taskIndex: number, subtaskIndex: number) => void;
  moveTask: (boardIndex: number, fromColumn: number, toColumn: number, taskIndex: number) => void;

  // Drag & drop helpers
  reorderTasksInColumn: (boardIndex: number, columnIndex: number, startIndex: number, endIndex: number) => void;
  moveTaskBetweenColumns: (
    boardIndex: number,
    sourceColIndex: number,
    destColIndex: number,
    taskIndex: number,
    newIndex: number
  ) => void;
  reorderColumns: (boardIndex: number, startIndex: number, endIndex: number) => void;

  // UI preferences
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set) => ({
      boards: boardsData.boards,
      activeBoard: 0,
      theme: 'light',
      isSidebarOpen: true,

      setActiveBoard: (index) => set({ activeBoard: index }),

      addBoard: (board) =>
        set((state) => ({
          boards: [...state.boards, board],
        })),

      updateBoard: (index, board) =>
        set((state) => ({
          boards: state.boards.map((b, i) => (i === index ? board : b)),
        })),

      deleteBoard: (index) =>
        set((state) => {
          const updatedBoards = state.boards.filter((_, i) => i !== index);

          let newActive: number | null = state.activeBoard;
          if (state.activeBoard === index) {
            newActive = updatedBoards.length > 0 ? 0 : null;
          } else if (state.activeBoard !== null && state.activeBoard > index) {
            newActive = state.activeBoard - 1;
          }

          return {
            boards: updatedBoards,
            activeBoard: newActive,
          };
        }),

      addTask: (boardIndex, columnIndex, task) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;
            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci !== columnIndex) return col;
                return { ...col, tasks: [...col.tasks, task] };
              }),
            };
          }),
        })),

      updateTask: (boardIndex, columnIndex, taskIndex, task) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;
            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci !== columnIndex) return col;
                return {
                  ...col,
                  tasks: col.tasks.map((t, ti) => (ti === taskIndex ? task : t)),
                };
              }),
            };
          }),
        })),

      deleteTask: (boardIndex, columnIndex, taskIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;
            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci !== columnIndex) return col;
                return {
                  ...col,
                  tasks: col.tasks.filter((_, ti) => ti !== taskIndex),
                };
              }),
            };
          }),
        })),

      toggleSubtask: (boardIndex, columnIndex, taskIndex, subtaskIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;
            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci !== columnIndex) return col;
                return {
                  ...col,
                  tasks: col.tasks.map((task, ti) => {
                    if (ti !== taskIndex) return task;
                    return {
                      ...task,
                      subtasks: task.subtasks.map((st, si) =>
                        si === subtaskIndex ? { ...st, isCompleted: !st.isCompleted } : st
                      ),
                    };
                  }),
                };
              }),
            };
          }),
        })),

      moveTask: (boardIndex, fromColumn, toColumn, taskIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;

            const task = board.columns[fromColumn].tasks[taskIndex];
            const newTask: Task = { ...task, status: board.columns[toColumn].name };

            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci === fromColumn) {
                  return { ...col, tasks: col.tasks.filter((_, ti) => ti !== taskIndex) };
                }
                if (ci === toColumn) {
                  return { ...col, tasks: [...col.tasks, newTask] };
                }
                return col;
              }),
            };
          }),
        })),

      reorderTasksInColumn: (boardIndex, columnIndex, startIndex, endIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;

            return {
              ...board,
              columns: board.columns.map((col, ci) => {
                if (ci !== columnIndex) return col;

                const tasks = [...col.tasks];
                const [removed] = tasks.splice(startIndex, 1);
                tasks.splice(endIndex, 0, removed);

                return { ...col, tasks };
              }),
            };
          }),
        })),

      moveTaskBetweenColumns: (boardIndex, sourceColIndex, destColIndex, taskIndex, newIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;

            const task = board.columns[sourceColIndex].tasks[taskIndex];
            const newTask: Task = { ...task, status: board.columns[destColIndex].name };

            const newColumns = board.columns.map((col, ci) => {
              if (ci === sourceColIndex) {
                return { ...col, tasks: col.tasks.filter((_, ti) => ti !== taskIndex) };
              }
              return col;
            });

            const destColumn = newColumns[destColIndex];
            newColumns[destColIndex] = {
              ...destColumn,
              tasks: [
                ...destColumn.tasks.slice(0, newIndex),
                newTask,
                ...destColumn.tasks.slice(newIndex),
              ],
            };

            return { ...board, columns: newColumns };
          }),
        })),

      reorderColumns: (boardIndex, startIndex, endIndex) =>
        set((state) => ({
          boards: state.boards.map((board, bi) => {
            if (bi !== boardIndex) return board;

            const columns = [...board.columns];
            const [removed] = columns.splice(startIndex, 1);
            columns.splice(endIndex, 0, removed);

            return { ...board, columns };
          }),
        })),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
    }),
    {
      name: 'kanban-store',
      partialize: (state) => ({
        boards: state.boards,
        activeBoard: state.activeBoard,
        theme: state.theme,
      }),
    }
  )
);

