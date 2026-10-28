/**
 * Generates docs/API.md from the route definitions so the reference cannot
 * drift from the code. Run with `npm run docs`.
 *
 * Endpoint purposes live in SUMMARY below. Anything not listed still appears in
 * the table, so a new route is documented (if tersely) as soon as it is added.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const OUT = path.join(ROOT, 'docs', 'API.md');

/** Must match the mounts in src/app.ts. */
const MOUNTS: Record<string, string> = {
  auth: '/auth',
  user: '/users',
  dashboard: '/dashboard',
  workout: '/workouts',
  yoga: '/yoga',
  nutrition: '/nutrition',
  food: '/foods',
  hydration: '/hydration',
  progress: '/progress',
  goal: '/goals',
  achievement: '/achievements',
  ai: '/ai',
  notification: '/notifications',
  community: '/community',
};

const GROUP_TITLES: Record<string, string> = {
  '/auth': 'Authentication',
  '/users': 'User & profile',
  '/dashboard': 'Dashboard',
  '/workouts': 'Workouts',
  '/yoga': 'Yoga',
  '/nutrition': 'Nutrition',
  '/foods': 'Food catalogue & logs (legacy alias)',
  '/hydration': 'Hydration',
  '/progress': 'Progress',
  '/goals': 'Goals',
  '/achievements': 'Achievements',
  '/ai': 'AI',
  '/notifications': 'Notifications',
  '/community': 'Community',
};

const GROUP_NOTES: Record<string, string> = {
  '/foods': 'Superseded by `/api/nutrition/*`, which is what the mobile client uses. Kept for older builds.',
};

