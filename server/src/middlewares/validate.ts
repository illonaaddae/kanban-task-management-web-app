import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError, type ErrorDetail } from "../utils/AppError";

export type ValidationSource = "body" | "query" | "params";

/**
 * Validates one part of the request against a Zod schema and replaces it with
 * the parsed result, so downstream handlers get coerced, defaulted, stripped
 * data rather than raw strings.
 *
 * On failure: 400 with `details: [{ field, message }]`.
 */
export const validate = (
  schema: ZodType,
  source: ValidationSource = "body",
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        // path is empty when the whole payload is wrong (e.g. body is an
        // array) - fall back to the source name so `field` is never "".
        field: issue.path.length ? issue.path.join(".") : source,
        message: issue.message,
      }));

      return next(new AppError("Validation failed", 400, details));
    }

    if (source === "query") {
      // Express 5 defines req.query as a getter with no setter - a plain
      // assignment throws. Redefine the property instead.
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } else {
      req[source] = result.data as never;
    }

    next();
  };
};

export const validateBody = (schema: ZodType) => validate(schema, "body");
export const validateQuery = (schema: ZodType) => validate(schema, "query");
export const validateParams = (schema: ZodType) => validate(schema, "params");

export default validate;
