/** Date helpers. All daily aggregates are computed in the caller's local-free UTC day
 *  so that a day boundary is identical on the server and on the device. */

export function startOfDay(input: Date | string | number = new Date()): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(input: Date | string | number = new Date()): Date {
  const date = new Date(input);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export function addDays(input: Date | string | number, days: number): Date {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function addMonths(input: Date | string | number, months: number): Date {
  const date = new Date(input);
  const targetMonth = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(targetMonth);
  // Clamp e.g. Jan 31 + 1 month to the last day of February.
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

export function differenceInDays(later: Date, earlier: Date): number {
  const a = startOfDay(later).getTime();
  const b = startOfDay(earlier).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function startOfWeek(input: Date = new Date()): Date {
  const date = startOfDay(input);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // shift so Monday is day 0
  return addDays(date, -diff);
}

export function endOfWeek(input: Date = new Date()): Date {
  return endOfDay(addDays(startOfWeek(input), 6));
}

export function startOfMonth(input: Date = new Date()): Date {
  const date = startOfDay(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(input: Date = new Date()): Date {
  const date = startOfDay(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** Builds an array of [start, end] UTC day boundaries for the last `days` days. */
export function dayRanges(days: number, now: Date = new Date()): Array<{ start: Date; end: Date }> {
  const count = Math.max(1, Math.min(days, 400));
  const ranges: Array<{ start: Date; end: Date }> = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addDays(startOfDay(now), -i);
    ranges.push({ start, end: endOfDay(start) });
  }
  return ranges;
}

export function isoDate(input: Date | string | number = new Date()): string {
  return new Date(input).toISOString().slice(0, 10);
}

/**
 * Number of days from `from` to `to`, counting both endpoints.
 *
 * A single day is 1, which is what streak and "days active" counters need.
 * Note this differs from {@link differenceInDays}, which counts the day
 * boundaries crossed and therefore returns 0 for two dates on the same day.
 */
export function daysBetweenInclusive(from: Date, to: Date): number {
  return Math.max(0, differenceInDays(to, from) + 1);
}
