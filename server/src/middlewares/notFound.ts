import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError";

/**
 * Terminal 404 for unmatched routes. Mounted after every route and before the
 * error handler.
 *
 * Registered with `app.use(notFound)` and no path - Express 5 changed
 * path-to-regexp so a bare `"*"` mount path no longer parses.
 */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
};

export default notFound;
