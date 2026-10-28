import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export type RequestTarget = 'body' | 'query' | 'params';

/** Zod issue -> the `errors` array shape the API contract documents. */
function formatIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates and *replaces* the request segment with the parsed value, so
 * controllers receive coerced, stripped, correctly typed data. Unknown keys are
 * dropped by Zod object schemas, which stops mass-assignment.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        // req.query has only a getter in Express 5, so cache the parsed value and
        // expose it through a dedicated property read by controllers.
        Object.defineProperty(req, 'validatedQuery', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
          enumerable: false,
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(ApiError.unprocessable('Validation failed', formatIssues(error)));
      }
      return next(ApiError.badRequest('Malformed request'));
    }
  };
}

export function getValidatedQuery<T>(req: Request): T {
  const value = (req as Request & { validatedQuery?: unknown }).validatedQuery;
  return (value ?? {}) as T;
}

/** Express 5 passes 4 args to error middleware, which is how it is detected. */
export function isErrorHandler(handler: RequestHandler): boolean {
  return handler.length === 4;
}
