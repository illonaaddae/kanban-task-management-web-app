import type { Types } from "mongoose";
import type { BoardDocument } from "../models/Board";
import type { ColumnDocument } from "../models/Column";
import type { TaskDocument } from "../models/Task";
import type { UserDocument } from "../models/User";
import { columnRepository } from "../repositories/columnRepository";
import { taskRepository } from "../repositories/taskRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { userRepository } from "../repositories/userRepository";
import type { CreateTaskInput, UpdateTaskInput } from "../schemas/taskSchemas";
import { AppError } from "../utils/AppError";
import { activityService } from "./activityService";

export interface DeleteTaskResult {
  /** How many later tasks in the source column were shifted down. */
  tasksShifted: number;
}

/**
 * Resolves a column and confirms it sits on the expected board.
 *
 * A column that does not exist and a column belonging to a different board
 * produce the *same* 404. Distinguishing them would confirm the existence of
 * columns on boards the caller cannot see.
 */
async function requireColumnOnBoard(
  columnId: string,
  boardId: Types.ObjectId,
): Promise<ColumnDocument> {
  const column = await columnRepository.findById(columnId);

  if (!column || column.boardId.toString() !== boardId.toString()) {
    throw AppError.notFound("Column not found on this board");
  }

  return column;
}

/**
 * A task may only be assigned to someone who can actually see the board.
 * Returns the assignee so callers can name them in the activity entry.
 *
 * "Can see it" has to mean the same thing here as in `boardAccess`, which counts
 * team membership as access. Checking only owner-or-collaborator made a teammate
 * unassignable on their own team's board — the exact thing team boards exist for.
 */
async function requireAssignable(
  board: BoardDocument,
  assignedTo: string,
): Promise<UserDocument> {
  const isOwner = board.owner.toString() === assignedTo;
  const isCollaborator = board.collaborators.some(
    (c) => c.user.toString() === assignedTo,
  );

  let isTeammate = false;
  if (!isOwner && !isCollaborator && board.organization) {
    const org = await organizationRepository.findById(board.organization);
    isTeammate =
      !!org &&
      (org.owner.toString() === assignedTo ||
        org.members.some((m) => m.user.toString() === assignedTo));
  }

  if (!isOwner && !isCollaborator && !isTeammate) {
    throw AppError.badRequest("Assignee must be a member of this board", [
      {
        field: "assignedTo",
        message: board.organization
          ? "That user is not on this board or in its team"
          : "That user is not the owner or a collaborator on this board",
      },
    ]);
  }

  const user = await userRepository.findById(assignedTo);
  if (!user) {
    throw AppError.badRequest("Assignee must be a member of this board", [
      { field: "assignedTo", message: "That user no longer exists" },
    ]);
  }

  return user;
}

