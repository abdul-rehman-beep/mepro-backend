import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { ASSISTANT_INTENTS, AI_PROVIDERS } from '../types/enums';

const messageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    intent: { type: String, enum: ASSISTANT_INTENTS, default: 'general_fitness' },
    confidence: { type: Number, min: 0, max: 1, default: null },
    provider: { type: String, enum: AI_PROVIDERS, default: 'rules' },
    /** True when the answer came from the deterministic fallback engine. */
    usedFallback: { type: Boolean, default: false },
    safetyFlags: { type: [String], default: [] },
    sources: { type: [String], default: [] },
    suggestedActions: { type: [String], default: [] },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation', maxlength: 120 },
    messages: { type: [messageSchema], default: [] },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

aiConversationSchema.index({ userId: 1, lastMessageAt: -1 });

export type AIConversationAttributes = InferSchemaType<typeof aiConversationSchema>;
export type AIConversationDocument = HydratedDocument<AIConversationAttributes>;
export type AIConversationModel = Model<AIConversationAttributes>;

export const AIConversation = model<AIConversationAttributes>(
  'AIConversation',
  aiConversationSchema,
) as AIConversationModel;

/** Cap stored turns per conversation to keep documents within Mongo's 16MB limit. */
export const MAX_STORED_MESSAGES = 40;
