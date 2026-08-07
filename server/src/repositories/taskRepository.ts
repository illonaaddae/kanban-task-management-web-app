import type { Types } from "mongoose";
import { Task, type ISubtask, type TaskDocument } from "../models/Task";

export type TaskId = string | Types.ObjectId;
export type BoardId = string | Types.ObjectId;
export type ColumnId = string | Types.ObjectId;
export type UserId = string | Types.ObjectId;

export interface CreateTaskInput {
  title: string;
  description?: string;
  boardId: BoardId;
  columnId: ColumnId;
  position: number;
  status: string;
  assignedTo?: UserId | null;
  dueDate?: Date | null;
  subtasks?: ISubtask[];
}

export type UpdateTaskInput = Partial<{
  title: string;
  description: string;
  columnId: ColumnId;
  position: number;
  status: string;
  assignedTo: UserId | null;
  dueDate: Date | null;
  subtasks: ISubtask[];
}>;

export const taskRepository = {
  create(data: CreateTaskInput): Promise<TaskDocument> {
    return Task.create(data);
  },

  findById(id: TaskId): Promise<TaskDocument | null> {
    return Task.findById(id).exec();
  },

  /** Every task on a board, ordered for grouping into columns. */
  findByBoardId(boardId: BoardId): Promise<TaskDocument[]> {
    return Task.find({ boardId }).sort({ position: 1 }).exec();
  },

  /** Tasks assigned to one person across a set of boards. */
  findAssignedInBoards(userId: UserId, boardIds: BoardId[]): Promise<TaskDocument[]> {
    if (boardIds.length === 0) return Promise.resolve([]);

    return Task.find({ assignedTo: userId, boardId: { $in: boardIds } })
      .sort({ dueDate: 1, position: 1 })
      .exec();
  },

  /** Every task on a set of boards. Backs the team analytics roll-up. */
  findByBoardIds(boardIds: BoardId[]): Promise<TaskDocument[]> {
    if (boardIds.length === 0) return Promise.resolve([]);
    return Task.find({ boardId: { $in: boardIds } }).exec();
  },

  findByColumnId(columnId: ColumnId): Promise<TaskDocument[]> {
    return Task.find({ columnId }).sort({ position: 1 }).exec();
  },

  countByColumnId(columnId: ColumnId): Promise<number> {
    return Task.countDocuments({ columnId }).exec();
  },

  /**
   * Highest position currently used in the column, or -1 when the column is
   * empty - so a caller can always append at `maxPosition + 1`.
   */
  async maxPosition(columnId: ColumnId): Promise<number> {
    const last = await Task.findOne({ columnId })
      .sort({ position: -1 })
      .select("position")
      .lean()
      .exec();

    return last?.position ?? -1;
  },

  updateById(id: TaskId, updates: UpdateTaskInput): Promise<TaskDocument | null> {
    return Task.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).exec();
  },

  deleteById(id: TaskId): Promise<TaskDocument | null> {
    return Task.findByIdAndDelete(id).exec();
  },

  /** Cascade helper - called when a board is deleted. */
  async deleteByBoardId(boardId: BoardId): Promise<number> {
    const { deletedCount } = await Task.deleteMany({ boardId }).exec();
    return deletedCount ?? 0;
  },

  /** Cascade helper - called when a column is deleted. */
  async deleteByColumnId(columnId: ColumnId): Promise<number> {
    const { deletedCount } = await Task.deleteMany({ columnId }).exec();
    return deletedCount ?? 0;
  },

  /**
   * Shifts every task in `columnId` whose position is >= `fromPosition` by
   * `delta`, in one bulkWrite.
   *
   * The bound is inclusive, so the two halves of a move are:
   *   • close the gap in the source column: (oldPosition + 1, -1)
   *   • open a slot in the target column:   (newPosition,     +1)
   */
  async bulkShiftPositions(
    columnId: ColumnId,
    fromPosition: number,
    delta: number,
  ): Promise<number> {
    if (delta === 0) return 0;

    const result = await Task.bulkWrite([
      {
        updateMany: {
          filter: { columnId, position: { $gte: fromPosition } },
          update: { $inc: { position: delta } },
        },
      },
    ]);

    return result.modifiedCount ?? 0;
  },

  /**
   * Both halves of a move in a single ordered bulkWrite:
   *   1. close the gap left behind in the source column
   *   2. open the slot in the target column
   *
   * The moving task is excluded from both filters. Without that exclusion a
   * same-column reorder would shift the task by its own shifts and only come
   * out right because step 4 overwrites its position afterwards - correct by
   * accident rather than by construction.
   */
  async shiftForMove(params: {
    sourceColumnId: ColumnId;
    sourceFromPosition: number;
    targetColumnId: ColumnId;
    targetAtPosition: number;
    excludeTaskId: TaskId;
  }): Promise<number> {
    const result = await Task.bulkWrite([
      {
        updateMany: {
          filter: {
            columnId: params.sourceColumnId,
            position: { $gte: params.sourceFromPosition },
            _id: { $ne: params.excludeTaskId },
          },
          update: { $inc: { position: -1 } },
        },
      },
      {
        updateMany: {
          filter: {
            columnId: params.targetColumnId,
            position: { $gte: params.targetAtPosition },
            _id: { $ne: params.excludeTaskId },
          },
          update: { $inc: { position: 1 } },
        },
      },
    ]);

    return result.modifiedCount ?? 0;
  },

  /**
   * Keeps the denormalised `status` copy aligned when a column is renamed.
   * Without this the frontend, which groups by status, would drop the tasks.
   */
  async updateStatusByColumnId(columnId: ColumnId, status: string): Promise<number> {
    const { modifiedCount } = await Task.updateMany(
      { columnId },
      { $set: { status } },
    ).exec();

    return modifiedCount ?? 0;
  },

  /** Clears an assignee across a board when a collaborator is removed. */
  async unassignUserFromBoard(boardId: BoardId, userId: UserId): Promise<number> {
    const { modifiedCount } = await Task.updateMany(
      { boardId, assignedTo: userId },
      { $set: { assignedTo: null } },
    ).exec();

    return modifiedCount ?? 0;
  },
};

export default taskRepository;
