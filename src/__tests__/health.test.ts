/**
 * Health metric calculations.
 *
 * These numbers are shown to users as advice, so the boundaries matter: BMI
 * category cut-offs, the floors that stop a bad profile producing a dangerous
 * calorie target, and monotonicity (more activity must never mean fewer
 * calories).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyGoalAdjustment,
  bmiCategory,
  calculateBmi,
  calculateBmr,
  calculateCalorieTarget,
  calculateCaloriesBurned,
  calculateMacros,
  calculateTdee,
  calculateWaterTarget,
  clamp,
  computeBmi,
  round1,
  round,
  type ProfileMetrics,
} from '../utils/health';
import type { GoalType } from '../types/enums';

const base: ProfileMetrics = {
  heightCm: 175,
  weightKg: 75,
  age: 30,
  gender: 'male',
  activityLevel: 'moderate',
};

describe('calculateBmi', () => {
  it('computes BMI from weight and height', () => {
    // 75 / 1.75^2 = 24.49 -> 24.5
    assert.equal(calculateBmi(75, 175), 24.5);
  });

  it('rounds to one decimal place', () => {
    assert.equal(calculateBmi(70, 180), 21.6);
  });

  it('returns 0 rather than NaN for impossible input', () => {
    assert.equal(calculateBmi(0, 175), 0);
    assert.equal(calculateBmi(75, 0), 0);
    assert.equal(calculateBmi(-5, 175), 0);
  });
});

describe('bmiCategory', () => {
  it('classifies across the WHO cut-offs', () => {
    assert.equal(bmiCategory(17), 'Underweight');
    assert.equal(bmiCategory(18.4), 'Underweight');
    assert.equal(bmiCategory(18.5), 'Healthy weight');
    assert.equal(bmiCategory(19), 'Healthy weight');
    assert.equal(bmiCategory(24.9), 'Healthy weight');
    assert.equal(bmiCategory(25), 'Overweight');
    assert.equal(bmiCategory(29.9), 'Overweight');
    assert.equal(bmiCategory(30), 'Obesity');
    assert.equal(bmiCategory(40), 'Obesity');
  });
});

describe('computeBmi', () => {
  it('returns the value, category, healthy range and a disclaimer', () => {
    const result = computeBmi(75, 175);
    assert.equal(result.bmi, 24.5);
    assert.equal(result.category, 'Healthy weight');
    assert.ok(result.healthyRange.min < result.healthyRange.max);
    // The disclaimer is a product requirement: never present BMI as a diagnosis.
    assert.match(result.disclaimer, /not medical advice|consult/i);
  });
});

describe('calculateBmr', () => {
  it('uses the Mifflin-St Jeor equation for men', () => {
    // 10*75 + 6.25*175 - 5*30 + 5 = 750 + 1093.75 - 150 + 5 = 1698.75
    assert.equal(calculateBmr(base), 1699);
  });

  it('uses the -161 constant for women', () => {
    assert.equal(calculateBmr({ ...base, gender: 'female' }), 1533);
    assert.equal(calculateBmr({ ...base, gender: 'other' }), 1616);
  });

  it('decreases with age, per the -5 x age term', () => {
    const younger = calculateBmr({ ...base, age: 25 });
    const older = calculateBmr({ ...base, age: 55 });
    assert.ok(older < younger, 'BMR should fall as age rises');
    assert.equal(younger - older, 150);
  });
});

describe('calculateTdee', () => {
  it('scales with activity level', () => {
    const sedentary = calculateTdee({ ...base, activityLevel: 'sedentary' });
    const active = calculateTdee({ ...base, activityLevel: 'active' });
    const veryActive = calculateTdee({ ...base, activityLevel: 'very_active' });
    assert.ok(sedentary < active, 'active should exceed sedentary');
    assert.ok(active < veryActive, 'very_active should exceed active');
  });
});

describe('applyGoalAdjustment', () => {
  it('creates a deficit for weight loss', () => {
    const maintenance = 2500;
    assert.ok(applyGoalAdjustment(maintenance, ['weight_loss']) < maintenance);
  });

  it('creates a surplus for weight and muscle gain', () => {
    const maintenance = 2500;
    assert.ok(applyGoalAdjustment(maintenance, ['weight_gain']) > maintenance);
    assert.ok(applyGoalAdjustment(maintenance, ['muscle_gain']) > maintenance);
  });

  it('leaves maintenance alone with no goals', () => {
    assert.equal(applyGoalAdjustment(2500, []), 2500);

    // A maintenance target below the floor is clamped up even with no goals.
    // This is the regression guard: the no-goal branch used to return early
    // and skip the guardrail entirely.
    assert.equal(applyGoalAdjustment(900, []), 1200);
    assert.equal(applyGoalAdjustment(99999, []), 5000);
  });

  it('does not stack deficits when several goals are combined', () => {
    // A user with both weight_loss and general_fitness must not end up with a
    // target below the safe floor.
    const target = applyGoalAdjustment(2000, ['weight_loss', 'general_fitness']);
    assert.ok(target >= 1200, `target ${target} fell below the safe floor`);
  });
});

describe('calculateCalorieTarget', () => {
  it('never returns an unsafe target for a minimal profile', () => {
    // A 13-year-old at 25 kg is the worst realistic input; the result must stay
    // above a safe floor rather than going negative or tiny.
    const target = calculateCalorieTarget({
      heightCm: 140,
      weightKg: 30,
      age: 13,
      gender: 'female',
      activityLevel: 'sedentary',
    });
    assert.ok(target >= 1200, `target ${target} is below the 1200 kcal floor`);
    assert.equal(target, 1200);
  });

  it('is monotonic in weight', () => {
    const light = calculateCalorieTarget({ ...base, weightKg: 60 });
    const heavy = calculateCalorieTarget({ ...base, weightKg: 90 });
    assert.ok(heavy > light);
  });

  it('stays within a plausible range for an average adult', () => {
    const target = calculateCalorieTarget(base);
    assert.ok(target > 1500 && target < 3500, `unexpected target ${target}`);
  });
});

describe('calculateWaterTarget', () => {
  it('scales with body weight', () => {
    assert.ok(calculateWaterTarget(90) > calculateWaterTarget(60));
  });

  it('adds for higher activity levels', () => {
    assert.ok(
      calculateWaterTarget(70, 'very_active') > calculateWaterTarget(70, 'sedentary'),
    );
  });

  it('adds for extra training minutes', () => {
    assert.ok(calculateWaterTarget(70, 'moderate', 60) > calculateWaterTarget(70, 'moderate', 0));
  });

  it('never drops below the 1500 ml floor', () => {
    assert.ok(calculateWaterTarget(25) >= 1500);
  });

  it('returns the default for impossible weight', () => {
    assert.equal(calculateWaterTarget(0), 2000);
  });

  it('rounds to a whole hundred millilitres', () => {
    assert.equal(calculateWaterTarget(70) % 100, 0);
  });
});

describe('calculateCaloriesBurned', () => {
  it('scales with duration', () => {
    const short = calculateCaloriesBurned({
      category: 'cardio',
      minutes: 10,
      weightKg: 70,
      fitnessLevel: 'beginner',
    });
    const long = calculateCaloriesBurned({
      category: 'cardio',
      minutes: 60,
      weightKg: 70,
      fitnessLevel: 'beginner',
    });
    assert.ok(long > short * 5, '6x the time should burn far more than 6x');
  });

  it('scales with body weight', () => {
    const light = calculateCaloriesBurned({
      category: 'strength',
      minutes: 30,
      weightKg: 55,
      fitnessLevel: 'intermediate',
    });
    const heavy = calculateCaloriesBurned({
      category: 'strength',
      minutes: 30,
      weightKg: 95,
      fitnessLevel: 'intermediate',
    });
    assert.ok(heavy > light);
  });

  it('ranks a HIIT session above a mobility session', () => {
    const hiit = calculateCaloriesBurned({
      category: 'hiit',
      minutes: 30,
      weightKg: 70,
      fitnessLevel: 'intermediate',
    });
    const mobility = calculateCaloriesBurned({
      category: 'mobility',
      minutes: 30,
      weightKg: 70,
      fitnessLevel: 'intermediate',
    });
    assert.ok(hiit > mobility);
  });

  it('returns 0 rather than NaN for zero minutes', () => {
    assert.equal(
      calculateCaloriesBurned({ category: 'yoga', minutes: 0, weightKg: 70, fitnessLevel: 'beginner' }),
      0,
    );
  });
});

describe('calculateMacros', () => {
  const caloriesFrom = (m: ReturnType<typeof calculateMacros>) =>
    m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;

  it('stays close to the calorie target instead of overshooting it', () => {
    // Regression guard: fat used to be derived from the whole target, so
    // protein + fat alone could exceed the target and carbs clamped to 0
    // (2500 kcal at 80 kg produced 128 g protein + 694 g fat = 5472 kcal).
    for (const target of [1200, 1800, 2500, 3200, 5000]) {
      for (const weightKg of [50, 80, 110]) {
        for (const goals of [[], ['weight_loss'], ['muscle_gain']] as GoalType[][]) {
          const macros = calculateMacros(target, goals, weightKg);
          const total = caloriesFrom(macros);
          assert.ok(
            Math.abs(total - target) <= 15,
            `macros for ${target} kcal / ${weightKg} kg / ${goals.join() || 'none'} summed to ${total}`,
          );
        }
      }
    }
  });

  it('never returns a negative gram value', () => {
    const macros = calculateMacros(1200, ['weight_loss'], 150);
    assert.ok(macros.proteinG >= 0 && macros.carbsG >= 0 && macros.fatG >= 0);
  });

  it('anchors protein to body weight', () => {
    assert.equal(calculateMacros(2500, [], 80).proteinG, 112);
    assert.equal(calculateMacros(2500, ['weight_loss'], 80).proteinG, 128);
    assert.equal(calculateMacros(2500, ['muscle_gain'], 80).proteinG, 144);
  });

  it('caps protein for a very large bodyweight', () => {
    assert.ok(calculateMacros(4000, ['muscle_gain'], 200).proteinG <= 220);
  });

  it('uses a lower fat share when cutting than when maintaining', () => {
    const cut = calculateMacros(2500, ['weight_loss'], 80);
    const maintain = calculateMacros(2500, [], 80);
    const fatShare = (m: ReturnType<typeof calculateMacros>) => m.fatG * 9 / 2500;
    assert.ok(fatShare(cut) < fatShare(maintain));
  });
});

describe('numeric helpers', () => {
  it('round1 keeps one decimal', () => {
    assert.equal(round1(2.345), 2.3);
    assert.equal(round1(2.35), 2.4);
  });

  it('round handles an explicit precision', () => {
    assert.equal(round(3.14159, 2), 3.14);
    assert.equal(round(3.14159), 3);
  });

  it('clamp bounds a value', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-5, 0, 10), 0);
    assert.equal(clamp(50, 0, 10), 10);
  });
});
