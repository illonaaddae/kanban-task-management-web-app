import type { Request, Response } from "express";
import type { LoginInput, RefreshInput, RegisterInput } from "../schemas/authSchemas";
import { authService } from "../services/authService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import type { AuthResult } from "../services/authService";

/** `{ user, accessToken, refreshToken }` — the shape the frontend unwraps. */
function authPayload({ user, tokens }: AuthResult) {
  return { user, ...tokens };
}

export const register = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.register(req.body as RegisterInput);

  res.status(201).json({ status: "success", data: authPayload(result) });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const result = await authService.login(email, password);

  res.status(200).json({ status: "success", data: authPayload(result) });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as RefreshInput;
  const result = await authService.refresh(refreshToken);

  res.status(200).json({ status: "success", data: authPayload(result) });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized("You are not logged in");

  await authService.logout(req.user._id.toString());

  res.status(200).json({
    status: "success",
    data: { message: "Logged out. All existing sessions have been invalidated." },
  });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized("You are not logged in");

  res.status(200).json({ status: "success", data: { user: req.user } });
});
