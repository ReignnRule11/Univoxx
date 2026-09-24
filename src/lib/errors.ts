export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown, expose = true) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
}

export function unauthorized(message = "Authentication required"): AppError {
  return new AppError(401, ERROR_CODES.UNAUTHORIZED, message);
}

export function forbidden(message = "Insufficient permissions"): AppError {
  return new AppError(403, ERROR_CODES.FORBIDDEN, message);
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, ERROR_CODES.NOT_FOUND, message);
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, ERROR_CODES.CONFLICT, message, details);
}

export function rateLimited(message = "Too many requests"): AppError {
  return new AppError(429, ERROR_CODES.RATE_LIMITED, message);
}

export function notImplemented(message: string): AppError {
  return new AppError(501, ERROR_CODES.NOT_IMPLEMENTED, message);
}

export function serviceUnavailable(message: string): AppError {
  return new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, message);
}

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export function toErrorBody(error: unknown, exposeInternal: boolean): { status: number; body: ErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: exposeInternal && error instanceof Error ? error.message : "An unexpected error occurred",
      },
    },
  };
}
