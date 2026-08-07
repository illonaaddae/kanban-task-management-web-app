import type { Request, Response } from "express";
import { env } from "../config/env";
import type { PlanTeamInput, SuggestTaskInput } from "../schemas/aiSchemas";
import { aiService } from "../services/aiService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
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
