/**
 * Goal progress arithmetic.
 *
 * This is the highest-risk pure function in the codebase: a wrong sign or a
 * missing clamp shows up as a goal stuck at 0% or pinned at 100%, and it is
 * the one piece of logic the seed, the API, and the UI all depend on agreeing
 * on.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goalProgressPercent } from '../models/Goal';

describe('goalProgressPercent', () => {
  describe('counting up from a zero baseline', () => {
    it('reports 0% at the start', () => {
      assert.equal(goalProgressPercent(0, 0, 20), 0);
    });

    it('reports 50% at the halfway point', () => {
      assert.equal(goalProgressPercent(0, 10, 20), 50);
    });

    it('reports 100% at the target', () => {
      assert.equal(goalProgressPercent(0, 20, 20), 100);
    });

    it('clamps above the target instead of exceeding 100', () => {
      assert.equal(goalProgressPercent(0, 25, 20), 100);
    });

    it('clamps below the start instead of going negative', () => {
      assert.equal(goalProgressPercent(0, -5, 20), 0);
    });
  });

  describe('counting down from a non-zero baseline (weight goals)', () => {
    // The real bug this guards: a "lose 5 kg" goal from 80 kg to 75 kg must
    // read 0% at 80 kg, not 100%, and must count progress as the baseline falls.
    it('reads 0% when the value still equals the baseline', () => {
      assert.equal(goalProgressPercent(80, 80, 75), 0);
    });

    it('reads 100% when the target is reached', () => {
      assert.equal(goalProgressPercent(80, 75, 75), 0 + 100);
    });

    it('reads an intermediate value part-way down', () => {
      // (78.5 - 80) / (75 - 80) = -1.5 / -5 = 30%
      assert.equal(goalProgressPercent(80, 78.5, 75), 30);
    });

    it('does not read 100% merely for exceeding the baseline', () => {
      // The historical failure mode: dividing by the target instead of the span.
      assert.equal(goalProgressPercent(82.5, 82.5, 76), 0);
    });

    it('clamps when weight moves the wrong way', () => {
      assert.equal(goalProgressPercent(80, 85, 75), 0);
    });

    it('clamps when weight drops past the target', () => {
      assert.equal(goalProgressPercent(80, 70, 75), 100);
    });
  });

  describe('degenerate input', () => {
    it('returns 0 when baseline equals target', () => {
      assert.equal(goalProgressPercent(70, 70, 70), 0);
    });

    it('returns 0 for non-finite span', () => {
      assert.equal(goalProgressPercent(0, 0, Number.NaN), 0);
      assert.equal(goalProgressPercent(Number.POSITIVE_INFINITY, 0, 10), 0);
    });

    it('returns 0 for a non-finite current value', () => {
      assert.equal(goalProgressPercent(0, Number.NaN, 20), 0);
    });
  });

  it('always returns a whole number in 0..100', () => {
    for (const [baseline, current, target] of [
      [80, 78.5, 75],
      [0, 7, 20],
      [100, 100, 4000],
      [54, 52.4, 56],
    ]) {
      const percent = goalProgressPercent(baseline!, current!, target!);
      assert.ok(Number.isInteger(percent), `${percent} should be an integer`);
      assert.ok(percent >= 0 && percent <= 100, `${percent} should be within 0..100`);
    }
  });
});
