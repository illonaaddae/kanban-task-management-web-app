import type { Request, Response } from "express";
import { env } from "../config/env";
import type { ChatInput, InterpretCommandInput } from "../schemas/commandSchemas";
import type { PlanTeamInput, SuggestTaskInput } from "../schemas/aiSchemas";
import { boardService } from "../services/boardService";
import { aiService } from "../services/aiService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
}

/** `boardAccess("editor")` guarantees this; TypeScript only knows it is optional. */
function requireBoardEditor(req: Request) {
  if (!req.board) {
    throw new AppError("Board access was not resolved for this route", 500);
  }
  return req.board;
}

/**
 * Whether the assistant is available at all.
 *
 * Lets the frontend hide the buttons instead of offering something that answers
 * 503, and needs no key to answer. Reports only the boolean and the model name:
 * a signed-in user has no business knowing the key or the token ceiling.
 */
export const getAiStatus = catchAsync(async (_req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    data: {
      enabled: env.aiEnabled,
      model: env.aiEnabled ? env.OPENAI_MODEL : null,
    },
  });
});

/**
 * Suggests a description and subtasks for a task.
 *
 * Returns a proposal. Nothing is written: the user edits it and the existing
 * task endpoints do the creating, with their own validation.
 */
export const suggestTask = catchAsync(async (req: Request, res: Response) => {
  const { title, context } = req.body as SuggestTaskInput;
  const suggestion = await aiService.suggestTask(
    requireUser(req)._id.toString(),
    title,
    context,
  );

  res.status(200).json({ status: "success", data: { suggestion } });
});

/** The board context every AI board feature is grounded in. */
async function boardContext(boardId: string) {
  const full = await boardService.getFull(boardId, "editor");
  return {
    name: full.name,
    columns: full.columns.map((column) => column.name),
    tasks: full.columns.flatMap((column) => column.tasks.map((task) => task.title)),
    people: full.collaborators
      .map((entry) => entry.user?.name)
      .filter((name): name is string => Boolean(name)),
  };
}

/**
 * A conversation about one board.
 *
 * Editor and above, same as the command endpoint: a reply can carry a proposed
 * change, so somebody who could not make that change has no business having one
 * drafted. The change itself still needs the user to confirm it.
 */
export const chat = catchAsync(async (req: Request, res: Response) => {
  const { messages } = req.body as ChatInput;
  const board = requireBoardEditor(req);

  const reply = await aiService.chat(
    requireUser(req)._id.toString(),
    messages,
    await boardContext(board._id.toString()),
  );

  res.status(200).json({ status: "success", data: reply });
});

/**
 * Reads one instruction about a board and names the action it asks for.
 *
 * The board is loaded here and its real column, task and member names are passed to
 * the model, so it copies from what exists rather than inventing plausible ones. The
 * response is still only a plan: `boardAccess` has already established the caller
 * may edit this board, and the actual change goes through the ordinary endpoints
 * after the user confirms.
 */
export const interpretCommand = catchAsync(async (req: Request, res: Response) => {
  const { instruction } = req.body as InterpretCommandInput;
  const board = requireBoardEditor(req);

  const plan = await aiService.interpretCommand(
    requireUser(req)._id.toString(),
    instruction,
    await boardContext(board._id.toString()),
  );

  res.status(200).json({ status: "success", data: { plan } });
});

/**
 * Turns a sentence into a proposed team, first board and invitee list.
 *
 * Strictly a proposal, for the same reason: creating a team and sending
 * invitations off the back of a model response, without a human confirming it,
 * would mean a hallucinated address gets a real email.
 */
export const planTeam = catchAsync(async (req: Request, res: Response) => {
  const { prompt } = req.body as PlanTeamInput;
  const plan = await aiService.planTeam(requireUser(req)._id.toString(), prompt);

  res.status(200).json({ status: "success", data: { plan } });
});
