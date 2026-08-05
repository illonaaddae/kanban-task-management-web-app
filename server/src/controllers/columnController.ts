import type { Request, Response } from "express";
import type {
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "../schemas/columnSchemas";
import { columnService } from "../services/columnService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireBoard(req: Request) {
  if (!req.board) {
    throw new AppError("Board access was not resolved for this route", 500);
  }
  return req.board;
}

function requireColumn(req: Request) {
  if (!req.column) {
    throw new AppError("Column was not loaded for this route", 500);
  }
  return req.column;
}

export const createColumn = catchAsync(async (req: Request, res: Response) => {
  const { title } = req.body as CreateColumnInput;
  const column = await columnService.create(requireBoard(req), title);

  res.status(201).json({ status: "success", data: { column } });
});

export const updateColumn = catchAsync(async (req: Request, res: Response) => {
  const { title } = req.body as UpdateColumnInput;
  const { column, tasksUpdated } = await columnService.rename(
    requireColumn(req),
    title,
  );

  res.status(200).json({ status: "success", data: { column, tasksUpdated } });
});

export const deleteColumn = catchAsync(async (req: Request, res: Response) => {
  const column = requireColumn(req);
  const deleted = await columnService.remove(column);

  res.status(200).json({
    status: "success",
    data: { id: column._id.toString(), deleted },
  });
});

export const reorderColumns = catchAsync(async (req: Request, res: Response) => {
  const board = requireBoard(req);
  const { orderedColumnIds } = req.body as ReorderColumnsInput;

  const columns = await columnService.reorder(board._id, orderedColumnIds);

  res.status(200).json({ status: "success", data: { columns } });
});
