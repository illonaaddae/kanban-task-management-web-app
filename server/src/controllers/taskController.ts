import type { Request, Response } from "express";
import type {
  CreateTaskInput,
  MoveTaskInput,
  UpdateTaskInput,
} from "../schemas/taskSchemas";
import { taskService } from "../services/taskService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireContext(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  if (!req.board) {
    throw new AppError("Board access was not resolved for this route", 500);
  }
  return { actor: req.user, board: req.board };
}

function requireTask(req: Request) {
  if (!req.task) {
    throw new AppError("Task was not loaded for this route", 500);
  }
  return req.task;
}

export const createTask = catchAsync(async (req: Request, res: Response) => {
  const { actor, board } = requireContext(req);
  const task = await taskService.create(board, actor, req.body as CreateTaskInput);

  res.status(201).json({ status: "success", data: { task } });
});

export const getTask = catchAsync(async (req: Request, res: Response) => {
  res.status(200).json({ status: "success", data: { task: requireTask(req) } });
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
  const { actor, board } = requireContext(req);
  const task = await taskService.update(
    requireTask(req),
    board,
    actor,
    req.body as UpdateTaskInput,
  );

  res.status(200).json({ status: "success", data: { task } });
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
  const { actor, board } = requireContext(req);
  const task = requireTask(req);

  const deleted = await taskService.remove(task, board, actor);

  res.status(200).json({
    status: "success",
    data: { id: task._id.toString(), deleted },
  });
});

export const moveTask = catchAsync(async (req: Request, res: Response) => {
  const { actor, board } = requireContext(req);
  const { columnId, position } = req.body as MoveTaskInput;

  const task = await taskService.move(
    requireTask(req),
    board,
    actor,
    columnId,
    position,
  );

  res.status(200).json({ status: "success", data: { task } });
});
