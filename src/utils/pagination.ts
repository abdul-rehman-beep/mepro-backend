import type { QueryFilter } from 'mongoose';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export function getPagination(query: { page?: unknown; limit?: unknown }): PaginationParams {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? DEFAULT_PAGE_SIZE);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Escapes user input so a value like `a.b` cannot be interpreted as a nested
 * MongoDB path. Used for every field interpolated into a QueryFilter.
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a case-insensitive "contains" filter for a trusted field name. */
export function containsFilter(field: string, value?: string): QueryFilter<Record<string, unknown>> {
  // A whitespace-only term is absent, not a real search: it would trim to an
  // empty $regex, which matches every document via a needless regex scan.
  const term = value?.trim();
  if (!term) return {};
  return { [field]: { $regex: escapeRegExp(term), $options: 'i' } } as QueryFilter<
    Record<string, unknown>
  >;
}

export function toIdArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  // `null` and `''` are reachable from a JSON body, and Number() turns both
  // into 0, which would silently clamp an omitted value to the minimum
  // instead of using the caller's fallback.
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}
