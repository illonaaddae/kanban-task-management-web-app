import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Forwards a rejected promise to the error handler so controllers can stay
 * try/catch-free.
 *
 * Express 5 already does this for returned rejected promises, but wrapping
 * explicitly keeps the intent visible and keeps handlers working the same way
 * if they are ever mounted somewhere that does not (e.g. a v4 sub-app).
 */
export const catchAsync =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default catchAsync;
