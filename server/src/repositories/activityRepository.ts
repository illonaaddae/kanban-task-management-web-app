import type { Types } from "mongoose";
import { ActivityLog, type ActivityLogDocument } from "../models/ActivityLog";

export type BoardId = string | Types.ObjectId;
export type UserId = string | Types.ObjectId;

export interface CreateActivityInput {
  boardId: BoardId;
  user: UserId;
  action: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginatedActivity {
  items: ActivityLogDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const activityRepository = {
  create(data: CreateActivityInput): Promise<ActivityLogDocument> {
    return ActivityLog.create(data);
  },

  /**
   * Newest-first feed for a board, with the metadata the paginated-response
   * contract needs. Count and page run concurrently.
   */
  async findByBoardId(
    boardId: BoardId,
    { page, limit }: PaginationInput,
  ): Promise<PaginatedActivity> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ActivityLog.find({ boardId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "name email avatar")
        .exec(),
      ActivityLog.countDocuments({ boardId }).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  /** Cascade helper - called when a board is deleted. */
  async deleteByBoardId(boardId: BoardId): Promise<number> {
    const { deletedCount } = await ActivityLog.deleteMany({ boardId }).exec();
    return deletedCount ?? 0;
  },
};

export default activityRepository;
