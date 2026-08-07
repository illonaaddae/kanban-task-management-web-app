import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError, type ErrorDetail } from "../utils/AppError";

interface ErrorBody {
  status: "error";
  message: string;
  details?: ErrorDetail[];
  stack?: string;
}

interface Normalized {
  statusCode: number;
  message: string;
  details?: ErrorDetail[];
  /** false => unexpected; log the stack and hide the real message in prod. */
  isOperational: boolean;
}

function hasCode(err: unknown, code: number): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === code;
}

function normalize(err: unknown): Normalized {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      details: err.details,
      isOperational: true,
    };
  }

  // A schema that reached parse() outside the validate middleware.
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      message: "Validation failed",
      details: err.issues.map((issue) => ({
        field: issue.path.length ? issue.path.join(".") : "(root)",
        message: issue.message,
      })),
      isOperational: true,
    };
  }

  // Malformed ObjectId in a param or filter.
  if (err instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      message: `Invalid value for '${err.path}'`,
      details: [{ field: err.path, message: `'${String(err.value)}' is not a valid ${err.kind}` }],
      isOperational: true,
    };
  }

  // Schema-level validation that bypassed Zod (e.g. a direct model write).
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      message: "Validation failed",
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
      isOperational: true,
    };
  }

  // Unique index violation.
  if (hasCode(err, 11000)) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return {
      statusCode: 409,
      message: `A record with that ${field} already exists`,
      details: [{ field, message: "Must be unique" }],
      isOperational: true,
    };
  }

  const name = (err as { name?: string })?.name;

  if (name === "JsonWebTokenError") {
    return { statusCode: 401, message: "Invalid token", isOperational: true };
  }
  if (name === "TokenExpiredError") {
    return { statusCode: 401, message: "Token has expired", isOperational: true };
  }

  // Malformed JSON body - express.json() raises a SyntaxError with .status 400.
  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    return { statusCode: 400, message: "Malformed JSON in request body", isOperational: true };
  }

  return {
    statusCode: 500,
    message: (err as Error)?.message ?? "Something went wrong",
    isOperational: false,
  };
}

/**
 * Central error handler. Must be mounted last and must keep all four
 * parameters - Express identifies error middleware by arity.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Headers already flushed: no way to change the response, hand back to
  // Express so it aborts the connection.
  if (res.headersSent) return next(err);

  const { statusCode, message, details, isOperational } = normalize(err);

  const log = (req.log ?? logger).child({ statusCode, path: req.originalUrl });
  if (statusCode >= 500) {
    log.error({ err }, "Unhandled server error");
  } else {
    log.warn({ err: (err as Error)?.message }, "Request failed");
  }

  const body: ErrorBody = {
    status: "error",
    // Never leak an internal message (driver strings, file paths) in prod.
    message: !isOperational && env.isProduction ? "Something went wrong" : message,
  };

  if (details) body.details = details;
  if (!env.isProduction && !isOperational) body.stack = (err as Error)?.stack;

  res.status(statusCode).json(body);
};

export default errorHandler;
