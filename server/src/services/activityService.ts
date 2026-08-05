import type { Types } from "mongoose";
import { logger } from "../config/logger";
import {
  activityRepository,
  type PaginatedActivity,
} from "../repositories/activityRepository";

export interface LogActivityParams {
  boardId: string | Types.ObjectId;
  user: string | Types.ObjectId;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
}

export const activityService = {
  /**
   * Records one activity entry.
   *
   * A failure here is swallowed and logged rather than propagated: this is a
   * convenience feed, not a security audit trail, and losing an entry is a
   * much smaller problem than failing the board mutation that produced it.
   */
  async log(params: LogActivityParams): Promise<void> {
    try {
      await activityRepository.create(params);
    } catch (error) {
      logger.error(
        { err: error, action: params.action, boardId: String(params.boardId) },
        "Failed to write activity log entry",
      );
    }
  },

  listForBoard(
    boardId: string | Types.ObjectId,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedActivity> {
    return activityRepository.findByBoardId(boardId, pagination);
  },
};

export default activityService;
