import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { AI_PROVIDERS, RECOMMENDATION_TYPES } from '../types/enums';

/**
 * Recommendations are expensive to produce, so every generated recommendation is
 * persisted. This gives us three things: a cache keyed by (user, day, type), an
 * audit trail, and the ability to show "why did I get this?" in the UI.
 */
const aiRecommendationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: RECOMMENDATION_TYPES, required: true, index: true },
    title: { type: String, required: true, maxlength: 140 },
    reason: { type: String, required: true, maxlength: 600 },
    recommendation: { type: String, required: true, maxlength: 2000 },
    nextAction: { type: String, default: '', maxlength: 300 },
    motivation: { type: String, default: '', maxlength: 400 },

    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    provider: { type: String, enum: AI_PROVIDERS, default: 'rules', index: true },
    model: { type: String, default: 'deterministic-rules' },

    /** Related catalogue records, so the client can deep-link. */
    relatedIds: { type: [Schema.Types.ObjectId], default: [] },
    relatedLabel: { type: String, default: null },

    /** Feature vector actually used, kept for debugging and re-scoring. */
    contextSnapshot: { type: Schema.Types.Mixed, default: {} },

    day: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },

    dismissed: { type: Boolean, default: false },
    actedUpon: { type: Boolean, default: false },
    userRating: { type: Number, min: -1, max: 1, default: null },

    inferenceMs: { type: Number, default: 0 },
  },
  { timestamps: true },
);

aiRecommendationSchema.index({ userId: 1, type: 1, day: 1, dismissed: 1 });
aiRecommendationSchema.index({ userId: 1, createdAt: -1 });
aiRecommendationSchema.index({ userId: 1, expiresAt: 1 });

export type AIRecommendationAttributes = InferSchemaType<typeof aiRecommendationSchema>;
export type AIRecommendationDocument = HydratedDocument<AIRecommendationAttributes>;
export type AIRecommendationModel = Model<AIRecommendationAttributes>;

export const AIRecommendation = model<AIRecommendationAttributes>(
  'AIRecommendation',
  aiRecommendationSchema,
) as AIRecommendationModel;

/** How long a recommendation stays fresh before we regenerate. */
export const RECOMMENDATION_TTL_HOURS = 12;
