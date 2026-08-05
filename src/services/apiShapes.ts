import type { ActivityEntry, Board, BoardMember, Column, Task } from "../types";

/**
 * The API's wire shapes and the mapping to the frontend's types.
 *
 * Kept in one file so `boardApi` and `taskApi` cannot drift into two different
 * readings of the same response.
 */

export interface ApiSubtask {
  title: string;
  isCompleted: boolean;
}

/** A task inside `GET /boards/:id/full`. */
export interface ApiTask {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  assignedTo: string | null;
  dueDate: string | null;
  subtasks: ApiSubtask[];
}

/** A task from `POST /tasks`, `GET /tasks/:id`, etc. — carries its ids. */
export interface ApiTaskDocument extends ApiTask {
  boardId: string;
  columnId: string;
}

export interface ApiColumn {
  id: string;
  name: string;
  position: number;
  tasks: ApiTask[];
}

export interface ApiColumnDocument {
  id: string;
  title: string;
  name: string;
  position: number;
  boardId: string;
}

export interface ApiCollaborator {
  user: { id: string; name: string; email: string } | null;
  role: "editor" | "viewer";
}

/** `GET /boards/:id/full` */
export interface ApiFullBoard {
  id: string;
  name: string;
  myRole: "viewer" | "editor" | "owner" | "admin";
  collaborators: ApiCollaborator[];
  columns: ApiColumn[];
}

/** An entry in `GET /boards` — no columns, no tasks. */
export interface ApiBoardSummary {
  id: string;
  name: string;
  myRole: "viewer" | "editor" | "owner" | "admin";
  title?: string;
  collaborators?: ApiCollaborator[];
}

// ── Mapping ────────────────────────────────────────────────────────────────

export function toTask(task: ApiTask, columnId?: string): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    subtasks: (task.subtasks ?? []).map((s) => ({
      title: s.title,
      isCompleted: s.isCompleted,
    })),
    columnId: columnId ?? (task as ApiTaskDocument).columnId,
    position: task.position,
    assignedTo: task.assignedTo ?? null,
    dueDate: task.dueDate ?? null,
  };
}

export function toColumn(column: ApiColumn): Column {
  return {
    id: column.id,
    name: column.name,
    position: column.position,
    // Already ordered by position server-side; the order is preserved as-is
    // rather than re-sorted, so the API stays the single source of truth.
    tasks: (column.tasks ?? []).map((task) => toTask(task, column.id)),
  };
}

export function toBoard(board: ApiFullBoard): Board {
  return {
    id: board.id,
    name: board.name,
    myRole: board.myRole,
    columns: (board.columns ?? []).map(toColumn),
  };
}

/** `GET /boards/:id` — the board document, with owner and collaborators resolved. */
export interface ApiBoardDetail {
  id: string;
  name: string;
  title: string;
  myRole: "viewer" | "editor" | "owner" | "admin";
  owner: { id: string; name: string; email: string; avatar?: string } | string;
  collaborators: Array<{
    user: { id: string; name: string; email: string; avatar?: string } | string;
    role: "editor" | "viewer";
  }>;
}

/**
 * Flattens a board's owner and collaborators into one member list, owner first.
 *
 * The full-board payload does not carry the owner, so this comes from
 * `GET /boards/:id`. Unpopulated refs (a bare id string) are skipped rather
 * than rendered as an object — a half-resolved member is worse than none.
 */
export function toMembers(board: ApiBoardDetail): BoardMember[] {
  const members: BoardMember[] = [];

  if (board.owner && typeof board.owner !== "string") {
    members.push({ ...board.owner, role: "owner" });
  }

  for (const entry of board.collaborators ?? []) {
    if (entry.user && typeof entry.user !== "string") {
      members.push({ ...entry.user, role: entry.role });
    }
  }

  return members;
}

/** One `GET /boards/:id/activity` entry. */
export interface ApiActivityEntry {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; avatar?: string } | string | null;
}

export function toActivityEntry(entry: ApiActivityEntry): ActivityEntry {
  return {
    id: entry.id,
    action: entry.action,
    message: entry.message,
    createdAt: entry.createdAt,
    user: entry.user && typeof entry.user !== "string" ? entry.user : null,
  };
}
