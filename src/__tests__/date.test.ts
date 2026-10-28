/**
 * Date helpers.
 *
 * Everything here works in UTC on purpose: a "day" must be the same 24-hour
 * window on the server and on a device in any timezone, otherwise a log made
 * at 23:30 local time lands in the wrong bucket.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  addMonths,
  dayRanges,
  daysBetweenInclusive,
  differenceInDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isoDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../utils/date';

const d = (iso: string) => new Date(iso);

describe('startOfDay / endOfDay', () => {
  it('truncates to UTC midnight', () => {
    assert.equal(startOfDay(d('2026-03-15T13:45:12.500Z')).toISOString(), '2026-03-15T00:00:00.000Z');
  });

  it('ends at the last millisecond of the UTC day', () => {
    assert.equal(endOfDay(d('2026-03-15T13:45:12.500Z')).toISOString(), '2026-03-15T23:59:59.999Z');
  });

  it('spans a whole day when paired', () => {
    const start = startOfDay(d('2026-03-15T13:45:00Z'));
    const end = endOfDay(start);
    assert.equal(end.getTime() - start.getTime(), 86_399_999);
  });
});

describe('addDays', () => {
  it('moves forward and backward', () => {
    assert.equal(isoDate(addDays(d('2026-03-15T12:00:00Z'), 1)), '2026-03-16');
    assert.equal(isoDate(addDays(d('2026-03-15T12:00:00Z'), -1)), '2026-03-14');
    assert.equal(isoDate(addDays(d('2026-03-15T12:00:00Z'), 0)), '2026-03-15');
  });

  it('crosses a month boundary', () => {
    assert.equal(isoDate(addDays(d('2026-01-31T00:00:00Z'), 1)), '2026-02-01');
  });

  it('crosses a leap day', () => {
    assert.equal(isoDate(addDays(d('2028-02-28T00:00:00Z'), 1)), '2028-02-29');
  });
});

describe('addMonths', () => {
  it('adds a month', () => {
    assert.equal(isoDate(addMonths(d('2026-01-15T00:00:00Z'), 1)), '2026-02-15');
  });

  // Without clamping, Jan 31 + 1 month overflows into March.
  it('clamps to the last valid day of a shorter month', () => {
    assert.equal(isoDate(addMonths(d('2026-01-31T00:00:00Z'), 1)), '2026-02-28');
  });

  it('clamps into a leap year February correctly', () => {
    assert.equal(isoDate(addMonths(d('2028-01-31T00:00:00Z'), 1)), '2028-02-29');
  });

  it('handles a negative offset', () => {
    assert.equal(isoDate(addMonths(d('2026-03-31T00:00:00Z'), -1)), '2026-02-28');
  });

  it('crosses a year boundary', () => {
    assert.equal(isoDate(addMonths(d('2026-12-15T00:00:00Z'), 1)), '2027-01-15');
  });
});

describe('differenceInDays', () => {
  it('returns 0 within the same UTC day', () => {
    assert.equal(differenceInDays(d('2026-03-15T01:00:00Z'), d('2026-03-15T23:00:00Z')), 0);
  });

  it('counts day boundaries crossed', () => {
    assert.equal(differenceInDays(d('2026-03-16T00:00:00Z'), d('2026-03-15T23:59:59Z')), 1);
    assert.equal(differenceInDays(d('2026-03-20T00:00:00Z'), d('2026-03-15T00:00:00Z')), 5);
  });

  it('is negative when the dates are reversed', () => {
    assert.equal(differenceInDays(d('2026-03-15T00:00:00Z'), d('2026-03-20T00:00:00Z')), -5);
  });
});

describe('daysBetweenInclusive', () => {
  // The name promises inclusive counting, which a streak counter depends on.
  it('counts a single day as 1', () => {
    assert.equal(daysBetweenInclusive(d('2026-03-15T00:00:00Z'), d('2026-03-15T09:00:00Z')), 1);
  });

  it('counts both endpoints', () => {
    assert.equal(daysBetweenInclusive(d('2026-03-15T00:00:00Z'), d('2026-03-20T00:00:00Z')), 6);
  });

  it('never returns a negative count for reversed dates', () => {
    assert.equal(daysBetweenInclusive(d('2026-03-20T00:00:00Z'), d('2026-03-15T00:00:00Z')), 0);
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    assert.equal(isSameDay(d('2026-03-15T00:00:00Z'), d('2026-03-15T23:59:59.999Z')), true);
  });

  it('separates adjacent days', () => {
    assert.equal(isSameDay(d('2026-03-15T23:59:59Z'), d('2026-03-16T00:00:00Z')), false);
  });
});

describe('startOfWeek / endOfWeek', () => {
  // Monday is day 0 so a week matches the ISO convention.
  it('starts on Monday', () => {
    for (const day of ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22']) {
      const start = startOfWeek(d(`${day}T10:00:00Z`));
      assert.equal(start.getUTCDay(), 1, `${day} should map to a Monday`);
      assert.equal(isoDate(start), '2026-03-16');
    }
  });

  it('ends on the following Sunday', () => {
    assert.equal(isoDate(endOfWeek(d('2026-03-18T10:00:00Z'))), '2026-03-22');
  });

  it('covers exactly seven days', () => {
    const start = startOfWeek(d('2026-03-18T10:00:00Z'));
    assert.equal(Math.round((endOfWeek(d('2026-03-18T10:00:00Z')).getTime() - start.getTime()) / 86_400_000), 7);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('bounds the first day', () => {
    assert.equal(startOfMonth(d('2026-03-18T10:00:00Z')).toISOString(), '2026-03-01T00:00:00.000Z');
  });

  it('bounds the last day, including February in a leap year', () => {
    assert.equal(isoDate(endOfMonth(d('2026-02-10T00:00:00Z'))), '2026-02-28');
    assert.equal(isoDate(endOfMonth(d('2028-02-10T00:00:00Z'))), '2028-02-29');
    assert.equal(isoDate(endOfMonth(d('2026-04-10T00:00:00Z'))), '2026-04-30');
  });
});

describe('dayRanges', () => {
  it('returns the requested number of day buckets', () => {
    assert.equal(dayRanges(7, d('2026-03-15T10:00:00Z')).length, 7);
  });

  it('ends on today and walks backwards', () => {
    const ranges = dayRanges(3, d('2026-03-15T10:00:00Z'));
    assert.equal(isoDate(ranges[2]!.start), '2026-03-15');
    assert.equal(isoDate(ranges[1]!.start), '2026-03-14');
    assert.equal(isoDate(ranges[0]!.start), '2026-03-13');
  });

  it('produces contiguous, non-overlapping ranges, oldest first', () => {
    const ranges = dayRanges(5, d('2026-03-15T10:00:00Z'));
    for (let i = 1; i < ranges.length; i += 1) {
      assert.equal(ranges[i]!.start.getTime(), ranges[i - 1]!.end.getTime() + 1);
    }
  });

  // A client could ask for years of history; the helper must bound the work.
  it('clamps an unreasonable range', () => {
    assert.equal(dayRanges(0, d('2026-03-15T00:00:00Z')).length, 1);
    assert.ok(dayRanges(100000, d('2026-03-15T00:00:00Z')).length <= 400);
  });
});

describe('isoDate', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    assert.equal(isoDate(d('2026-03-15T23:59:59Z')), '2026-03-15');
  });

  it('accepts an ISO string', () => {
    assert.equal(isoDate('2026-03-15T00:00:00.000Z'), '2026-03-15');
  });
});
