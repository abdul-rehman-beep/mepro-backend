import { AIConversation, MAX_STORED_MESSAGES } from '../../models/AIConversation';
import { Workout } from '../../models/Workout';
import { Yoga } from '../../models/Yoga';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import { withTimeout, classify, embed, cosineSimilarity, lexicalSimilarity, isAiAvailable } from './model.service';
import {
  screenUserInput,
  sanitiseAssistantText,
  buildProfessionalReferral,
  MEDICAL_DISCLAIMER,
  type SafetyAssessment,
} from './safety.service';
import { buildUserContext, type UserContext } from './fallback.service';
import { ASSISTANT_INTENTS, type AssistantIntent } from '../../types/enums';

/**
 * Fitness & wellness assistant.
 *
 * Pipeline:
 *   question
 *     -> safety screen (refuse / redirect before anything else)
 *     -> intent (zero-shot classifier, or keyword rules if unavailable)
 *     -> ground in the user's own data + the catalogue (retrieval)
 *     -> compose answer (deterministic templates, always grounded)
 *     -> safety scrub + persist
 *
 * A free-form generative model is deliberately not in the answer path. For
 * health-adjacent questions a templated, data-grounded answer is safer and more
 * useful than small-model text, and it keeps CPU latency in the tens of
 * milliseconds. `AI_GENERATION_MODEL` exists as an opt-in escape hatch but is
 * off by default and still passes through the same safety scrub.
 */

export interface AssistantReply {
  reply: string;
  intent: AssistantIntent;
  confidence: number;
  provider: 'transformers' | 'rules';
  usedFallback: boolean;
  safetyFlags: string[];
  requiresProfessionalReferral: boolean;
  suggestedActions: string[];
  sources: string[];
  providerUnavailable?: boolean;
  userContextUsed: Record<string, unknown>;
}

const INTENT_LABELS: Record<AssistantIntent, string> = {
  workout_advice: 'workout advice',
  nutrition_advice: 'nutrition advice',
  hydration_advice: 'hydration advice',
  exercise_explanation: 'exercise explanation',
  yoga_advice: 'yoga advice',
  warmup_advice: 'warmup or stretching advice',
  progress_advice: 'progress and consistency advice',
  goal_advice: 'goal setting advice',
  safety_advice: 'general exercise safety advice',
  general_fitness: 'general fitness question',
  out_of_scope: 'question unrelated to fitness and wellness',
};

/**
 * Keyword rules run first because they are deterministic and cheap. The model
 * only handles the residue. Ordered by specificity.
 */
const INTENT_RULES: Array<{ intent: AssistantIntent; patterns: RegExp[] }> = [
  {
    intent: 'warmup_advice',
    patterns: [/\bwarm ?up\b/i, /\bcool ?down\b/i, /\bstretch(ing)? (before|after)\b/i, /\bshould i warm\b/i],
  },
  {
    intent: 'hydration_advice',
    patterns: [
      /\b(how much|how many).{0,20}\b(water|fluid|liquid)\b/i,
      /\b(hydrat|water intake|drink)\b/i,
      /\b(how many) (glasses|glasses of water)\b/i,
      /\bdehydrat/i,
    ],
  },
  {
    intent: 'exercise_explanation',
    patterns: [
      /\bhow (do|to) (do|perform)\b/i,
      /\b(what is|whats|explain|teach me)\b.{0,30}\b(exercise|exercise|rep|squat|push ?up|plank|lunge|deadlift)\b/i,
      /\b(how to) (do|perform) (a|an|the)\b/i,
      /\b(proper|correct) form\b/i,
      /\bwhat does\b.{0,20}\b(mean|do)\b/i,
    ],
  },
  {
    intent: 'nutrition_advice',
    patterns: [
      /\b(healthy|breakfast|lunch|dinner|snack|meal plan|meal prep)\b/i,
      /\b(eat|diet|protein|calories|calorie|macro|carb|fat intake|vitamins?)\b/i,
      /\b(what should i eat|what.*good food)\b/i,
      /\b(veg|vegetarian|keto|intermittent fasting)\b/i,
    ],
  },
  {
    intent: 'yoga_advice',
    patterns: [/\b(yoga|asana|pose|meditat|breathing|namaste|downward dog|child'?s pose)\b/i],
  },
  {
    intent: 'goal_advice',
    patterns: [/\b(goal|target|plan to|routine to|how do i start|beginner plan)\b/i],
  },
  {
    intent: 'progress_advice',
    patterns: [/\b(progress|streak|consisten|plateau|improv|results?|motivat|not losing)\b/i],
  },
  {
    intent: 'workout_advice',
    patterns: [
      /\b(workout|train|training|exercise|session|run|runn?ing|walk|cardio|strength|weights?)\b/i,
      /\b(what (workout|exercise)s? should i)\b/i,
      /\b(today)\b.{0,30}\b(do|train|workout)\b/i,
      /\bhow (often|many days|many times)\b/i,
    ],
  },
  {
    intent: 'safety_advice',
    patterns: [/\b(safe|injury|pain|form|warm up|shin splint|knee|shoulder pain|overtrain)\b/i],
  },
];

export function detectIntentByRules(message: string): AssistantIntent {
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(message))) return rule.intent;
  }
  return 'general_fitness';
}

