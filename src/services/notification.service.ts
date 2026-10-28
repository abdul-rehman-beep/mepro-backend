import https from 'node:https';
import {
  Notification,
  type NotificationAttributes,
  type NotificationDocument,
} from '../models/Notification';
import { User } from '../models/User';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getPagination } from '../utils/pagination';
import type { NotificationType } from '../types/enums';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  data?: Record<string, unknown>;
  scheduledFor?: Date | null;
  /** Set false to record the notification without attempting a push send. */
  sendPush?: boolean;
}

/** Maps a notification type onto the user's per-category preference toggle. */
function preferenceKeyFor(type: NotificationType): keyof NotificationSettingsShape | null {
  switch (type) {
    case 'workout_reminder':
    case 'goal_reminder':
      return 'workoutReminders';
    case 'meal_reminder':
      return 'mealReminders';
    case 'water_reminder':
      return 'waterReminders';
    case 'motivation':
      return 'motivation';
    case 'achievement':
      return 'achievements';
    case 'ai_recommendation':
      return 'aiRecommendations';
    default:
      return null;
  }
}

interface NotificationSettingsShape {
  workoutReminders: boolean;
  waterReminders: boolean;
  mealReminders: boolean;
  motivation: boolean;
  achievements: boolean;
  aiRecommendations: boolean;
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationAttributes> {
  const user = await User.findById(input.userId).select('notificationSettings deviceTokens').lean();
  if (!user) throw new Error('User not found while creating notification');

  const preferenceKey = preferenceKeyFor(input.type);
  const settings = (user.notificationSettings ?? {}) as Partial<NotificationSettingsShape>;
  const enabled = preferenceKey ? settings[preferenceKey] !== false : true;

  const scheduledFor = input.scheduledFor ?? null;
  const isFuture = scheduledFor !== null && scheduledFor.getTime() > Date.now();

  const doc = await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    icon: input.icon ?? 'bell',
    actionUrl: input.actionUrl ?? null,
    actionLabel: input.actionLabel ?? null,
    data: input.data ?? {},
    scheduledFor,
    pushStatus: 'pending',
  });

  // Always persist. Push is best-effort: a failed send must not lose the
  // in-app notification the user can still read in the bell screen.
  const shouldPush = input.sendPush !== false && enabled && !isFuture && (user.deviceTokens?.length ?? 0) > 0;

  if (!shouldPush) {
    await Notification.updateOne({ _id: doc._id }, { $set: { pushStatus: isFuture ? 'pending' : 'skipped' } });
    return doc.toObject();
  }

  const result = await sendPushToUser(user.deviceTokens ?? [], doc.toObject());

  await Notification.updateOne(
    { _id: doc._id },
    {
      $set: {
        pushStatus: result.sent ? 'sent' : 'failed',
        pushError: result.error ?? null,
        pushSentAt: new Date(),
      },
    },
  );

  return Notification.findById(doc._id).lean() as unknown as Promise<NotificationAttributes>;
}

interface PushResult {
  sent: boolean;
  error?: string;
}

/**
 * Minimal Expo Push API client over https.
 *
 * Implemented directly rather than pulling in `expo-server-sdk` to keep the
 * dependency surface small, and so the request shape is explicit and testable.
 */
