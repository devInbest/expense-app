import type { NotificationPrefs, NotificationType } from '@expense/shared';
import { sendPush } from '../../lib/push';
import { User } from '../users/user.model';
import { Notification } from './notification.model';

export interface NotifyInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Users who turned this preference off get neither the in-app item nor the push. */
  pref?: keyof NotificationPrefs;
}

export const notify = async (input: NotifyInput): Promise<number> => {
  const ids = [...new Set(input.userIds.map(String))];
  if (ids.length === 0) return 0;

  const filter: Record<string, unknown> = { _id: { $in: ids }, status: 'active' };
  if (input.pref) filter[`notificationPrefs.${input.pref}`] = { $ne: false };
  const recipients = (await User.find(filter).select('_id').lean()).map((u) => String(u._id));
  if (recipients.length === 0) return 0;

  const data = { type: input.type, ...(input.data ?? {}) };
  await Notification.insertMany(
    recipients.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body, data })),
  );
  await sendPush(recipients, { title: input.title, body: input.body, data });
  return recipients.length;
};

/** Background variant for request handlers: never delays or fails the response. */
export const notifyLater = (input: NotifyInput) => {
  notify(input).catch((err) => console.error('Notification failed:', err.message));
};
