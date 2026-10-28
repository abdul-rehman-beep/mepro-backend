import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { getValidatedQuery } from '../middleware/validation.middleware';
import { routeParam } from '../utils/http';

export async function list(req: Request, res: Response): Promise<Response> {
  const query = getValidatedQuery<{ page?: number; limit?: number; unreadOnly: boolean; type?: string }>(req);
  const result = await notificationService.listNotifications(req.user!.id, query);
  return sendSuccess(res, result, 'Notifications');
}

export async function markRead(req: Request, res: Response): Promise<Response> {
  const notification = await notificationService.markRead(req.user!.id, routeParam(req, 'id'));
  if (!notification) return sendSuccess(res, { read: false }, 'Notification not found');
  return sendSuccess(res, notification, 'Marked as read');
}

export async function markAllRead(req: Request, res: Response): Promise<Response> {
  const result = await notificationService.markAllRead(req.user!.id);
  return sendSuccess(res, result, 'All notifications marked as read');
}

export async function remove(req: Request, res: Response): Promise<Response> {
  const result = await notificationService.removeNotification(req.user!.id, routeParam(req, 'id'));
  return sendSuccess(res, result, 'Notification removed');
}

export async function clear(req: Request, res: Response): Promise<Response> {
  const result = await notificationService.clearAll(req.user!.id);
  return sendSuccess(res, result, 'Notifications cleared');
}

export async function unreadCount(req: Request, res: Response): Promise<Response> {
  const result = await notificationService.listNotifications(req.user!.id, { limit: 1 });
  return sendSuccess(res, { unreadCount: result.unreadCount }, 'Unread count');
}