export async function sendPushToUser(
  tokens: string[],
  notification: Pick<NotificationAttributes, 'title' | 'body' | 'data' | 'actionUrl' | 'type'>,
): Promise<PushResult> {
  if (tokens.length === 0) return { sent: false, error: 'no device tokens registered' };

  const messages = tokens.map((to) => ({
    to,
    title: notification.title,
    body: notification.body,
    data: {
      type: notification.type,
      actionUrl: notification.actionUrl ?? undefined,
      ...(notification.data as Record<string, unknown> | undefined),
    },
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  const body = JSON.stringify(messages);
  const options: https.RequestOptions = {
    hostname: 'exp.host',
    port: 443,
    path: '--/api/v2/push/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Length': Buffer.byteLength(body),
    },
    timeout: 10_000,
  };

  return new Promise<PushResult>((resolve) => {
    const request = https.request(options, (response) => {
      let payload = '';
      response.on('data', (chunk) => {
        payload += chunk;
      });
      response.on('end', () => {
        if ((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300) {
          try {
            const results = JSON.parse(payload) as Array<{ status: string; id?: string }>;
            const deviceErrors = results.filter((item) => item.status !== 'ok');
            if (deviceErrors.length === 0) return resolve({ sent: true });
            return resolve({ sent: false, error: deviceErrors[0]?.status ?? 'device error' });
          } catch {
            return resolve({ sent: false, error: 'malformed push response' });
          }
        }
        resolve({ sent: false, error: `HTTP ${response.statusCode}` });
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ sent: false, error: 'push request timed out' });
    });

    request.on('error', (error) => resolve({ sent: false, error: error.message }));
    request.write(body);
    request.end();
  });
}

export async function listNotifications(
  userId: string,
  query: { page?: unknown; limit?: unknown; unreadOnly?: unknown; type?: unknown },
): Promise<{ items: NotificationAttributes[]; unreadCount: number; total: number }> {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { userId };

  if (query.unreadOnly === 'true' || query.unreadOnly === true) filter.read = false;
  if (typeof query.type === 'string' && query.type) filter.type = query.type;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return { items: items as unknown as NotificationAttributes[], unreadCount, total };
}

export async function markRead(userId: string, notificationId: string): Promise<NotificationAttributes | null> {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return { updated: result.modifiedCount ?? 0 };
}

export async function removeNotification(userId: string, notificationId: string): Promise<{ removed: boolean }> {
  const result = await Notification.deleteOne({ _id: notificationId, userId });
  return { removed: (result.deletedCount ?? 0) > 0 };
}

export async function clearAll(userId: string): Promise<{ removed: number }> {
  const result = await Notification.deleteMany({ userId });
  return { removed: result.deletedCount ?? 0 };
}

/**
 * Delivers notifications whose scheduled time has arrived. Intended to be called
 * by a scheduler (cron / setInterval in server.ts). Capped per run so a large
 * backlog cannot stall the event loop.
 */
export async function processScheduledNotifications(limit = 100): Promise<{ processed: number; sent: number }> {
  const due = await Notification.find({
    pushStatus: 'pending',
    scheduledFor: { $ne: null, $lte: new Date() },
  })
    .limit(limit)
    .lean();

  let sent = 0;
  for (const notification of due) {
    const user = await User.findById(notification.userId).select('deviceTokens').lean();
    const tokens = user?.deviceTokens ?? [];
    const result = tokens.length
      ? await sendPushToUser(tokens, notification)
      : { sent: false, error: 'no device tokens' };

    if (result.sent) sent += 1;
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { pushStatus: result.sent ? 'sent' : 'failed', pushError: result.error ?? null, pushSentAt: new Date() } },
    );
  }

  if (due.length) logger.info('Processed scheduled notifications', { processed: due.length, sent });
  return { processed: due.length, sent };
}

export async function seedRemindersForUser(userId: string): Promise<{ created: number }> {
  const user = await User.findById(userId).select('notificationSettings name dailyWaterTargetMl preferredWorkoutMinutes').lean();
  if (!user) return { created: 0 };

  const settings = (user.notificationSettings ?? {}) as Partial<NotificationSettingsShape>;
  const times: string[] = user.notificationSettings?.reminderTimes ?? ['08:00', '13:00', '19:00'];
  const now = new Date();
  const created: NotificationDocument[] = [];

  if (settings.waterReminders !== false) {
    created.push(
      await Notification.create({
        userId,
        type: 'water_reminder',
        title: 'Time for water',
        body: `Aim for ${((user.dailyWaterTargetMl ?? 2000) / 1000).toFixed(1)} L today. A glass now keeps you on track.`,
        icon: 'water',
        actionUrl: '/hydration',
        scheduledFor: atLocalTime(now, times[0] ?? '10:00'),
        pushStatus: 'pending',
      }),
    );
  }

  if (settings.mealReminders !== false) {
    created.push(
      await Notification.create({
        userId,
        type: 'meal_reminder',
        title: 'Plan your next meal',
        body: 'Check your meal plan and log what you eat to keep your targets accurate.',
        icon: 'meal',
        actionUrl: '/nutrition',
        scheduledFor: atLocalTime(now, times[1] ?? '13:00'),
        pushStatus: 'pending',
      }),
    );
  }

  if (settings.workoutReminders !== false) {
    created.push(
      await Notification.create({
        userId,
        type: 'workout_reminder',
        title: `Ready to train, ${user.name?.split(' ')[0] ?? 'friend'}?`,
        body: `A ${user.preferredWorkoutMinutes ?? 30} minute session is a great way to keep your streak going.`,
        icon: 'workout',
        actionUrl: '/workouts',
        scheduledFor: atLocalTime(now, times[2] ?? '19:00'),
        pushStatus: 'pending',
      }),
    );
  }

  return { created: created.length };
}

function atLocalTime(reference: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const date = new Date(reference);
  date.setUTCHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  // If the slot already passed today, move it to tomorrow.
  if (date.getTime() <= Date.now()) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export const PUSH_ENABLED_IN_PRODUCTION = env.isProduction;
