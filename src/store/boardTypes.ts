import type { Board, Task, Column } from '../types';
import { boardService } from '../services/boardService';
import type { StoreSet, StoreGet } from './store';

export interface BoardState {
  boards: Board[];
  currentBoard: Board | null;
  boardLoading: boolean;
  boardError: string | null;

  fetchBoards: (userId: string) => Promise<void>;
  setCurrentBoard: (board: Board) => void;
  createBoard: (userId: string, board: Omit<Board, 'id'>) => Promise<void>;
  updateBoard: (boardId: string, updates: Partial<Board>) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  createTask: (boardId: string, userId: string, task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>, boardId: string) => Promise<void>;
  deleteTask: (taskId: string, boardId: string) => Promise<void>;
  moveTask: (taskId: string, newStatus: string, newIndex: number) => Promise<void>;
  reorderColumns: (boardId: string, newColumns: Column[]) => Promise<void>;
  reorderTasksInColumn: (boardId: string, columnId: string, newTasks: Task[]) => void;
}
