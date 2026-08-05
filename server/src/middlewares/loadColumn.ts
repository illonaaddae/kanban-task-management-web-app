import type { RequestHandler } from "express";
import { columnRepository } from "../repositories/columnRepository";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * Loads the column named by `:id` and publishes its parent board on
 * `req.boardId`, so `boardAccess` can run the ordinary board check against a
 * route that has no board in its path.
 *
 * Mount order is: validate params → loadColumn → boardAccess(minRole).
 *
 * A column that does not exist is a 404 here. A column that exists inside
 * someone else's board falls through to `boardAccess`, which answers 403 —
 * so a column id can never be probed for existence via a 404/403 difference.
 */
export const loadColumn: RequestHandler = catchAsync(async (req, _res, next) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw AppError.badRequest("No column was specified for this request");
  }

  const column = await columnRepository.findById(id);
  if (!column) {
    throw AppError.notFound("Column not found");
  }

  req.column = column;
  req.boardId = column.boardId.toString();
  next();
});

export default loadColumn;
