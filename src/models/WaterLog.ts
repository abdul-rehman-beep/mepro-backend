import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';

const waterLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountMl: { type: Number, required: true, min: 1, max: 5000 },
    loggedAt: { type: Date, default: Date.now },
    day: { type: String, required: true, index: true },
    source: { type: String, enum: ['quick_add', 'custom', 'bottle'], default: 'quick_add' },
  },
  { timestamps: true },
);

waterLogSchema.index({ userId: 1, day: 1 });
waterLogSchema.index({ userId: 1, loggedAt: -1 });

export type WaterLogAttributes = InferSchemaType<typeof waterLogSchema>;
export type WaterLogDocument = HydratedDocument<WaterLogAttributes>;
export type WaterLogModel = Model<WaterLogAttributes>;

export const WaterLog = model<WaterLogAttributes>('WaterLog', waterLogSchema) as WaterLogModel;

export const WATER_PRESETS = [250, 500, 750, 1000] as const;
