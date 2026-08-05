import type { Request, Response } from "express";
import type { UpdateMeInput } from "../schemas/userSchemas";
import { userService } from "../services/userService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const updateMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized("You are not logged in");

  const user = await userService.updateMe(
    req.user._id.toString(),
    req.body as UpdateMeInput,
  );

  res.status(200).json({ status: "success", data: { user } });
});

export const listUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await userService.listAll();

  res.status(200).json({
    status: "success",
    data: { users, count: users.length },
  });
});
