import type { Request, Response } from "express";
import type { BoardUserParams } from "../schemas/commonSchemas";
import type {
  AddCollaboratorInput,
  CreateBoardInput,
  UpdateBoardInput,
  UpdateCollaboratorInput,
} from "../schemas/boardSchemas";
import { boardService } from "../services/boardService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * `protect` guarantees req.user and `boardAccess` guarantees req.board /
 * req.myRole, but TypeScript only knows they are optional. These narrow once
 * so the handlers stay free of non-null assertions.
 */
function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
}

function requireBoard(req: Request) {
  if (!req.board || !req.myRole) {
    throw new AppError("Board access was not resolved for this route", 500);
  }
  return { board: req.board, myRole: req.myRole };
}

export const listBoards = catchAsync(async (req: Request, res: Response) => {
  const boards = await boardService.listForUser(requireUser(req));

  res.status(200).json({
    status: "success",
    data: { boards, count: boards.length },
  });
});

export const createBoard = catchAsync(async (req: Request, res: Response) => {
  const { title, organizationId } = req.body as CreateBoardInput;
  const board = await boardService.create(
    requireUser(req),
    title,
    organizationId ?? undefined,
  );

  res.status(201).json({ status: "success", data: { board } });
});

export const getBoard = catchAsync(async (req: Request, res: Response) => {
  const { board, myRole } = requireBoard(req);
  const detailed = await boardService.getDetailed(board._id.toString(), myRole);

  res.status(200).json({ status: "success", data: { board: detailed } });
});

/**
 * The nested board contract. `data` is the board itself rather than
 * `data.board` - this shape is fixed by CLAUDE.md so the frontend can consume
 * it without a mapping layer.
 */
export const getFullBoard = catchAsync(async (req: Request, res: Response) => {
  const { board, myRole } = requireBoard(req);
  const full = await boardService.getFull(board._id.toString(), myRole);

  res.status(200).json({ status: "success", data: full });
});

export const updateBoard = catchAsync(async (req: Request, res: Response) => {
  const { board, myRole } = requireBoard(req);
  const { title, organizationId } = req.body as UpdateBoardInput;

  const updated = await boardService.rename(
    board._id.toString(),
    title,
    myRole,
    requireUser(req),
    organizationId,
  );

  res.status(200).json({ status: "success", data: { board: updated } });
});

export const deleteBoard = catchAsync(async (req: Request, res: Response) => {
  const { board } = requireBoard(req);
  const deleted = await boardService.remove(board._id.toString());

  res.status(200).json({
    status: "success",
    data: { id: board._id.toString(), deleted },
  });
});

export const addCollaborator = catchAsync(async (req: Request, res: Response) => {
  const { board } = requireBoard(req);
  const { email, role } = req.body as AddCollaboratorInput;

  const updated = await boardService.addCollaborator(
    board,
    requireUser(req),
    email,
    role,
  );

  res.status(201).json({ status: "success", data: { board: updated } });
});

export const updateCollaborator = catchAsync(async (req: Request, res: Response) => {
  const { board } = requireBoard(req);
  const { userId } = req.params as unknown as BoardUserParams;
  const { role } = req.body as UpdateCollaboratorInput;

  const updated = await boardService.updateCollaboratorRole(
    board,
    userId,
    role,
    requireUser(req),
  );

  res.status(200).json({ status: "success", data: { board: updated } });
});

export const removeCollaborator = catchAsync(async (req: Request, res: Response) => {
  const { board } = requireBoard(req);
  const { userId } = req.params as unknown as BoardUserParams;

  const updated = await boardService.removeCollaborator(
    board,
    requireUser(req),
    userId,
  );

  res.status(200).json({ status: "success", data: { board: updated } });
});
