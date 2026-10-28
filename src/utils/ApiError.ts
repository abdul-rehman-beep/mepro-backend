/**
 * Application-level error with an HTTP status code. Anything thrown that is not
 * an ApiError is treated as an unexpected 500 by the error middleware.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

const CODES_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export class ApiError extends Error {
  readonly statusCode: number;
  /**
   * Stable, machine-readable discriminator. Clients branch on this instead of
   * parsing human-readable messages, which are free to change.
   */
  readonly code: ApiErrorCode;
  readonly errors: unknown[];
  readonly isOperational: boolean;

  constructor(statusCode: number, message: string, errors: unknown[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = CODES_BY_STATUS[statusCode] ?? 'INTERNAL_ERROR';
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message = 'Bad request', errors: unknown[] = []): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required', errors: unknown[] = []): ApiError {
    return new ApiError(401, message, errors);
  }

  static forbidden(message = 'You do not have permission to perform this action', errors: unknown[] = []): ApiError {
    return new ApiError(403, message, errors);
  }

  static notFound(message = 'Resource not found', errors: unknown[] = []): ApiError {
    return new ApiError(404, message, errors);
  }

  static conflict(message = 'Resource already exists', errors: unknown[] = []): ApiError {
    return new ApiError(409, message, errors);
  }

  static unprocessable(message = 'Validation failed', errors: unknown[] = []): ApiError {
    return new ApiError(422, message, errors);
  }

  static tooMany(message = 'Too many requests', errors: unknown[] = []): ApiError {
    return new ApiError(429, message, errors);
  }

  static internal(message = 'Something went wrong', errors: unknown[] = []): ApiError {
    return new ApiError(500, message, errors);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', errors: unknown[] = []): ApiError {
    return new ApiError(503, message, errors);
  }
}