/** Zero-shot classification, falling back to the keyword rules. */
export async function detectIntent(message: string): Promise<{ intent: AssistantIntent; confidence: number; usedModel: boolean }> {
  const ruleIntent = detectIntentByRules(message);

  if (!isAiAvailable()) {
    return { intent: ruleIntent, confidence: 0.55, usedModel: false };
  }

  try {
    const results = await withTimeout(
      classify(message, ASSISTANT_INTENTS.map((intent) => INTENT_LABELS[intent])),
      env.AI_TIMEOUT_MS,
      'intent classification',
    );

    if (results && results.length > 0) {
      const top = results[0];
      const matched = ASSISTANT_INTENTS.find((intent) => INTENT_LABELS[intent] === top.label);

      if (matched && top.score >= 0.45) {
        return { intent: matched, confidence: Number(top.score.toFixed(3)), usedModel: true };
      }
    }
  } catch (error) {
    logger.warn('Intent classification failed; using keyword rules', { error });
  }

  return { intent: ruleIntent, confidence: 0.55, usedModel: false };
}

/* ------------------------------------------------------------------ */
/* Knowledge grounding                                                 */
/* ------------------------------------------------------------------ */

interface RetrievedItem {
  title: string;
  text: string;
  id: string;
  kind: 'workout' | 'yoga';
}

/**
 * Retrieves catalogue entries relevant to the question. Uses embeddings when
 * available, otherwise token overlap. Bounded to a small candidate pool so the
 * answer can quote a specific routine without inventing one.
 */
