import type { Board } from "../types";
import { boardService } from "../services/boardService";
import type { StoreSet, StoreGet } from "./store";
import type { BoardState } from "./boardTypes";

type BoardSlice = Pick<
  BoardState,
  | "boards"
  | "currentBoard"
  | "boardLoading"
  | "boardError"
  | "fetchBoards"
  | "setCurrentBoard"
  | "createBoard"
  | "updateBoard"
  | "deleteBoard"
>;

export const createBoardSlice = (set: StoreSet, get: StoreGet): BoardSlice => ({
  boards: [],
  currentBoard: null,
  boardLoading: false,
  boardError: null,

  fetchBoards: async (userId) => {
    set({ boardLoading: true, boardError: null });
    try {
      const rawBoards = await boardService.getBoards(userId);
      const boardsWithTasks = await Promise.all(
        rawBoards.map(async (board) => {
          if (!board.id) return board;
          const tasks = await boardService.getTasks(board.id);
          const columnsWithTasks = board.columns.map((col) => ({
            ...col,
            tasks: tasks.filter((task) => task.status === col.name),
          }));
          return { ...board, columns: columnsWithTasks };
        }),
      );

      // Only reuse currentBoard if it belongs to the fetched set;
      // otherwise default to the first board (prevents stale data
      // leaking across accounts).
      const prev = get().currentBoard;
      const currentBoard =
        (prev && boardsWithTasks.find((b) => b.id === prev.id)) ||
        (boardsWithTasks.length > 0 ? boardsWithTasks[0] : null);
      set({ boards: boardsWithTasks, currentBoard, boardLoading: false });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
    }
  },

  setCurrentBoard: async (board: Board) => {
    set({ currentBoard: board, boardLoading: true });
    if (board.id) {
      try {
        const tasks = await boardService.getTasks(board.id);
        const columnsWithTasks = board.columns.map((col) => ({
          ...col,
          tasks: tasks.filter((task) => task.status === col.name),
        }));
        set({
          currentBoard: { ...board, columns: columnsWithTasks },
          boardLoading: false,
        });
      } catch (error: any) {
        set({ boardError: error.message, boardLoading: false });
      }
    }
  },

  createBoard: async (userId, board) => {
    set({ boardLoading: true, boardError: null });
    try {
      const newBoard = await boardService.createBoard(userId, board);
      const { boards } = get();
      set({
        boards: [...boards, newBoard],
        currentBoard: newBoard,
        boardLoading: false,
      });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
      throw error;
    }
  },

  updateBoard: async (boardId, updates) => {
    set({ boardLoading: true, boardError: null });
    try {
      const updatedBoard = await boardService.updateBoard(boardId, updates);
      const { boards, currentBoard } = get();
      const updatedBoards = boards.map((b) =>
        b.id === boardId ? { ...b, ...updatedBoard } : b,
      );
      set({
        boards: updatedBoards,
        currentBoard:
          currentBoard?.id === boardId
            ? { ...currentBoard, ...updatedBoard }
            : currentBoard,
        boardLoading: false,
      });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
      throw error;
    }
  },

  deleteBoard: async (boardId) => {
    set({ boardLoading: true, boardError: null });
    try {
      await boardService.deleteBoard(boardId);
      const { boards, currentBoard } = get();
      const updatedBoards = boards.filter((b) => b.id !== boardId);
      const newCurrent =
        currentBoard?.id === boardId ? updatedBoards[0] || null : currentBoard;
      set({
        boards: updatedBoards,
        currentBoard: newCurrent,
        boardLoading: false,
      });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
      throw error;
    }
  },
});
