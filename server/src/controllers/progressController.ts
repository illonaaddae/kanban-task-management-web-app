import type { Request, Response } from "express";
import { progressService } from "../services/progressService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
}

function requireBoard(req: Request) {
  if (!req.board) {
    throw new AppError("Board access was not resolved for this route", 500);
  }
  return req.board;
}

/**
 * Everyone the caller shares a team with.
 *
 * Not an authorisation surface — being a teammate grants nothing on any board. It
 * only decides whose name the share picker suggests, which is why it needs no
 * board or organization scope of its own.
 */
export const listTeammates = catchAsync(async (req: Request, res: Response) => {
  const teammates = await progressService.teammatesFor(requireUser(req));

  res.status(200).json({
    status: "success",
    data: { teammates, count: teammates.length },
  });
});

/**
 * Everything assigned to the caller, across every board they can reach.
 *
 * The landing view for a team member: boards resolve through the same union as
 * `GET /boards`, so a task on a team board appears without a per-board invite.
 */
export const listMyTasks = catchAsync(async (req: Request, res: Response) => {
  const tasks = await progressService.assignedTo(requireUser(req));

  res.status(200).json({
    status: "success",
    data: { tasks, count: tasks.length },
  });
});

/** Team-wide roll-up. Admin and above — it spans every board in the team. */
export const getTeamAnalytics = catchAsync(async (req: Request, res: Response) => {
  if (!req.organization) {
    throw new AppError("Organization access was not resolved for this route", 500);
  }

  const analytics = await progressService.forOrganization(
    req.organization._id.toString(),
  );

  res.status(200).json({ status: "success", data: { analytics } });
});

/**
 * Per-person progress on one board. Viewer and above, because it reveals nothing
 * a viewer cannot already count off the board itself.
 */
export const getBoardProgress = catchAsync(async (req: Request, res: Response) => {
  const progress = await progressService.forBoard(requireBoard(req)._id.toString());

  res.status(200).json({ status: "success", data: { progress } });
});
