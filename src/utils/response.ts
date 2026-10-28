import type { Response } from 'express';
import { env } from '../config/env';

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  message: string;
}

/**
 * Every failure uses this envelope:
 *   { success: false, message, code, errors }
 * `code` is stable for clients to branch on; `message` is for humans and may be
 * reworded; `errors` carries per-field detail for form rendering.
 */
export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  errors: unknown[];
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginatedMeta;
}

export function sendSuccess<T>(res: Response, data: T, message = 'Success', statusCode = 200): Response {
  const body: ApiSuccessBody<T> = { success: true, data, message };
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Success',
): Response {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  const data: PaginatedData<T> = {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
  return sendSuccess(res, data, message);
}

/** Wraps async route handlers so rejected promises reach the error middleware. */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

export const SERVER_VERSION = '1.0.0';
export const API_PREFIX = '/api';
export const SUPPORTED_CLIENT_VERSIONS = ['1.0.0'];
export const MIN_CLIENT_VERSION = '1.0.0';
export const IS_PUBLIC_ENV = !env.isProduction;
