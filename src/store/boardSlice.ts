import type { Board } from "../types";
import { boardService } from "../services/boardService";
import type { StoreSet, StoreGet } from "./store";
import type { BoardState } from "./boardTypes";

type BoardSlice = Pick<
  BoardState,
  | "boards"
  | "currentBoard"
  | "boardLoading"
  | "boardsLoaded"
  | "boardError"
  | "fetchBoards"
  | "setCurrentBoard"
  | "refreshCurrentBoard"
  | "createBoard"
  | "updateBoard"
  | "deleteBoard"
  | "createColumn"
>;

export const createBoardSlice = (set: StoreSet, get: StoreGet): BoardSlice => ({
  boards: [],
  currentBoard: null,
  boardLoading: false,
  boardsLoaded: false,
  boardError: null,

  fetchBoards: async (userId) => {
    set({ boardLoading: true, boardError: null });
    try {
      // `GET /boards/:id/full` already nests tasks under their column, ordered
      // by position. The old code re-derived that by filtering a flat list on
      // `task.status === col.name`, which lost the ordering and misfiled every
      // task when two columns shared a name.
      const boards = await boardService.getBoards(userId);

      // Only reuse currentBoard if it belongs to the fetched set;
      // otherwise default to the first board (prevents stale data
      // leaking across accounts).
      const prev = get().currentBoard;
      const currentBoard =
        (prev && boards.find((b) => b.id === prev.id)) ||
        (boards.length > 0 ? boards[0] : null);
      set({ boards, currentBoard, boardLoading: false, boardsLoaded: true });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
    }
  },

  setCurrentBoard: async (board: Board) => {
    // Show the board we already hold, then refresh it from the server so a
    // board edited in another tab or by a collaborator is not stale.
    set({ currentBoard: board, boardLoading: Boolean(board.id) });
    if (!board.id) return;

    try {
      const fresh = await boardService.getFullBoard(board.id);
      const { boards } = get();
      set({
        currentBoard: fresh,
        boards: boards.map((b) => (b.id === fresh.id ? fresh : b)),
        boardLoading: false,
      });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
    }
  },

  refreshCurrentBoard: async () => {
    const { currentBoard, boards } = get();
    if (!currentBoard?.id) return;

    try {
      const fresh = await boardService.getFullBoard(currentBoard.id);
      set({
        currentBoard: fresh,
        boards: boards.map((b) => (b.id === fresh.id ? fresh : b)),
      });
    } catch (error: any) {
      set({ boardError: error.message });
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

  /**
   * Adds a column without blanking the board.
   *
   * Deliberately does not set `boardLoading`: that flag drives the full-page
   * loader, and replacing the board a user is looking at — to add one column to
   * it — is what made this feel broken. The modal shows its own pending state
   * instead.
   */
  createColumn: async (boardId, name) => {
    set({ boardError: null });
    try {
      const fresh = await boardService.createColumn(boardId, name);
      const { boards } = get();
      set({
        currentBoard: fresh,
        boards: boards.map((b) => (b.id === fresh.id ? fresh : b)),
      });
    } catch (error: any) {
      set({ boardError: error.message });
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