const SUMMARY: Record<string, string> = {
  // auth
  'POST /api/auth/register': 'Create an account and return a token pair',
  'POST /api/auth/login': 'Exchange credentials for a token pair',
  'POST /api/auth/refresh': 'Rotate a refresh token; replaying an old one revokes the family',
  'POST /api/auth/logout': 'Revoke the current refresh token (works on an expired access token)',
  'GET /api/auth/me': 'Current user profile and derived targets',
  'POST /api/auth/change-password': 'Change password and revoke all sessions',
  // users
  'GET /api/users/profile': 'Profile plus computed BMI, calorie and water targets',
  'PATCH /api/users/profile': 'Update profile fields; recomputes derived targets',
  'GET /api/users/onboarding': 'Read onboarding progress and suggested next step',
  'POST /api/users/onboarding': 'Complete or advance onboarding',
  'PATCH /api/users/avatar': 'Set or clear the avatar',
  'GET /api/users/notification-settings': 'Per-category notification preferences',
  'PATCH /api/users/notification-settings': 'Update notification preferences',
  'POST /api/users/device-token': 'Register a push token',
  'DELETE /api/users/device-token': 'Remove a push token',
  'GET /api/users/account': 'Export account data',
  'DELETE /api/users/account': 'Delete the account and cascade every owned document',
  'GET /api/users/bmi': 'BMI for a supplied or recorded weight',
  'POST /api/users/bmi': 'Compute BMI without persisting',
  'POST /api/users/weight': 'Log a weight and refresh weight-sourced goals',
  'POST /api/users/reminders/seed': 'Populate reminder schedule entries',
  // dashboard
  'GET /api/dashboard': 'All home-screen sections in one request',
  // workouts
  'GET /api/workouts': 'Browse the workout catalogue',
  'GET /api/workouts/history': 'Completed and in-progress sessions',
  'GET /api/workouts/stats': 'Totals, streak and volume',
  'GET /api/workouts/session/active': 'The in-progress session, if any',
  'GET /api/workouts/:id': 'One workout with its exercises',
  'POST /api/workouts/:id/start': 'Start a session, or resume the existing one',
  'POST /api/workouts/:id/complete': 'Complete a session, award XP and update goals',
  'GET /api/workouts/sessions/:id': 'Fetch one session',
  'DELETE /api/workouts/sessions/:id': 'Abandon an in-progress session',
  // yoga
  'GET /api/yoga': 'Browse the yoga catalogue',
  'GET /api/yoga/:id': 'One routine with its asanas',
  'POST /api/yoga/:id/complete': 'Complete a routine and update yoga counters',
  // nutrition
  'GET /api/nutrition/foods': 'Food catalogue; supports diet, allergen and nutrition filters',
  'GET /api/nutrition/foods/categories': 'Catalogue categories and counts',
  'GET /api/nutrition/foods/:id': 'One food with its nutrition per 100 g',
  'GET /api/nutrition/food-logs': 'Food log entries',
  'POST /api/nutrition/food-logs': 'Log a food; recomputes the day totals',
  'PATCH /api/nutrition/food-logs/:id': 'Update a logged food',
  'DELETE /api/nutrition/food-logs/:id': 'Delete a logged food',
  'GET /api/nutrition/today': 'Today\'s totals against targets',
  'GET /api/nutrition/history': 'Daily nutrition totals over a date range',
  'GET /api/nutrition/meals/today': 'Today\'s entries grouped by meal',
  'GET /api/nutrition/meals': 'Meal groupings for a chosen day',
  'POST /api/nutrition/meals/generate': 'Generate a meal plan for a day',
  // foods
  'GET /api/foods': 'Food catalogue (alias of `/api/nutrition/foods`)',
  'GET /api/foods/categories': 'Catalogue categories (alias)',
  'GET /api/foods/search': 'Food search (alias)',
  'GET /api/foods/:id': 'One food (alias)',
  'GET /api/foods/logs/all': 'All food logs (alias)',
  'POST /api/foods/logs': 'Log a food (alias)',
  'PATCH /api/foods/logs/:id': 'Update a logged food (alias)',
  'DELETE /api/foods/logs/:id': 'Delete a logged food (alias)',
  // hydration
  'GET /api/hydration/today': 'Today\'s water total against target',
  'POST /api/hydration/log': 'Log water',
  'GET /api/hydration/history': 'Daily water totals',
  'DELETE /api/hydration/log/:id': 'Delete a water entry',
  // progress
  'GET /api/progress': 'Weight, activity and adherence summary',
  'GET /api/progress/daily': 'Daily series for charts',
  'GET /api/progress/weekly': 'Weekly rollups',
  'GET /api/progress/monthly': 'Monthly rollups',
  'GET /api/progress/streak': 'Current and longest streaks',
  'GET /api/progress/summary': 'Compact figures for a summary card',
  'POST /api/progress/sync': 'Recompute the current day and refresh goals',
  // goals
  'GET /api/goals': 'List goals, optionally filtered by status',
  'POST /api/goals': 'Create a goal; auto-sourced goals sync immediately',
  'GET /api/goals/stats': 'Counts by status and average progress',
  'POST /api/goals/sync': 'Refresh every auto-sourced goal',
  'GET /api/goals/:id': 'One goal',
  'PATCH /api/goals/:id': 'Update editable goal fields',
  'DELETE /api/goals/:id': 'Delete a goal',
  'POST /api/goals/:id/progress': 'Set an absolute value or an increment',
  // achievements
  'GET /api/achievements': 'Achievement catalogue with unlock state',
  'GET /api/achievements/summary': 'Unlocked count and recent unlocks',
  'GET /api/achievements/stats': 'Points, level and progress to the next level',
  'POST /api/achievements/evaluate': 'Re-evaluate unlocks (idempotent)',
  // ai
  'GET /api/ai/status': 'Whether the local model is loaded and which one',
  'GET /api/ai/suggested-questions': 'Starter prompts for the assistant',
  'POST /api/ai/warmup': 'Load the model ahead of the first request',
  'GET /api/ai/recommendations': 'Recommendations for the current profile',
  'GET /api/ai/recommendations/history': 'Previously served recommendations',
  'DELETE /api/ai/recommendations/cache': 'Clear the cached recommendations',
  'POST /api/ai/recommendations/:id/feedback': 'Record helpful or not helpful',
  'POST /api/ai/assistant': 'Ask the assistant; unsafe medical asks are screened',
  'GET /api/ai/assistant/conversations': 'Past assistant conversations',
  'GET /api/ai/assistant/conversations/:id': 'One conversation with its messages',
  'DELETE /api/ai/assistant/conversations/:id': 'Delete a conversation',
  // notifications
  'GET /api/notifications': 'Notification feed',
  'GET /api/notifications/unread-count': 'Unread badge count',
  'PATCH /api/notifications/:id/read': 'Mark one notification read',
  'PATCH /api/notifications/read-all': 'Mark every notification read',
  'DELETE /api/notifications/:id': 'Delete one notification',
  'DELETE /api/notifications': 'Clear the whole notification list',
  // community
  'GET /api/community': 'Community feed',
  'POST /api/community': 'Create a post',
  'GET /api/community/mine': 'The current user\'s posts',
  'GET /api/community/:id': 'One post with its comments',
  'DELETE /api/community/:id': 'Delete an owned post',
  'POST /api/community/:id/like': 'Toggle a like (idempotent)',
  'GET /api/community/:id/comments': 'Comments on a post',
  'POST /api/community/:id/comments': 'Add a comment',
  'POST /api/community/:id/report': 'Report a post',
};

