/**
 * Request validation.
 *
 * The goal `currentValue` default of 0 is a trap the API has to defend against:
 * a user who omits it for a weight goal would otherwise see a 0 kg starting
 * weight and a nonsense progress bar. These tests pin the contract that the
 * service layer relies on.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createFoodLogSchema,
  goalCreateSchema,
  goalUpdateSchema,
  goalProgressSchema,
  idParamSchema,
  registerSchema,
  waterLogSchema,
  workoutSessionSchema,
} from '../validators';

const parseOk = <T>(schema: { parse: (v: unknown) => T }, value: unknown): T => schema.parse(value);

describe('registerSchema', () => {
  const valid = { email: 'aarav@mepro.app', password: 'StrongPass123', name: 'Aarav' };

  it('accepts a normal registration', () => {
    assert.equal(parseOk(registerSchema, valid).email, 'aarav@mepro.app');
  });

  it('lowercases the email so lookups are case-insensitive', () => {
    assert.equal(parseOk(registerSchema, { ...valid, email: 'Aarav@MEPRO.app' }).email, 'aarav@mepro.app');
  });

  it('rejects a short password', () => {
    assert.throws(() => parseOk(registerSchema, { ...valid, password: 'short1' }));
  });

  it('rejects a malformed email', () => {
    assert.throws(() => parseOk(registerSchema, { ...valid, email: 'not-an-email' }));
  });

  it('rejects a missing field', () => {
    assert.throws(() => parseOk(registerSchema, { email: valid.email, password: valid.password }));
  });
});

describe('goalCreateSchema', () => {
  const valid = {
    title: 'Lose 5 kg',
    goalType: 'weight_loss',
    targetValue: 75,
    unit: 'kg',
  };

  it('accepts a minimal goal', () => {
    const goal = parseOk(goalCreateSchema, valid);
    assert.equal(goal.targetValue, 75);
    assert.equal(goal.source, 'manual');
  });

  // The service reads `currentValue` to seed the baseline. Defaulting it to 0
  // is only safe because the service ignores it for auto-sourced goals; the
  // default is pinned here so that contract is visible.
  it('defaults currentValue to 0 and source to manual', () => {
    const goal = parseOk(goalCreateSchema, valid);
    assert.equal(goal.currentValue, 0);
    assert.equal(goal.source, 'manual');
  });

  it('coerces numeric strings from a query-style client', () => {
    const goal = parseOk(goalCreateSchema, { ...valid, targetValue: '75', currentValue: '80' });
    assert.equal(goal.targetValue, 75);
    assert.equal(goal.currentValue, 80);
  });

  it('trims the title', () => {
    assert.equal(parseOk(goalCreateSchema, { ...valid, title: '  Lose 5 kg  ' }).title, 'Lose 5 kg');
  });

  it('rejects an empty or too-short title', () => {
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, title: '' }));
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, title: 'ab' }));
  });

  it('rejects a non-positive target', () => {
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, targetValue: 0 }));
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, targetValue: -5 }));
  });

  it('rejects an unknown goal type or source', () => {
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, goalType: 'get_rich' }));
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, source: 'telepathy' }));
  });

  // targetDate is a calendar date, not a timestamp: an ISO date-time here
  // silently loses its time component downstream.
  it('accepts a YYYY-MM-DD target date and rejects anything else', () => {
    assert.equal(
      parseOk(goalCreateSchema, { ...valid, targetDate: '2026-12-31' }).targetDate,
      '2026-12-31',
    );
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, targetDate: 'not-a-date' }));
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, targetDate: '2026-12-31T00:00:00Z' }));
    assert.throws(() => parseOk(goalCreateSchema, { ...valid, targetDate: '31/12/2026' }));
  });
});

describe('goalUpdateSchema', () => {
  it('accepts a partial update', () => {
    assert.equal(parseOk(goalUpdateSchema, { currentValue: 78 }).currentValue, 78);
  });

  it('rejects a server-owned field so a client cannot rewrite the baseline', () => {
    // Zod strips unknown keys by default rather than erroring, so assert the
    // value never reaches the service.
    const parsed = parseOk(goalUpdateSchema, { currentValue: 78, baselineValue: 1, userId: 'x' });
    assert.equal((parsed as Record<string, unknown>).baselineValue, undefined);
    assert.equal((parsed as Record<string, unknown>).userId, undefined);
  });
});

describe('goalProgressSchema', () => {
  it('accepts an absolute value or an increment', () => {
    assert.equal(parseOk(goalProgressSchema, { currentValue: 80 }).currentValue, 80);
    assert.equal(parseOk(goalProgressSchema, { increment: -0.5 }).increment, -0.5);
  });

  // An empty body used to pass validation and return 200 with an unchanged
  // goal, so a buggy client never learned its call did nothing.
  it('rejects a body with neither a value nor an increment', () => {
    assert.throws(() => parseOk(goalProgressSchema, {}));
  });
});

describe('workoutSessionSchema', () => {
  // This is the *completion* payload. Starting a session is URL-driven
  // (POST /workouts/:id/start) and takes no body, so there is no start schema.
  it('accepts a completion with a duration', () => {
    const session = parseOk(workoutSessionSchema, { durationMinutes: 30 });
    assert.equal(session.durationMinutes, 30);
  });

  it('coerces a numeric string duration', () => {
    assert.equal(parseOk(workoutSessionSchema, { durationMinutes: '45' }).durationMinutes, 45);
  });

  it('rejects a zero, negative or absurd duration', () => {
    assert.throws(() => parseOk(workoutSessionSchema, { durationMinutes: 0 }));
    assert.throws(() => parseOk(workoutSessionSchema, { durationMinutes: -5 }));
    assert.throws(() => parseOk(workoutSessionSchema, { durationMinutes: 5000 }));
  });

  it('rejects a missing duration', () => {
    assert.throws(() => parseOk(workoutSessionSchema, {}));
  });

  it('validates perceived effort and completed exercises when supplied', () => {
    const ok = parseOk(workoutSessionSchema, {
      durationMinutes: 30,
      perceivedEffort: 7,
      completedExercises: [{ exerciseOrder: 0, name: 'Squat', durationSeconds: 45 }],
    });
    assert.equal(ok.perceivedEffort, 7);
    assert.equal(ok.completedExercises?.length, 1);

    assert.throws(() => parseOk(workoutSessionSchema, { durationMinutes: 30, perceivedEffort: 11 }));
    assert.throws(() =>
      parseOk(workoutSessionSchema, { durationMinutes: 30, completedExercises: [{ exerciseOrder: 0, name: '' }] }),
    );
  });
});

describe('idParamSchema', () => {
  it('accepts a 24-character hex ObjectId', () => {
    assert.equal(parseOk(idParamSchema, { id: 'a'.repeat(24) }).id, 'a'.repeat(24));
  });

  // A malformed id must be a 400, not an unhandled cast error inside Mongoose.
  it('rejects a malformed or non-hex id', () => {
    assert.throws(() => parseOk(idParamSchema, { id: 'nope' }));
    assert.throws(() => parseOk(idParamSchema, { id: 'z'.repeat(24) }));
    assert.throws(() => parseOk(idParamSchema, { id: '123' }));
  });
});

describe('createFoodLogSchema', () => {
  const valid = { foodId: 'a1b2c3d4e5f60718293a4b5c', mealType: 'lunch', grams: 150 };

  it('accepts an entry given in grams', () => {
    assert.equal(parseOk(createFoodLogSchema, valid).grams, 150);
  });

  it('accepts an entry given in servings', () => {
    assert.equal(parseOk(createFoodLogSchema, { ...valid, grams: undefined, servings: 2 }).servings, 2);
  });

  it('rejects a negative or zero amount', () => {
    assert.throws(() => parseOk(createFoodLogSchema, { ...valid, grams: -1 }));
    assert.throws(() => parseOk(createFoodLogSchema, { ...valid, grams: 0 }));
  });

  it('rejects a malformed food id', () => {
    assert.throws(() => parseOk(createFoodLogSchema, { ...valid, foodId: 'nope' }));
  });

  it('rejects an unknown meal type', () => {
    assert.throws(() => parseOk(createFoodLogSchema, { ...valid, mealType: 'brunch' }));
  });

  // Without a quantity the service has nothing to compute calories from, so the
  // request must fail rather than log a meaningless entry.
  it('requires some quantity', () => {
    assert.throws(() => parseOk(createFoodLogSchema, { foodId: valid.foodId, mealType: 'lunch' }));
  });
});

describe('waterLogSchema', () => {
  it('accepts a normal amount', () => {
    assert.equal(parseOk(waterLogSchema, { amountMl: 500 }).amountMl, 500);
  });

  it('rejects a negative amount', () => {
    assert.throws(() => parseOk(waterLogSchema, { amountMl: -100 }));
  });

  it('rejects an implausibly large single entry', () => {
    assert.throws(() => parseOk(waterLogSchema, { amountMl: 10000 }));
  });
});