export const taskService = {
  async create(
    board: BoardDocument,
    actor: UserDocument,
    input: CreateTaskInput,
  ): Promise<TaskDocument> {
    const column = await requireColumnOnBoard(input.columnId, board._id);

    const assignee = input.assignedTo
      ? await requireAssignable(board, input.assignedTo)
      : null;

    const position = (await taskRepository.maxPosition(column._id)) + 1;

    const task = await taskRepository.create({
      title: input.title,
      description: input.description,
      subtasks: input.subtasks,
      dueDate: input.dueDate ?? null,
      assignedTo: assignee?._id ?? null,
      boardId: board._id,
      columnId: column._id,
      position,
      // Mirrors the column title so the frontend's status grouping holds.
      status: column.title,
    });

    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "task.created",
      message: `${actor.name} created "${task.title}"`,
      meta: { taskId: task._id.toString(), column: column.title },
    });

    if (assignee) {
      await activityService.log({
        boardId: board._id,
        user: actor._id,
        action: "task.assigned",
        message: `${actor.name} assigned "${task.title}" to ${assignee.name}`,
        meta: { taskId: task._id.toString(), assignedTo: assignee._id.toString() },
      });
    }

    return task;
  },

  async update(
    task: TaskDocument,
    board: BoardDocument,
    actor: UserDocument,
    input: UpdateTaskInput,
  ): Promise<TaskDocument> {
    const previousAssignee = task.assignedTo?.toString() ?? null;
    let assignee: UserDocument | null = null;

    if (input.assignedTo) {
      assignee = await requireAssignable(board, input.assignedTo);
    }

    // Only forward keys the client actually sent, so a partial update never
    // blanks a field it did not mention.
    const updates: Parameters<typeof taskRepository.updateById>[1] = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.subtasks !== undefined) updates.subtasks = input.subtasks;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
    if (input.assignedTo !== undefined) {
      updates.assignedTo = assignee ? assignee._id : null;
    }

    const updated = await taskRepository.updateById(task._id, updates);
    if (!updated) throw AppError.notFound("Task not found");

    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "task.updated",
      message: `${actor.name} updated "${updated.title}"`,
      meta: { taskId: updated._id.toString(), fields: Object.keys(updates) },
    });

    // Only when the assignee actually changed to somebody.
    if (assignee && assignee._id.toString() !== previousAssignee) {
      await activityService.log({
        boardId: board._id,
        user: actor._id,
        action: "task.assigned",
        message: `${actor.name} assigned "${updated.title}" to ${assignee.name}`,
        meta: { taskId: updated._id.toString(), assignedTo: assignee._id.toString() },
      });
    }

    return updated;
  },

  /** Deletes the task and closes the gap it leaves in its column. */
  async remove(
    task: TaskDocument,
    board: BoardDocument,
    actor: UserDocument,
  ): Promise<DeleteTaskResult> {
    await taskRepository.deleteById(task._id);

    const tasksShifted = await taskRepository.bulkShiftPositions(
      task.columnId,
      task.position + 1,
      -1,
    );

    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "task.deleted",
      message: `${actor.name} deleted "${task.title}"`,
      meta: { taskId: task._id.toString() },
    });

    return { tasksShifted };
  },

  /**
   * Moves a task to `position` in `columnId`, per CLAUDE.md:
   *
   *   1. validate the target column exists and is on the same board
   *   2. decrement positions after the old slot in the source column
   *   3. increment positions at/after the new slot in the target column
   *   4. set columnId, position and status
   *   5. shifts run as one bulkWrite; log task.moved
   *
   * A same-column reorder is the same call with the same columnId — steps 2
   * and 3 then apply to one column and still land on contiguous positions.
   */
  async move(
    task: TaskDocument,
    board: BoardDocument,
    actor: UserDocument,
    columnId: string,
    requestedPosition: number,
  ): Promise<TaskDocument> {
    // 1.
    const target = await requireColumnOnBoard(columnId, board._id);

    const sameColumn = task.columnId.toString() === target._id.toString();
    const occupied = await taskRepository.countByColumnId(target._id);

    // Clamp instead of rejecting: a drag-and-drop client computes the index
    // optimistically and can legitimately overshoot the end of a column.
    // Leaving a gap there would break the contiguity the move guarantees.
    const highest = sameColumn ? occupied - 1 : occupied;
    const position = Math.min(Math.max(requestedPosition, 0), Math.max(highest, 0));

    // 2 + 3, as a single ordered bulkWrite.
    await taskRepository.shiftForMove({
      sourceColumnId: task.columnId,
      sourceFromPosition: task.position + 1,
      targetColumnId: target._id,
      targetAtPosition: position,
      excludeTaskId: task._id,
    });

    // 4.
    const moved = await taskRepository.updateById(task._id, {
      columnId: target._id,
      position,
      status: target.title,
    });
    if (!moved) throw AppError.notFound("Task not found");

    // 5.
    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "task.moved",
      message: `Task moved to ${target.title} by ${actor.name}`,
      meta: {
        taskId: moved._id.toString(),
        to: target.title,
        columnId: target._id.toString(),
        position,
      },
    });

    return moved;
  },
};

export default taskService;