const PUBLIC_ROUTES = new Set([
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/logout',
]);

interface Endpoint {
  method: string;
  path: string;
  group: string;
}

function collect(): Endpoint[] {
  const endpoints: Endpoint[] = [];
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.routes.ts'))) {
    const key = file.replace('.routes.ts', '');
    const prefix = MOUNTS[key];
    if (!prefix) throw new Error(`Route file ${file} is not mounted in src/app.ts`);
    // Collapse whitespace so multi-line declarations are matchable.
    const flat = readFileSync(path.join(ROUTES_DIR, file), 'utf8').replace(/\s+/g, ' ');
    const pattern = /router\.(get|post|patch|put|delete)\(\s*'([^']+)'/g;
    for (const match of flat.matchAll(pattern)) {
      const subPath = match[2] as string;
      endpoints.push({
        method: (match[1] as string).toUpperCase(),
        path: `/api${prefix}${subPath === '/' ? '' : subPath}`,
        group: prefix,
      });
    }
  }
  return endpoints;
}

function build(): string {
  const endpoints = collect();
  const undocumented = endpoints.filter((e) => !SUMMARY[`${e.method} ${e.path}`]);
  if (undocumented.length > 0) {
    // Not fatal, but worth surfacing so summaries keep pace with the routes.
    console.warn(`Warning: no summary for ${undocumented.length} endpoint(s):`);
    for (const e of undocumented) console.warn(`  ${e.method} ${e.path}`);
  }

  const byGroup = new Map<string, Endpoint[]>();
  for (const e of endpoints) {
    const list = byGroup.get(e.group) ?? [];
    list.push(e);
    byGroup.set(e.group, list);
  }

  const lines: string[] = [];
  lines.push('# API reference');
  lines.push('');
  lines.push('> Generated by `npm run docs` from the route definitions. Edit `scripts/gen-api-docs.ts`, not this file.');
  lines.push('');
  lines.push(`Base URL: \`http://localhost:5000\` — ${endpoints.length} endpoints across ${byGroup.size} groups.`);
  lines.push('');
  lines.push('## Conventions');
  lines.push('');
  lines.push('Every response uses the same envelope:');
  lines.push('');
  lines.push('```json');
  lines.push('{ "success": true, "data": { }, "message": "Human readable", "errors": [] }');
  lines.push('```');
  lines.push('');
  lines.push('Failures keep the shape and add a machine-readable `code`:');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "success": false,');
  lines.push('  "message": "Goal not found",');
  lines.push('  "code": "NOT_FOUND",');
  lines.push('  "errors": []');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('| Code | HTTP | Meaning |');
  lines.push('| --- | --- | --- |');
  lines.push('| `VALIDATION_ERROR` | 400 | The request body or query failed validation; see `errors` |');
  lines.push('| `BAD_REQUEST` | 400 | The request was well formed but not allowed |');
  lines.push('| `UNAUTHORIZED` | 401 | Missing, malformed or expired access token |');
  lines.push('| `FORBIDDEN` | 403 | Authenticated, but not allowed to touch this resource |');
  lines.push('| `NOT_FOUND` | 404 | No such document, or it belongs to another user |');
  lines.push('| `CONFLICT` | 409 | Duplicate or conflicting state |');
  lines.push('| `TOO_MANY_REQUESTS` | 429 | Rate limited; `errors[0].retryAfterSeconds` says when to retry |');
  lines.push('| `INTERNAL_ERROR` | 500 | Unexpected failure; details are logged, not returned |');
  lines.push('');
  lines.push('### Authentication');
  lines.push('');
  lines.push('Send the access token as a bearer credential:');
  lines.push('');
  lines.push('```http');
  lines.push('Authorization: Bearer <accessToken>');
  lines.push('```');
  lines.push('');
  lines.push(`Only ${[...PUBLIC_ROUTES].map((r) => `\`${r.split(' ')[1]}\``).join(', ')} and \`POST /api/auth/logout\` may be called without a token. Everything else returns \`401\`.`);
  lines.push('');
  lines.push('Access tokens are short lived. Refresh with `POST /api/auth/refresh`; the response carries a new pair and the old refresh token is invalidated. Replaying an already-rotated token revokes the whole token family, which signs the user out everywhere.');
  lines.push('');
  lines.push('### Rate limits');
  lines.push('');
  lines.push('A global limiter applies to everything under `/api`, and credential endpoints have a tighter per-IP limit (20 requests per 15 minutes). `429` responses include `errors[0].retryAfterSeconds`.');
  lines.push('');
  lines.push('### Pagination');
  lines.push('');
  lines.push('List endpoints accept `page` (1-based) and `limit` (default 20, maximum 100) and return:');
  lines.push('');
  lines.push('```json');
  lines.push('{ "items": [], "meta": { "page": 1, "limit": 20, "total": 89, "totalPages": 5 } }');
  lines.push('```');
  lines.push('');
  lines.push('Malformed paging values fall back to the defaults rather than erroring. CSV list parameters (`diet`, `equipment`, `muscleGroup`, `excludeAllergens`) accept `a,b,c`.');
  lines.push('');
  lines.push('### Dates');
  lines.push('');
  lines.push('Day-level parameters (`day`, `targetDate`, `startDate`, `endDate`) are calendar dates in `YYYY-MM-DD` and are interpreted in UTC, so a day boundary is identical on the server and on the device.');
  lines.push('');

  for (const group of [...byGroup.keys()].sort()) {
    const list = byGroup.get(group) as Endpoint[];
    lines.push(`## ${GROUP_TITLES[group] ?? group}`);
    lines.push('');
    if (GROUP_NOTES[group]) {
      lines.push(GROUP_NOTES[group]);
      lines.push('');
    }
    lines.push('| Method | Path | Auth | Purpose |');
    lines.push('| --- | --- | --- | --- |');
    for (const e of list.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))) {
      const key = `${e.method} ${e.path}`;
      const auth = PUBLIC_ROUTES.has(key) ? 'no' : 'yes';
      lines.push(`| \`${e.method}\` | \`${e.path}\` | ${auth} | ${SUMMARY[key] ?? '—'} |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

writeFileSync(OUT, build(), 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUT)}`);
