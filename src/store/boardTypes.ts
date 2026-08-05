import type { Board, BoardMember, CollaboratorRole, Task, Column } from '../types';

export interface BoardState {
  boards: Board[];
  currentBoard: Board | null;
  boardLoading: boolean;
  boardError: string | null;

  /** Owner + collaborators of the current board. Feeds sharing and assignment. */
  members: BoardMember[];
  membersLoading: boolean;

  fetchMembers: (boardId: string) => Promise<void>;
  inviteCollaborator: (boardId: string, email: string, role: CollaboratorRole) => Promise<void>;
  updateCollaboratorRole: (boardId: string, userId: string, role: CollaboratorRole) => Promise<void>;
  removeCollaborator: (boardId: string, userId: string) => Promise<void>;

  fetchBoards: (userId: string) => Promise<void>;
  setCurrentBoard: (board: Board) => void;
  /** Re-reads the current board from the server — used to roll back a failed drag. */
  refreshCurrentBoard: () => Promise<void>;
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
