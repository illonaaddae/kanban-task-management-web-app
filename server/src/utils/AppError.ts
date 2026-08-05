/** One field-level problem, surfaced in the `details` array of a 400 response. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * An error we raised deliberately and whose message is safe to send to the
 * client. Anything that is NOT an AppError is treated as a bug by the error
 * handler and reported as a generic 500.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;
  public readonly details?: ErrorDetail[];

  constructor(message: string, statusCode: number, details?: ErrorDetail[]) {
    super(message);
    this.statusCode = statusCode;
    if (details?.length) this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = "You are not logged in"): AppError {
    return new AppError(message, 401);
  }

  static forbidden(message = "You do not have permission to perform this action"): AppError {
    return new AppError(message, 403);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(message, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(message, 409);
  }
}

export default AppError;
