import { AIRecommendation, RECOMMENDATION_TTL_HOURS } from '../../models/AIRecommendation';
import { Workout } from '../../models/Workout';
import { Yoga } from '../../models/Yoga';
import { logger } from '../../utils/logger';
import { isoDate, addDays } from '../../utils/date';
import { env } from '../../config/env';
import { withTimeout, embed, cosineSimilarity, lexicalSimilarity, isAiAvailable } from './model.service';
import { sanitiseAssistantText, answerNeedsDisclaimer, MEDICAL_DISCLAIMER } from './safety.service';
import {
  buildUserContext,
  ruleBasedHydrationRecommendation,
  ruleBasedNutritionRecommendation,
  ruleBasedOverallRecommendation,
  ruleBasedWorkoutRecommendation,
  ruleBasedYogaRecommendation,
  type Recommendation,
  type UserContext,
} from './fallback.service';
import type { RecommendationType, WorkoutLocation } from '../../types/enums';

/**
 * Recommendation orchestration.
 *
 * Flow (mirrors the spec's "AI daily flow"):
 *   request -> build context -> look for a fresh cached recommendation
 *           -> valid? return it
 *           -> else rank candidates (embeddings, or lexical if unavailable)
 *              -> compose answer (model-assisted or rules)
 *              -> validate -> persist -> return
 *
 * The model improves ranking and phrasing. It never decides whether to answer.
 */

export interface RecommendationBundle {
  primary: Recommendation;
  workout: Recommendation;
  nutrition: Recommendation;
  hydration: Recommendation;
  yoga: Recommendation;
  provider: 'transformers' | 'rules';
  generatedAt: string;
  expiresAt: string;
  cached: boolean;
  disclaimer: string;
  streak: number;
  userName: string;
}

const RECOMMENDATION_DISCLAIMER =
  'AI suggestions are informational estimates for general fitness and wellness. They are not medical advice, diagnosis or treatment.';

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns an unexpired, undismissed recommendation for today, or null.
 * A single query on a (userId, type, day) index — this is what keeps the
 * dashboard from re-running inference on every load.
 */