async function retrieve(question: string, context: UserContext, limit = 3): Promise<RetrievedItem[]> {
  const [workouts, yoga] = await Promise.all([
    Workout.find({ isActive: true })
      .select('title description category difficulty durationMinutes benefits muscleGroups')
      .limit(80)
      .lean(),
    Yoga.find({ isActive: true })
      .select('title description category difficulty durationMinutes benefits')
      .limit(60)
      .lean(),
  ]);

  const pool: RetrievedItem[] = [
    ...workouts.map((workout) => ({
      title: workout.title,
      text: [workout.title, workout.description, (workout.benefits ?? []).join(' ')].filter(Boolean).join(' '),
      id: workout._id.toString(),
      kind: 'workout' as const,
    })),
    ...yoga.map((routine) => ({
      title: routine.title,
      text: [routine.title, routine.description, (routine.benefits ?? []).join(' ')].filter(Boolean).join(' '),
      id: routine._id.toString(),
      kind: 'yoga' as const,
    })),
  ];

  if (pool.length === 0) return [];

  let semantic: number[] | null = null;

  if (isAiAvailable()) {
    try {
      const vectors = await withTimeout(
        embed([question, ...pool.map((item) => item.text)]),
        env.AI_TIMEOUT_MS,
        'assistant retrieval',
      );
      if (vectors && vectors.length === pool.length + 1) {
        const query = vectors[0].vector;
        semantic = vectors.slice(1).map((item) => cosineSimilarity(query, item.vector));
      }
    } catch {
      // Lexical fallback below.
    }
  }

  return pool
    .map((item, index) => ({
      ...item,
      score: semantic ? (semantic[index] + 1) / 2 : lexicalSimilarity(question, item.text),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

/* ------------------------------------------------------------------ */
/* Answer composition                                                  */
/* ------------------------------------------------------------------ */

const NAME_KEY = (context: UserContext) => context.name.trim().split(/\s+/)[0] ?? 'there';

function answerForIntent(
  intent: AssistantIntent,
  context: UserContext,
  items: RetrievedItem[],
  safety: SafetyAssessment,
): { text: string; actions: string[]; sources: string[] } {
  const name = NAME_KEY(context);
  const top = items[0];

  // Safety-sensitive intents get a referral regardless of whether the screen
  // flagged the input, because the topic itself warrants care.
  if (intent === 'safety_advice' || safety.requiresProfessionalReferral) {
    return {
      text: `For ${name}, general safety guidance for exercise: warm up for 5-10 minutes before training, build volume gradually rather than in sudden jumps, keep 1-2 rest days a week, stop if you feel sharp or sudden pain rather than dull muscle fatigue, and get a check-up before starting if you have an existing health condition, are pregnant, or are over 40 and have been inactive. ${buildProfessionalReferral()}`,
      actions: ['Warm up before your next session', 'Review the Yoga tab for gentle mobility work'],
      sources: ['MEPro exercise safety guidance'],
    };
  }

  switch (intent) {
    case 'hydration_advice': {
      const litres = (context.dailyWaterTargetMl / 1000).toFixed(1);
      return {
        text: `Your hydration target is about ${litres} litres a day, ${context.dailyWaterTargetMl} ml, based on your body weight and activity level. Space it across the day instead of drinking it in one go: a glass with each meal, one before training, and small sips during longer sessions. On hot days or when you sweat heavily, add roughly 500 ml, and add about 12 ml per training minute. ${MEDICAL_DISCLAIMER}`,
        actions: ['Log a glass in Hydration', 'Turn on water reminders in Settings'],
        sources: ['Hydration target calculator', 'Your profile (weight, activity level)'],
      };
    }

    case 'nutrition_advice': {
      const protein = Math.round((context.weightKg ?? 70) * 1.6);
      return {
        text: `Based on your profile, aim for roughly ${context.dailyCalorieTarget.toLocaleString('en-US')} kcal and about ${protein} g of protein a day, spread across ${context.mealCount ?? 3} meals. A practical plate is half vegetables, a quarter protein such as daal, chicken, eggs or paneer, and a quarter rice or roti. If you want a concrete starting point, ${top ? `"${top.title}" is a good match for your goals` : 'the meal planner builds a plan from your preferences'}. Nutrition figures in this app are approximate reference values, not medical advice.`,
        actions: ['Open your meal plan', 'Log what you ate today'],
        sources: ['Calorie target calculator', 'Your profile (goals, diet preference, allergies)'],
      };
    }

    case 'workout_advice': {
      const recent = context.workoutsThisWeek === 0 ? 'you have not trained yet this week' : `you have completed ${context.workoutsThisWeek} session${context.workoutsThisWeek === 1 ? '' : 's'} this week`;
      const suggestion = top
        ? `A good fit for you is "${top.title}", which suits your ${context.fitnessLevel ?? 'beginner'} level and your ${context.preferredWorkoutMinutes} minute window.`
        : `Pick a ${context.preferredWorkoutMinutes} minute session at your ${context.fitnessLevel ?? 'beginner'} level.`;
      return {
        text: `Since ${recent}, ${suggestion} ${context.lastWorkoutDaysAgo !== null && context.lastWorkoutDaysAgo >= 4 ? 'You have had a few days off, so start at an easy pace today rather than jumping back in hard.' : 'Keeping a steady rhythm matters more than any single hard session.'} Aim for about ${context.preferredWorkoutMinutes} minutes and stop a set early if your form breaks down.`,
        actions: ['Start today\'s session', 'Browse the workout library'],
        sources: ['Workout catalogue', 'Your recent training history'],
      };
    }

    case 'exercise_explanation': {
      if (top) {
        return {
          text: `"${top.title}" is one of the routines in the library that matches your question. Open it to see the full instructions, sets, reps and the common mistakes for each exercise, along with form cues. The general principle for any exercise: set up a stable base, keep your breath steady rather than holding it, control the lowering phase, and stop a rep when you can no longer keep the same position. If a movement causes sharp pain, stop and consult a professional. ${MEDICAL_DISCLAIMER}`,
          actions: [`Open "${top.title}"`, 'See the exercise instructions'],
          sources: ['Workout catalogue', 'MEPro exercise guidance'],
        };
      }
      return {
        text: `For any exercise, the safest approach is: pick a weight or difficulty you can control for the full set, keep your breath steady instead of holding it, lower the weight slowly under control, and stop the set when you can no longer maintain the same position. Start lighter than you think you need for your first few sessions. If something causes sharp pain rather than muscle fatigue, stop. ${MEDICAL_DISCLAIMER}`,
        actions: ['Browse the workout library'],
        sources: ['MEPro exercise guidance'],
      };
    }

    case 'yoga_advice': {
      const suggestion = top ? ` Try "${top.title}" from the Yoga tab.` : '';
      return {
        text: `For a beginner, start with short sessions of 10-15 minutes and hold each pose for 20-30 breaths rather than chasing duration.${suggestion} Move slowly, breathe into the stretch rather than holding your breath, and come out of a pose if you feel pinching or sharp pain. If you have a back or joint condition, stick with the back-friendly routines and check with a professional first. ${MEDICAL_DISCLAIMER}`,
        actions: ['Browse beginner yoga', 'Start a morning flow'],
        sources: ['Yoga catalogue', 'MEPos yoga guidance'],
      };
    }

    case 'warmup_advice': {
      return {
        text: `A warm-up should raise your heart rate gradually and rehearse the movements you are about to do, not just stretch. Try 3-5 minutes of easy movement such as marching or cycling, then 4-6 dynamic movements relevant to the session: leg swings, arm circles, bodyweight squats, and hip openers. Finish with the specific lift you plan to start with, using lighter weight. Skipping the warm-up is the most common cause of feeling tight or sore after a session. ${MEDICAL_DISCLAIMER}`,
        actions: ['Start a session (warm-up is built in)'],
        sources: ['MEPro warm-up guidance'],
      };
    }

    case 'progress_advice': {
      const streak = context.streak;
      return {
        text: `You are on a ${streak} day streak${streak > 0 ? ', which is real progress' : ''}, with ${context.totalWorkouts} completed workouts. Progress on weight and strength is rarely linear week to week, so judge a two to three week window rather than a single day. Check that you are hitting your session target, eating enough protein, and sleeping consistently, because those three explain most plateaus. If a metric has not moved in three to four weeks, change one variable, such as adding a set, a small surplus, or an extra session, rather than everything at once.`,
        actions: ['Open Progress', 'Review your goals'],
        sources: ['Your workout and streak history', 'MEPro progress guidance'],
      };
    }

    case 'goal_advice': {
      return {
        text: `Good goals are specific, measurable and small enough to act on this week. Instead of "get fit", try "complete three 30 minute sessions a week" or "drink 2 litres of water on 5 days". Track those in the Goals tab and they update automatically as you log workouts, water and weight. Review them every week and adjust the target, not the goal.`,
        actions: ['Create a goal', 'Open your dashboard'],
        sources: ['MEPro goal guidance'],
      };
    }

    case 'out_of_scope': {
      return {
        text: `I can help with fitness and wellness topics such as workouts, yoga, nutrition, hydration, progress and goals. I am not able to help with questions outside that area. ${MEDICAL_DISCLAIMER}`,
        actions: ['Ask about today\'s workout', 'Ask about hydration'],
        sources: [],
      };
    }

    case 'general_fitness':
    default: {
      return {
        text: `I can help you build a workout, explain an exercise, plan meals, work out your water target, or review your progress. Based on your profile you are working towards ${context.goals.length ? context.goals.map((goal) => goal.replace(/_/g, ' ')).join(' and ') : 'general fitness'} at a ${context.fitnessLevel ?? 'beginner'} level, with a target of ${context.dailyCalorieTarget.toLocaleString('en-US')} kcal and ${context.dailyWaterTargetMl} ml of water a day. ${MEDICAL_DISCLAIMER}`,
        actions: ['What should I do today?', 'How much water should I drink?'],
        sources: ['Your profile'],
      };
    }
  }
}

const REFUSAL_TEXT =
  `I cannot help with that. ${buildProfessionalReferral()}`;

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function ask(
  userId: string,
  message: string,
  conversationId?: string,
): Promise<{ reply: AssistantReply; conversationId: string }> {
  const startedAt = Date.now();
  const context = await buildUserContext(userId);
  const safety = screenUserInput(message);

  let intent: AssistantIntent;
  let confidence: number;
  let usedModel = false;

  if (safety.category === 'emergency' || safety.category === 'self_harm') {
    // Do not run any model on these inputs.
    intent = 'safety_advice';
    confidence = 1;
  } else {
    const detected = await detectIntent(message);
    intent = detected.intent;
    confidence = detected.confidence;
    usedModel = detected.usedModel;
  }

  let replyText: string;
  let actions: string[] = [];
  let sources: string[] = [];

  if (safety.category === 'self_harm') {
    replyText =
      'I am really sorry you are going through this. You deserve support from a real person right now. Please contact your local emergency number or a crisis helpline, or talk to someone you trust today. ' +
      buildProfessionalReferral();
    actions = [];
  } else if (safety.requiresProfessionalReferral) {
    replyText = REFUSAL_TEXT;
  } else {
    const items = await retrieve(message, context, 3);
    const composed = answerForIntent(intent, context, items, safety);
    replyText = composed.text;
    actions = composed.actions;
    sources = [...composed.sources, ...items.map((item) => `${item.kind === 'workout' ? 'Workout' : 'Yoga'}: ${item.title}`)];
  }

  // Final scrub. Every path above goes through this.
  const scrubbed = sanitiseAssistantText(replyText);

  const reply: AssistantReply = {
    reply: scrubbed.text,
    intent,
    confidence,
    provider: usedModel ? 'transformers' : 'rules',
    usedFallback: !usedModel,
    safetyFlags: safety.category === 'none' ? [] : [safety.category],
    requiresProfessionalReferral: safety.requiresProfessionalReferral,
    suggestedActions: actions,
    sources: sources.slice(0, 5),
    providerUnavailable: !isAiAvailable(),
    userContextUsed: {
      name: context.name,
      fitnessLevel: context.fitnessLevel,
      goals: context.goals,
      preferredWorkoutMinutes: context.preferredWorkoutMinutes,
      dailyCalorieTarget: context.dailyCalorieTarget,
      dailyWaterTargetMl: context.dailyWaterTargetMl,
      streak: context.streak,
    },
  };

  const conversation = await persistTurn(userId, message, reply, conversationId);

  logger.debug('Assistant replied', {
    userId,
    intent,
    confidence,
    provider: reply.provider,
    latencyMs: Date.now() - startedAt,
    safety: reply.safetyFlags,
  });

  return { reply, conversationId: conversation };
}

async function persistTurn(
  userId: string,
  question: string,
  reply: AssistantReply,
  conversationId?: string,
): Promise<string> {
  const userMessage = {
    role: 'user' as const,
    content: question,
    intent: reply.intent,
    confidence: reply.confidence,
    provider: reply.provider,
    usedFallback: reply.usedFallback,
    safetyFlags: reply.safetyFlags,
    sources: [],
    suggestedActions: [],
  };

  const assistantMessage = {
    role: 'assistant' as const,
    content: reply.reply,
    intent: reply.intent,
    confidence: reply.confidence,
    provider: reply.provider,
    usedFallback: reply.usedFallback,
    safetyFlags: reply.safetyFlags,
    sources: reply.sources,
    suggestedActions: reply.suggestedActions,
  };

  if (conversationId) {
    const existing = await AIConversation.findOne({ _id: conversationId, userId }).lean();
    if (existing) {
      const updated = await AIConversation.findOneAndUpdate(
        { _id: conversationId, userId },
        {
          $push: { messages: { $each: [userMessage, assistantMessage], $slice: -MAX_STORED_MESSAGES } },
          $set: { lastMessageAt: new Date() },
          $inc: { messageCount: 2 },
        },
        { returnDocument: 'after' },
      );
      if (updated) return updated.id as string;
    }
  }

  const created = await AIConversation.create({
    userId,
    title: question.slice(0, 60),
    messages: [userMessage, assistantMessage],
    messageCount: 2,
    lastMessageAt: new Date(),
  });

  return created.id as string;
}

export async function listConversations(userId: string, limit = 20): Promise<unknown[]> {
  return AIConversation.find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .select('-messages')
    .lean();
}

export async function getConversation(userId: string, id: string): Promise<unknown | null> {
  return AIConversation.findOne({ _id: id, userId }).lean();
}

export async function deleteConversation(userId: string, id: string): Promise<{ deleted: boolean }> {
  const result = await AIConversation.deleteOne({ _id: id, userId });
  return { deleted: (result.deletedCount ?? 0) > 0 };
}

export const SUGGESTED_QUESTIONS = [
  'What workout should I do today?',
  'How much water should I drink?',
  'Suggest a healthy breakfast',
  'Why should I warm up?',
  'Give me a beginner yoga routine',
  'How am I progressing?',
];
