import type { Request } from 'express';

/**
 * Reads a named route parameter as a string.
 *
 * `@types/express` 5 types `req.params` values as `string | string[]` because a
 * repeated or wildcard segment can produce an array. At runtime a named segment
 * is always a single string, so it is narrowed in one place here instead of at
 * every controller call site. Callers that also need an ObjectId should use
 * `toObjectId` from the workout service, which performs the same normalisation
 * and rejects malformed ids with a 400.
 */
export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  return '';
}