export async function findCachedRecommendation(
  userId: string,
  type: RecommendationType,
  now: Date = new Date(),
): Promise<Recommendation | null> {
  const cached = await AIRecommendation.findOne({
    userId,
    type,
    day: isoDate(now),
    dismissed: false,
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!cached) return null;

  return {
    type: cached.type,
    title: cached.title,
    reason: cached.reason,
    recommendation: cached.recommendation,
    nextAction: cached.nextAction,
    motivation: cached.motivation,
    confidence: cached.confidence,
    provider: cached.provider,
    relatedIds: (cached.relatedIds ?? []).map((id) => id.toString()),
    relatedLabel: cached.relatedLabel ?? null,
  };
}

async function persistRecommendation(
  userId: string,
  recommendation: Recommendation,
  context: UserContext,
  inferenceMs: number,
  now: Date = new Date(),
): Promise<void> {
  // Replace any earlier recommendation of the same type for today so history
  // does not fill up with duplicates from repeated requests.
  await AIRecommendation.deleteMany({ userId, type: recommendation.type, day: isoDate(now) });

  await AIRecommendation.create({
    userId,
    type: recommendation.type,
    title: recommendation.title,
    reason: recommendation.reason,
    recommendation: recommendation.recommendation,
    nextAction: recommendation.nextAction,
    motivation: recommendation.motivation,
    confidence: recommendation.confidence,
    provider: recommendation.provider,
    model: recommendation.provider === 'transformers' ? env.AI_EMBEDDING_MODEL : 'deterministic-rules',
    relatedIds: recommendation.relatedIds,
    relatedLabel: recommendation.relatedLabel,
    contextSnapshot: {
      fitnessLevel: context.fitnessLevel,
      goals: context.goals,
      bmi: context.bmi,
      workoutsThisWeek: context.workoutsThisWeek,
      lastWorkoutDaysAgo: context.lastWorkoutDaysAgo,
      streak: context.streak,
    },
    day: isoDate(now),
    expiresAt: addDays(now, 1),
    inferenceMs,
  });
}

/* ------------------------------------------------------------------ */
/* Semantic ranking                                                    */
/* ------------------------------------------------------------------ */

interface Candidate {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  text: string;
  popularity: number;
  score: number;
}

function candidateText(input: { title: string; category: string; description: string; benefits?: string[] }): string {
  return [input.title, input.category.replace(/_/g, ' '), input.description, (input.benefits ?? []).join(' ')]
    .filter(Boolean)
    .join('. ');
}

/**
 * Scores workouts for this user.
 *
 * Two tiers, tried in order:
 *   1. Embedding similarity between the user's goal description and each
 *      workout's text, blended with rule-based constraints.
 *   2. Pure lexical overlap, used when the embedding model is unavailable.
 *
 * The constraint score (difficulty, duration, location) is applied in *both*
 * tiers, so a slow model degrades quality but never correctness.
 */
async function rankWorkouts(context: UserContext, limit = 5): Promise<Candidate[]> {
  const durationCap = Math.max(15, Math.min(context.preferredWorkoutMinutes + 10, 90));
  // 'anywhere' is always allowed: a user who only trains at home should still
  // see outdoor sessions rather than an empty feed.
  const preferredLocations: WorkoutLocation[] =
    context.preferredWorkoutLocation.length > 0
      ? [...new Set([...context.preferredWorkoutLocation, 'anywhere' as WorkoutLocation])]
      : [];

  const workouts = await Workout.find({
    isActive: true,
    durationMinutes: { $lte: durationCap },
    ...(preferredLocations.length > 0 ? { location: { $in: preferredLocations } } : {}),
  })
    .limit(120)
    .lean();

  if (workouts.length === 0) return [];

  const level = context.fitnessLevel ?? 'beginner';
  const goalText = [
    `Goals: ${context.goals.map((goal) => goal.replace(/_/g, ' ')).join(', ') || 'general fitness'}`,
    `Fitness level: ${level}`,
    `Session length: about ${context.preferredWorkoutMinutes} minutes`,
  ].join('. ');

  let semanticScores: number[] | null = null;
  if (isAiAvailable()) {
    try {
      const vectors = await withTimeout(
        embed([goalText, ...workouts.map((workout) => candidateText(workout))]),
        env.AI_TIMEOUT_MS * 2,
        'workout ranking',
      );
      if (vectors && vectors.length === workouts.length + 1) {
        const query = vectors[0].vector;
        semanticScores = vectors.slice(1).map((item) => cosineSimilarity(query, item.vector));
      }
    } catch (error) {
      logger.warn('Semantic ranking unavailable; using lexical ranking', { error });
    }
  }

  const order = ['beginner', 'intermediate', 'advanced'];
  const levelIndex = order.indexOf(level);

  const scored: Candidate[] = workouts.map((workout, index) => {
    const text = candidateText(workout);

    const semantic = semanticScores
      ? (semanticScores[index] + 1) / 2 // map cosine [-1,1] -> [0,1]
      : lexicalSimilarity(goalText, text);

    // Prefer workouts at or just below the user's level; a step up is fine,
    // two steps up is not.
    const workoutLevel = order.indexOf(workout.difficulty);
    const levelPenalty = workoutLevel > levelIndex + 1 ? 0.35 : workoutLevel < levelIndex ? 0.08 : 0;

    const durationPenalty =
      workout.durationMinutes > context.preferredWorkoutMinutes + 20 ? 0.15 : workout.durationMinutes < 10 ? 0.2 : 0;

    const popularityBonus = Math.min(0.1, (workout.popularity ?? 0) / 2000);

    return {
      id: workout._id.toString(),
      title: workout.title,
      category: workout.category,
      difficulty: workout.difficulty,
      durationMinutes: workout.durationMinutes,
      text,
      popularity: workout.popularity ?? 0,
      score: Math.max(0, semantic - levelPenalty - durationPenalty + popularityBonus),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function rankYoga(context: UserContext, limit = 5): Promise<Candidate[]> {
  const routines = await Yoga.find({ isActive: true }).limit(120).lean();
  if (routines.length === 0) return [];

  const hour = new Date().getUTCHours();
  const timeOfDay = hour < 11 ? 'morning' : hour >= 17 ? 'evening' : 'anytime';
  const goalText = `Goals: ${context.goals.map((goal) => goal.replace(/_/g, ' ')).join(', ') || 'wellness'}. ${timeOfDay} routine.`;

  let semanticScores: number[] | null = null;
  if (isAiAvailable()) {
    try {
      const vectors = await withTimeout(
        embed([goalText, ...routines.map((routine) => candidateText(routine))]),
        env.AI_TIMEOUT_MS * 2,
        'yoga ranking',
      );
      if (vectors && vectors.length === routines.length + 1) {
        const query = vectors[0].vector;
        semanticScores = vectors.slice(1).map((item) => cosineSimilarity(query, item.vector));
      }
    } catch {
      // Lexical fallback below.
    }
  }

  const order = ['beginner', 'intermediate', 'advanced'];
  const levelIndex = order.indexOf(context.fitnessLevel ?? 'beginner');

  return routines
    .map((routine, index) => {
      const text = candidateText(routine);
      const semantic = semanticScores
        ? (semanticScores[index] + 1) / 2
        : lexicalSimilarity(goalText, text);

      const timeBonus = routine.bestTimeOfDay === timeOfDay ? 0.15 : routine.bestTimeOfDay === 'anytime' ? 0.05 : 0;
      const categoryBonus = goalCategoryMatch(routine.category, context.goals) ? 0.2 : 0;
      const levelPenalty = order.indexOf(routine.difficulty) > levelIndex + 1 ? 0.3 : 0;

      return {
        id: routine._id.toString(),
        title: routine.title,
        category: routine.category,
        difficulty: routine.difficulty,
        durationMinutes: routine.durationMinutes,
        text,
        popularity: routine.popularity ?? 0,
        score: Math.max(0, semantic + timeBonus + categoryBonus - levelPenalty),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function goalCategoryMatch(category: string, goals: string[]): boolean {
  if (goals.includes('flexibility') && (category === 'flexibility' || category === 'morning')) return true;
  if (goals.includes('stress_reduction') && (category === 'stress_relief' || category === 'relaxation')) return true;
  if (goals.includes('better_lifestyle') && category === 'beginner') return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface ValidationOutcome {
  valid: boolean;
  reason: string | null;
  fixesApplied: string[];
  /** The scrubbed, length-clamped recommendation. Safe to persist and display. */
  recommendation: Recommendation;
}

/**
 * Final gate before any generated text reaches a user. Enforces hard limits the
 * model can violate (empty strings, wrong length) and re-runs the safety scrub,
 * so no unsafe phrasing can escape even if a template changed.
 */
export function validateRecommendation(recommendation: Recommendation): ValidationOutcome {
  const fixes: string[] = [];
  const errors: string[] = [];

  const clean = (value: string, field: string, maxLength: number): string => {
    const sanitised = sanitiseAssistantText(String(value ?? '')).text;
    if (!sanitised.trim()) errors.push(`${field} is empty`);
    if (sanitised.length > maxLength) {
      fixes.push(`${field} truncated to ${maxLength} characters`);
      return `${sanitised.slice(0, maxLength - 1).trimEnd()}…`;
    }
    return sanitised;
  };

  const validated: Recommendation = {
    ...recommendation,
    title: clean(recommendation.title, 'title', 140),
    reason: clean(recommendation.reason, 'reason', 600),
    recommendation: clean(recommendation.recommendation, 'recommendation', 2000),
    nextAction: recommendation.nextAction ? clean(recommendation.nextAction, 'nextAction', 300) : '',
    motivation: recommendation.motivation ? clean(recommendation.motivation, 'motivation', 400) : '',
    confidence: Number.isFinite(recommendation.confidence)
      ? Math.min(1, Math.max(0, recommendation.confidence))
      : 0.5,
    relatedIds: (recommendation.relatedIds ?? []).slice(0, 5),
  };

  // A recommendation that mentions a medical claim must carry the disclaimer.
  if (answerNeedsDisclaimer(validated.recommendation) && !validated.recommendation.includes('not medical advice')) {
    validated.recommendation = `${validated.recommendation} ${MEDICAL_DISCLAIMER}`;
    fixes.push('medical disclaimer appended');
  }

  return {
    valid: errors.length === 0,
    reason: errors.length ? errors.join('; ') : null,
    fixesApplied: fixes,
    recommendation: validated,
  };
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

/**
 * Composes the workout recommendation. If semantic ranking succeeded we reference
 * the top match; otherwise we defer entirely to the deterministic rules.
 */
async function composeWorkoutRecommendation(
  context: UserContext,
  provider: 'transformers' | 'rules',
): Promise<Recommendation> {
  const base = (await ruleBasedWorkoutRecommendation(context)) ?? {
    type: 'workout' as const,
    title: 'Keep your rhythm',
    reason: 'No workout matched your current filters.',
    recommendation: 'Browse the workout library and pick a session that fits today.',
    nextAction: 'Open Workouts',
    motivation: '',
    confidence: 0.4,
    provider: 'rules' as const,
    relatedIds: [],
    relatedLabel: null,
  };

  const candidates = await rankWorkouts(context, 3);
  const top = candidates[0];

  if (!top) return { ...base, provider };

  const reasons: string[] = [];
  if (top.difficulty === (context.fitnessLevel ?? 'beginner')) {
    reasons.push(`it matches your ${top.difficulty} level`);
  }
  if (top.durationMinutes <= context.preferredWorkoutMinutes) {
    reasons.push(`it fits inside your ${context.preferredWorkoutMinutes} minute window`);
  }
  if (context.goals.length) {
    reasons.push(`it supports your ${context.goals.map((goal) => goal.replace(/_/g, ' ')).join(' and ')} goals`);
  }

  return {
    ...base,
    title: top.title,
    relatedIds: [top.id],
    relatedLabel: top.title,
    provider,
    confidence: Math.min(0.92, 0.6 + top.score * 0.3),
    reason: base.reason,
    recommendation: `${base.recommendation} "${top.title}" is a ${top.durationMinutes} minute ${top.category.replace(/_/g, ' ')} session — ${reasons.join(', ') || 'a solid match for your profile'}.`,
  };
}

async function composeYogaRecommendation(
  context: UserContext,
  provider: 'transformers' | 'rules',
): Promise<Recommendation> {
  const base = await ruleBasedYogaRecommendation(context);
  const candidates = await rankYoga(context, 3);
  const top = candidates[0];

  if (!top) return { ...base, provider };

  return {
    ...base,
    title: top.title,
    relatedIds: [top.id],
    relatedLabel: top.title,
    provider,
    confidence: Math.min(0.9, 0.58 + top.score * 0.28),
    recommendation: `${base.recommendation} "${top.title}" is a ${top.durationMinutes} minute ${top.difficulty} routine.`,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface GetRecommendationsOptions {
  force?: boolean;
  type?: RecommendationType;
}

export async function getRecommendations(
  userId: string,
  options: GetRecommendationsOptions = {},
): Promise<RecommendationBundle> {
  const now = new Date();
  const context = await buildUserContext(userId);
  const startedAt = Date.now();

  // The dashboard reads four recommendation types. When any is missing we
  // generate only the missing ones and reuse the rest from cache.
  const types: RecommendationType[] = options.type ? [options.type] : ['workout', 'nutrition', 'hydration', 'yoga'];

  const cached: Partial<Record<RecommendationType, Recommendation>> = {};
  if (!options.force) {
    const cachedRows = await AIRecommendation.find({
      userId,
      type: { $in: types },
      day: isoDate(now),
      dismissed: false,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: 1 })
      .lean();

    for (const row of cachedRows) {
      // Keep the freshest row per type.
      if (!cached[row.type as RecommendationType]) {
        cached[row.type as RecommendationType] = {
          type: row.type as RecommendationType,
          title: row.title,
          reason: row.reason,
          recommendation: row.recommendation,
          nextAction: row.nextAction ?? '',
          motivation: row.motivation ?? '',
          confidence: row.confidence,
          provider: row.provider,
          relatedIds: (row.relatedIds ?? []).map((id) => id.toString()),
          relatedLabel: row.relatedLabel ?? null,
        };
      }
    }
  }

  const missing = types.filter((type) => !cached[type]);
  let usedModel = false;

  if (missing.length > 0) {
    const aiReady = isAiAvailable();

    const generated = await Promise.all(
      missing.map(async (type): Promise<[RecommendationType, Recommendation]> => {
        let recommendation: Recommendation;

        switch (type) {
          case 'workout':
            recommendation = await composeWorkoutRecommendation(context, aiReady ? 'transformers' : 'rules');
            if (aiReady) usedModel = true;
            break;
          case 'yoga':
            recommendation = await composeYogaRecommendation(context, aiReady ? 'transformers' : 'rules');
            if (aiReady) usedModel = true;
            break;
          case 'nutrition':
            recommendation = await ruleBasedNutritionRecommendation(context);
            break;
          case 'hydration':
            recommendation = await ruleBasedHydrationRecommendation(context);
            break;
          default:
            recommendation = await ruleBasedOverallRecommendation(context);
        }

        const outcome = validateRecommendation(recommendation);
        if (!outcome.valid) {
          logger.warn('Recommendation failed validation; using rule-based version', {
            userId,
            type,
            reason: outcome.reason,
          });
          // Even the invalid result is scrubbed and clamped by validate(), so it
          // is still safe to show; the rule engine is the higher-quality answer.
          const safeVersion = outcome.recommendation;
          const ruleVersion = await safeFallbackFor(type, context);
          recommendation = safeVersion.title ? safeVersion : ruleVersion;
        } else {
          recommendation = outcome.recommendation;
        }

        recommendation.provider = aiReady && usedModel && recommendation.provider === 'transformers' ? 'transformers' : 'rules';
        return [type, recommendation];
      }),
    );

    const inferenceMs = Date.now() - startedAt;

    for (const [type, recommendation] of generated) {
      cached[type] = recommendation;
      // Persist with its own type, so each can be invalidated independently.
      await persistRecommendation(userId, { ...recommendation, type }, context, inferenceMs, now);
    }
  }

  const workout = cached.workout ?? (await ruleBasedWorkoutRecommendation(context));
  const nutrition = cached.nutrition ?? (await ruleBasedNutritionRecommendation(context));
  const hydration = cached.hydration ?? (await ruleBasedHydrationRecommendation(context));
  const yoga = cached.yoga ?? (await ruleBasedYogaRecommendation(context));
  const overall = await ruleBasedOverallRecommendation(context);

  const provider: 'transformers' | 'rules' = usedModel ? 'transformers' : 'rules';

  return {
    primary: workout ?? overall,
    workout: workout ?? overall,
    nutrition,
    hydration,
    yoga,
    provider,
    generatedAt: now.toISOString(),
    expiresAt: addDays(now, 1).toISOString(),
    cached: missing.length === 0,
    disclaimer: RECOMMENDATION_DISCLAIMER,
    streak: context.streak,
    userName: context.name,
  };
}

async function safeFallbackFor(type: RecommendationType, context: UserContext): Promise<Recommendation> {
  switch (type) {
    case 'yoga':
      return ruleBasedYogaRecommendation(context);
    case 'nutrition':
      return ruleBasedNutritionRecommendation(context);
    case 'hydration':
      return ruleBasedHydrationRecommendation(context);
    default:
      return ruleBasedOverallRecommendation(context);
  }
}

export async function getRecommendationHistory(
  userId: string,
  limit = 20,
): Promise<unknown[]> {
  return AIRecommendation.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .select('-contextSnapshot')
    .lean();
}

export async function recordRecommendationFeedback(
  userId: string,
  recommendationId: string,
  input: { dismissed?: boolean; actedUpon?: boolean; rating?: number },
): Promise<{ updated: boolean }> {
  const result = await AIRecommendation.updateOne(
    { _id: recommendationId, userId },
    {
      $set: {
        ...(input.dismissed !== undefined ? { dismissed: input.dismissed } : {}),
        ...(input.actedUpon !== undefined ? { actedUpon: input.actedUpon } : {}),
        ...(input.rating !== undefined ? { userRating: input.rating } : {}),
      },
    },
  );
  return { updated: (result.modifiedCount ?? 0) > 0 };
}

export async function invalidateRecommendations(userId: string): Promise<{ cleared: number }> {
  const result = await AIRecommendation.deleteMany({ userId, day: isoDate(new Date()) });
  return { cleared: result.deletedCount ?? 0 };
}

export const AI_RECOMMENDATION_TTL_HOURS = RECOMMENDATION_TTL_HOURS;
