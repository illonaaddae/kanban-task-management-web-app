import type { Types } from "mongoose";
import type { BoardDocument } from "../models/Board";
import type { ColumnDocument } from "../models/Column";
import { columnRepository } from "../repositories/columnRepository";
import { taskRepository } from "../repositories/taskRepository";
import { AppError } from "../utils/AppError";

export interface RenameResult {
  column: ColumnDocument;
  /** How many tasks had their denormalised `status` rewritten. */
  tasksUpdated: number;
}

export interface RemoveColumnResult {
  tasks: number;
  /** How many later columns were shifted down to close the gap. */
  columnsShifted: number;
}

export const columnService = {
  /** Appends the column after the current last one. */
  async create(board: BoardDocument, title: string): Promise<ColumnDocument> {
    const position = (await columnRepository.maxPosition(board._id)) + 1;

    return columnRepository.create({ title, boardId: board._id, position });
  },

  /**
   * Renames the column and rewrites `status` on every task inside it.
   *
   * Tasks carry a denormalised copy of their column's title because the
   * frontend groups by `status`. Skipping this half of the rename would leave
   * those tasks pointing at a column name that no longer exists.
   */
  async rename(column: ColumnDocument, title: string): Promise<RenameResult> {
    const updated = await columnRepository.updateById(column._id, { title });
    if (!updated) throw AppError.notFound("Column not found");

    const tasksUpdated = await taskRepository.updateStatusByColumnId(
      column._id,
      title,
    );

    return { column: updated, tasksUpdated };
  },

  /**
   * Deletes the column, its tasks, and closes the positional gap so the
   * remaining columns stay contiguous from 0.
   */
  async remove(column: ColumnDocument): Promise<RemoveColumnResult> {
    const tasks = await taskRepository.deleteByColumnId(column._id);
    await columnRepository.deleteById(column._id);

    const columnsShifted = await columnRepository.bulkShiftPositions(
      column.boardId,
      column.position + 1,
      -1,
    );

    return { tasks, columnsShifted };
  },

  /**
   * Rewrites every column's position to match the given order.
   *
   * The payload must be a permutation of exactly the board's current columns.
   * A partial list would silently leave the omitted columns clustered at stale
   * positions, so a mismatch is rejected rather than half-applied.
   */
  async reorder(
    boardId: string | Types.ObjectId,
    orderedColumnIds: string[],
  ): Promise<ColumnDocument[]> {
    const existing = await columnRepository.findByBoardId(boardId);
    const existingIds = existing.map((c) => c._id.toString());

    const duplicates = orderedColumnIds.filter(
      (id, index) => orderedColumnIds.indexOf(id) !== index,
    );
    if (duplicates.length > 0) {
      throw AppError.badRequest("orderedColumnIds contains duplicate ids", [
        {
          field: "orderedColumnIds",
          message: `Duplicated: ${[...new Set(duplicates)].join(", ")}`,
        },
      ]);
    }

    const missing = existingIds.filter((id) => !orderedColumnIds.includes(id));
    const unknown = orderedColumnIds.filter((id) => !existingIds.includes(id));

    if (missing.length > 0 || unknown.length > 0) {
      const details = [];
      if (missing.length > 0) {
        details.push({
          field: "orderedColumnIds",
          message: `Missing column ids: ${missing.join(", ")}`,
        });
      }
      if (unknown.length > 0) {
        details.push({
          field: "orderedColumnIds",
          message: `Ids that do not belong to this board: ${unknown.join(", ")}`,
        });
      }

      throw AppError.badRequest(
        "orderedColumnIds must list exactly the board's columns",
        details,
      );
    }

    await columnRepository.reorder(boardId, orderedColumnIds);

    return columnRepository.findByBoardId(boardId);
  },
};

export default columnService;
