import type { Request, RequestHandler } from "express";
import { authService } from "../services/authService";
import type { UserRole } from "../models/User";
import { userRepository } from "../repositories/userRepository";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { verifyAccessToken } from "../utils/generateTokens";

/** Pulls the credential out of `Authorization: Bearer <token>`. */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim() || null;
}

/**
 * Authenticates the request and attaches the full user document to `req.user`.
 *
 * Every failure is a 401 with its own message - missing, invalid, expired,
 * deleted user, stale session. A garbled token is caught and mapped, never
 * allowed to surface as a 500.
 */
export const protect: RequestHandler = catchAsync(async (req, _res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    throw AppError.unauthorized(
      "You are not logged in. Provide a Bearer token in the Authorization header.",
    );
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw authService.toAuthError(error, "access");
  }

  const user = await userRepository.findById(payload.id);
  if (!user) {
    throw AppError.unauthorized("The user belonging to this token no longer exists");
  }

  // Logout and password changes bump tokenVersion, so a token minted before
  // that point is refused even though its signature and expiry are still good.
  if (user.tokenVersion !== payload.tokenVersion) {
    throw AppError.unauthorized("Session is no longer valid. Please log in again.");
  }

  req.user = user;
  next();
});

/**
 * Global-role gate. Runs after `protect`.
 *
 * 401 means "we do not know who you are"; 403 means "we do, and you may not
 * do this". Returning 401 here would wrongly tell a logged-in client that
 * re-authenticating might help.
 */
export const restrictTo = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized("You are not logged in"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden("You do not have permission to perform this action"),
      );
    }

    next();
  };
};

export default protect;
