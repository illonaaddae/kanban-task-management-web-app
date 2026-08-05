import type { Request, Response } from "express";
import type { Pagination } from "../schemas/commonSchemas";
import { activityService } from "../services/activityService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const getBoardActivity = catchAsync(async (req: Request, res: Response) => {
  if (!req.board) {
    throw new AppError("Board access was not resolved for this route", 500);
  }

  const { page, limit } = req.query as unknown as Pagination;
  const { items, total, totalPages } = await activityService.listForBoard(
    req.board._id,
    { page, limit },
  );

  res.status(200).json({
    status: "success",
    data: {
      activity: items,
      pagination: { page, limit, total, totalPages },
    },
  });
});
