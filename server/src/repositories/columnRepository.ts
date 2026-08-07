import type { Types } from "mongoose";
import { Column, type ColumnDocument } from "../models/Column";

export type ColumnId = string | Types.ObjectId;
export type BoardId = string | Types.ObjectId;

export interface CreateColumnInput {
  title: string;
  boardId: BoardId;
  position: number;
}

export type UpdateColumnInput = Partial<{ title: string; position: number }>;

export const columnRepository = {
  create(data: CreateColumnInput): Promise<ColumnDocument> {
    return Column.create(data);
  },

  findById(id: ColumnId): Promise<ColumnDocument | null> {
    return Column.findById(id).exec();
  },

  /** All columns on a board, in display order. */
  findByBoardId(boardId: BoardId): Promise<ColumnDocument[]> {
    return Column.find({ boardId }).sort({ position: 1 }).exec();
  },

  countByBoardId(boardId: BoardId): Promise<number> {
    return Column.countDocuments({ boardId }).exec();
  },

  /**
   * Highest position currently used on the board, or -1 when the board has no
   * columns - so a caller can always append at `maxPosition + 1`.
   */
  async maxPosition(boardId: BoardId): Promise<number> {
    const last = await Column.findOne({ boardId })
      .sort({ position: -1 })
      .select("position")
      .lean()
      .exec();

    return last?.position ?? -1;
  },

  updateById(id: ColumnId, updates: UpdateColumnInput): Promise<ColumnDocument | null> {
    return Column.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).exec();
  },

  deleteById(id: ColumnId): Promise<ColumnDocument | null> {
    return Column.findByIdAndDelete(id).exec();
  },

  /** Cascade helper - called when a board is deleted. */
  async deleteByBoardId(boardId: BoardId): Promise<number> {
    const { deletedCount } = await Column.deleteMany({ boardId }).exec();
    return deletedCount ?? 0;
  },

  /**
   * Rewrites positions to match the given order in a single round trip.
   * Ids not belonging to the board are filtered out by the boardId in each
   * filter, so a stray id is a no-op rather than a cross-board write.
   */
  async reorder(boardId: BoardId, orderedColumnIds: ColumnId[]): Promise<number> {
    if (orderedColumnIds.length === 0) return 0;

    const result = await Column.bulkWrite(
      orderedColumnIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id, boardId },
          update: { $set: { position: index } },
        },
      })),
    );

    return result.modifiedCount ?? 0;
  },

  /**
   * Closes the gap left by a deleted column so positions stay contiguous.
   * Shifts every column at or after `fromPosition` by `delta`.
   */
  async bulkShiftPositions(
    boardId: BoardId,
    fromPosition: number,
    delta: number,
  ): Promise<number> {
    if (delta === 0) return 0;

    const result = await Column.bulkWrite([
      {
        updateMany: {
          filter: { boardId, position: { $gte: fromPosition } },
          update: { $inc: { position: delta } },
        },
      },
    ]);

    return result.modifiedCount ?? 0;
  },
};

export default columnRepository;
