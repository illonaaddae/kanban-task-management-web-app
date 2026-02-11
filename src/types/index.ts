// Type definitions for Kanban Task Manager

export interface Subtask {
  id?: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  status: string;
  subtasks: Subtask[];
}

export interface Column {
  id?: string;
  name: string;
  tasks: Task[];
}

export interface Board {
  id?: string;
  name: string;
  columns: Column[];
}

export interface BoardData {
  boards: Board[];
}

// Authentication Context Types
export interface AuthContextType {
  isLoggedIn: boolean;
  user: string | null;
  login: (username: string) => void;
  logout: () => void;
}

// Theme Context Types
export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Board Context Types
export interface BoardContextType {
  boards: Board[];
  activeBoard: number | null;
  setActiveBoard: (index: number) => void;
  addBoard: (board: Board) => void;
  updateBoard: (index: number, board: Board) => void;
  deleteBoard: (index: number) => void;
  addTask: (boardIndex: number, columnIndex: number, task: Task) => void;
  updateTask: (boardIndex: number, columnIndex: number, taskIndex: number, task: Task) => void;
  deleteTask: (boardIndex: number, columnIndex: number, taskIndex: number) => void;
  toggleSubtask: (boardIndex: number, columnIndex: number, taskIndex: number, subtaskIndex: number) => void;
  moveTask: (boardIndex: number, fromColumn: number, toColumn: number, taskIndex: number) => void;
  // Drag and drop functions
  reorderTasksInColumn: (boardIndex: number, columnIndex: number, startIndex: number, endIndex: number) => void;
  moveTaskBetweenColumns: (boardIndex: number, sourceColIndex: number, destColIndex: number, taskIndex: number, newIndex: number) => void;
  reorderColumns: (boardIndex: number, startIndex: number, endIndex: number) => void;
}
