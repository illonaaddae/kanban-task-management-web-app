import type { RequestHandler } from "express";
import { taskRepository } from "../repositories/taskRepository";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * Loads the task named by `:id` and publishes its parent board on
 * `req.boardId`, so `boardAccess` can apply the ordinary board-level check.
 *
 * Mount order is: validate params → loadTask → boardAccess(minRole).
 *
 * A task that does not exist is a 404. A task inside someone else's board
 * falls through to `boardAccess`, which answers 403 — so a task id cannot be
 * probed for existence through a 404-vs-403 difference.
 */
export const loadTask: RequestHandler = catchAsync(async (req, _res, next) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw AppError.badRequest("No task was specified for this request");
  }

  const task = await taskRepository.findById(id);
  if (!task) {
    throw AppError.notFound("Task not found");
  }

  req.task = task;
  req.boardId = task.boardId.toString();
  next();
});

export default loadTask;
