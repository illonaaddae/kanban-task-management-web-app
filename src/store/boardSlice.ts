import type { Board } from '../types';
import { boardService } from '../services/boardService';
import type { StoreSet, StoreGet } from './store';
import type { BoardState } from './boardTypes';

type BoardSlice = Pick<BoardState,
  'boards' | 'currentBoard' | 'boardLoading' | 'boardError' |
  'fetchBoards' | 'setCurrentBoard' | 'createBoard' | 'updateBoard' | 'deleteBoard'
>;

export const createBoardSlice = (set: StoreSet, get: StoreGet): BoardSlice => ({
  boards: [],
  currentBoard: null,
  boardLoading: false,
  boardError: null,

  fetchBoards: async (userId) => {
    set({ boardLoading: true, boardError: null });
    try {
      const boards = await boardService.getBoards(userId);
      const currentBoard = get().currentBoard || (boards.length > 0 ? boards[0] : null);

      if (currentBoard?.id) {
        const tasks = await boardService.getTasks(currentBoard.id);
        const columnsWithTasks = currentBoard.columns.map(col => ({
          ...col,
          tasks: tasks.filter(task => task.status === col.name)
        }));
        const enrichedBoard = { ...currentBoard, columns: columnsWithTasks };
        const updatedBoards = boards.map(b => b.id === enrichedBoard.id ? enrichedBoard : b);
        set({ boards: updatedBoards, currentBoard: enrichedBoard, boardLoading: false });
      } else {
        set({ boards, currentBoard, boardLoading: false });
      }
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
    }
  },

  setCurrentBoard: async (board: Board) => {
    set({ currentBoard: board, boardLoading: true });
    if (board.id) {
      try {
        const tasks = await boardService.getTasks(board.id);
        const columnsWithTasks = board.columns.map(col => ({
          ...col,
          tasks: tasks.filter(task => task.status === col.name)
        }));
        set({ currentBoard: { ...board, columns: columnsWithTasks }, boardLoading: false });
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
      set({ boards: [...boards, newBoard], currentBoard: newBoard, boardLoading: false });
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
      const updatedBoards = boards.map(b => b.id === boardId ? { ...b, ...updatedBoard } : b);
      set({
        boards: updatedBoards,
        currentBoard: currentBoard?.id === boardId ? { ...currentBoard, ...updatedBoard } : currentBoard,
        boardLoading: false
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
      const updatedBoards = boards.filter(b => b.id !== boardId);
      const newCurrent = currentBoard?.id === boardId ? (updatedBoards[0] || null) : currentBoard;
      set({ boards: updatedBoards, currentBoard: newCurrent, boardLoading: false });
    } catch (error: any) {
      set({ boardError: error.message, boardLoading: false });
      throw error;
    }
  },
});
