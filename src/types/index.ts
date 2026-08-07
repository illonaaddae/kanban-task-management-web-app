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
  /** The parent column's name. Kept in sync server-side. */
  status: string;
  subtasks: Subtask[];

  // ── Server-backed fields. All optional so existing components compile
  // untouched and locally-built tasks stay valid before they are persisted.
  /** Authoritative parent column. `status` is a denormalised copy of its name. */
  columnId?: string;
  /** Zero-based order within the column. */
  position?: number;
  /** User id of the assignee, or null when unassigned. */
  assignedTo?: string | null;
  /** ISO 8601 string, or null when no due date is set. */
  dueDate?: string | null;
}

export interface Column {
  id?: string;
  name: string;
  tasks: Task[];
  /** Zero-based order within the board. */
  position?: number;
}

/** What the signed-in user may do on a board. `admin` is the platform role. */
export type BoardRole = 'viewer' | 'editor' | 'owner' | 'admin';

/** A role that can be granted to a collaborator. Owners are not "granted". */
export type CollaboratorRole = 'editor' | 'viewer';

export interface BoardMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** `owner` is derived from the board, not from a collaborator entry. */
  role: BoardRole;
}

export interface Board {
  id?: string;
  name: string;
  columns: Column[];
  /**
   * The team this board belongs to, when it belongs to one. Every member of that
   * team can reach it without a per-board invitation.
   */
  organizationId?: string | null;
  /** The caller's effective role, from the full-board payload. */
  myRole?: BoardRole;
  /** Everyone with access, owner first. Populated by the detail endpoints. */
  members?: BoardMember[];
}

export interface ActivityEntry {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; avatar?: string } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

