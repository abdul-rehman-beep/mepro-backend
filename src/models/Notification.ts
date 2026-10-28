import { Schema, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { NOTIFICATION_TYPES } from '../types/enums';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    icon: { type: String, default: 'bell' },

    /** Deep-link target for the mobile client, e.g. "workouts/abc". */
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: null },

    data: { type: Schema.Types.Mixed, default: {} },

    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },

    /** Set when the backend successfully hands the payload to Expo. */
    pushStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    pushError: { type: String, default: null },
    pushSentAt: { type: Date, default: null },

    scheduledFor: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, scheduledFor: 1, pushStatus: 1 });
notificationSchema.index({ pushStatus: 1, scheduledFor: 1 });

export type NotificationAttributes = InferSchemaType<typeof notificationSchema>;
export type NotificationDocument = HydratedDocument<NotificationAttributes>;
export type NotificationModel = Model<NotificationAttributes>;

export const Notification = model<NotificationAttributes>(
  'Notification',
  notificationSchema,
) as NotificationModel;
