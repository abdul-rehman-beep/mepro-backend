/**
 * Pagination helpers and the regex escaping that guards every interpolated
 * MongoDB filter.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampNumber,
  containsFilter,
  escapeRegExp,
  getPagination,
  toIdArray,
} from '../utils/pagination';

describe('getPagination', () => {
  it('defaults to page 1 with the default page size', () => {
    const { page, limit, skip } = getPagination({});
    assert.equal(page, 1);
    assert.equal(limit, DEFAULT_PAGE_SIZE);
    assert.equal(skip, 0);
  });

  it('computes skip from the requested page', () => {
    assert.equal(getPagination({ page: '3', limit: '10' }).skip, 20);
  });

  it('caps the limit so a client cannot request the whole collection', () => {
    assert.equal(getPagination({ limit: '100000' }).limit, MAX_PAGE_SIZE);
    assert.equal(getPagination({ limit: 0 }).limit, DEFAULT_PAGE_SIZE);
  });

  // Untrusted query strings must never produce NaN: it silently becomes a
  // Mongo skip and returns an empty page instead of an error.
  it('falls back to defaults for garbage input', () => {
    for (const query of [{ page: 'abc' }, { page: '-5' }, { page: {} }, { limit: 'abc' }, { limit: '-1' }]) {
      const { page, limit, skip } = getPagination(query as Record<string, unknown>);
      assert.equal(page, 1, `page for ${JSON.stringify(query)}`);
      assert.equal(limit, DEFAULT_PAGE_SIZE, `limit for ${JSON.stringify(query)}`);
      assert.equal(skip, 0);
      assert.ok(Number.isFinite(skip));
    }
  });

  it('floors a fractional page or limit', () => {
    assert.equal(getPagination({ page: '2.9' }).page, 2);
    assert.equal(getPagination({ limit: '10.9' }).limit, 10);
  });

  it('treats a nullish value as absent', () => {
    assert.equal(getPagination({ page: undefined, limit: undefined }).page, 1);
  });
});

describe('escapeRegExp', () => {
  it('leaves plain text untouched', () => {
    assert.equal(escapeRegExp('yoga'), 'yoga');
  });

  // A user searching for "a.b" must not match "axb": unescaped dots act as
  // wildcards in MongoDB $regex.
  it('escapes the dot so it cannot act as a wildcard', () => {
    const escaped = escapeRegExp('a.b');
    assert.notEqual(escaped, 'a.b');
    assert.equal(new RegExp(escaped).test('a.b'), true);
    assert.equal(new RegExp(escaped).test('axb'), false);
  });

  it('escapes every regex metacharacter', () => {
    for (const char of ['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']) {
      assert.equal(escapeRegExp(char), `\\${char}`, `failed to escape ${char}`);
    }
  });

  it('neutralises an injection attempt that would otherwise match everything', () => {
    // ".*" would match every document if passed through unescaped.
    const filter = containsFilter('name', '.*');
    const value = (filter.name as { $regex: string }).$regex;
    assert.equal(new RegExp(value).test('anything'), false);
  });
});

describe('containsFilter', () => {
  it('returns an empty filter for a missing value', () => {
    assert.deepEqual(containsFilter('name', undefined), {});
    assert.deepEqual(containsFilter('name', ''), {});
    assert.deepEqual(containsFilter('name', '   '), {});
  });

  it('builds a case-insensitive filter on the given field', () => {
    const filter = containsFilter('name', 'Yoga') as { name: { $regex: string; $options: string } };
    assert.equal(filter.name.$options, 'i');
    assert.equal(new RegExp(filter.name.$regex, 'i').test('gentle yoga flow'), true);
  });
});

describe('toIdArray', () => {
  it('accepts a comma-separated string', () => {
    assert.deepEqual(toIdArray('a, b ,c'), ['a', 'b', 'c']);
  });

  it('accepts an array', () => {
    assert.deepEqual(toIdArray(['a', 'b']), ['a', 'b']);
  });

  it('returns an empty array for anything else', () => {
    assert.deepEqual(toIdArray(undefined), []);
    assert.deepEqual(toIdArray(42), []);
    assert.deepEqual(toIdArray(''), []);
  });
});

describe('clampNumber', () => {
  it('keeps a value inside the range', () => {
    assert.equal(clampNumber(5, 0, 10, 3), 5);
    assert.equal(clampNumber(-5, 0, 10, 3), 0);
    assert.equal(clampNumber(50, 0, 10, 3), 10);
  });

  it('returns the fallback for unusable input', () => {
    assert.equal(clampNumber('abc', 0, 10, 3), 3);
    assert.equal(clampNumber(undefined, 0, 10, 3), 3);
    assert.equal(clampNumber(null, 0, 10, 3), 3);
    assert.equal(clampNumber(Number.NaN, 0, 10, 3), 3);
  });

  it('parses a numeric string', () => {
    assert.equal(clampNumber('7', 0, 10, 3), 7);
  });
});
