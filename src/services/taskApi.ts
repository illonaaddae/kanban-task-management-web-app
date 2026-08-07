import { api } from "./api";
import { toTask, type ApiFullBoard, type ApiTaskDocument } from "./apiShapes";
import type { Task } from "../types";

/**
 * Task data access against the Express API.
 *
 * Signatures are unchanged from the Appwrite version. No localStorage fallback:
 * a failure throws so the store can record it and the UI can say so.
 */

/**
 * Every task on a board, in column-then-position order.
 *
 * Flattened out of the nested board response, so each task carries the
 * `columnId` the frontend needs to move it without a second lookup.
 */
export async function getTasks(boardId: string): Promise<Task[]> {
  const full = await api.get<ApiFullBoard>(`/boards/${boardId}/full`);

  return full.columns.flatMap((column) =>
    column.tasks.map((task) => toTask(task, column.id)),
  );
}

/**
 * Resolves a column name to its id.
 *
 * The frontend's `Task.status` is a column *name*; the API needs a `columnId`.
 * Callers that already know the id should pass it - this is the fallback for
 * the existing call sites that only have a status.
 */
async function resolveColumnId(boardId: string, status: string): Promise<string> {
  const full = await api.get<ApiFullBoard>(`/boards/${boardId}/full`);
  const column = full.columns.find((c) => c.name === status);

  if (!column) {
    throw new Error(
      `This board has no column called "${status}". Refresh and try again.`,
    );
  }

  return column.id;
}

export async function createTask(
  boardId: string,
  _userId: string,
  task: Omit<Task, "id">,
): Promise<Task> {
  const columnId = task.columnId ?? (await resolveColumnId(boardId, task.status));

  const { task: created } = await api.post<{ task: ApiTaskDocument }>("/tasks", {
    boardId,
    columnId,
    title: task.title,
    description: task.description ?? "",
    subtasks: task.subtasks ?? [],
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    ...(task.assignedTo ? { assignedTo: task.assignedTo } : {}),
  });

  return toTask(created, created.columnId);
}

/**
 * Partial update. Subtask toggling comes through here.
 *
 * `status`, `columnId` and `position` are stripped: the API rejects them on this
 * route on purpose, because changing a column is a move. Callers that want to
 * move a task must use `moveTask`, which also keeps both columns' positions
 * contiguous - something this endpoint cannot do.
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Task>,
): Promise<Task> {
  const payload: Record<string, unknown> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.subtasks !== undefined) payload.subtasks = updates.subtasks;
  if (updates.dueDate !== undefined) payload.dueDate = updates.dueDate;
  if (updates.assignedTo !== undefined) payload.assignedTo = updates.assignedTo;

  if (Object.keys(payload).length === 0) {
    // Nothing this route can change - a status-only update means "move", and
    // sending an empty body would just earn a 400.
    const { task } = await api.get<{ task: ApiTaskDocument }>(`/tasks/${taskId}`);
    return toTask(task, task.columnId);
  }

  const { task } = await api.patch<{ task: ApiTaskDocument }>(
    `/tasks/${taskId}`,
    payload,
  );

  return toTask(task, task.columnId);
}

/**
 * Persists a drag-and-drop.
 *
 * One endpoint for both cases: moving across columns and reordering inside a
 * single column are the same request, differing only in whether `columnId` is
 * the task's current column. The server closes the gap in the source column and
 * opens the slot in the target in one bulkWrite, so both end up contiguous, and
 * rewrites `status` to the target column's name.
 */
export async function moveTask(
  taskId: string,
  columnId: string,
  position: number,
): Promise<Task> {
  const { task } = await api.patch<{ task: ApiTaskDocument }>(
    `/tasks/${taskId}/move`,
    { columnId, position },
  );

  return toTask(task, task.columnId);
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
