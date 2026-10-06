import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { env } from '../config/env';
import { Device } from '../modules/notifications/device.model';

const expo = new Expo(env.expoAccessToken ? { accessToken: env.expoAccessToken } : {});

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Sends to every enabled device of the given users. Tokens Expo reports as dead are disabled. */
export const sendPush = async (userIds: string[], payload: PushPayload): Promise<number> => {
  if (userIds.length === 0) return 0;
  const devices = await Device.find({ userId: { $in: userIds }, enabled: true }).select('expoPushToken').lean();
  const tokens = [...new Set(devices.map((d) => d.expoPushToken))].filter((t) => Expo.isExpoPushToken(t));
  if (tokens.length === 0) return 0;

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  let sent = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const dead: string[] = [];
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[i].to as string);
      });
      if (dead.length) await Device.updateMany({ expoPushToken: { $in: dead } }, { enabled: false });
    } catch (err) {
      console.error('Push send failed:', (err as Error).message);
    }
  }
  return sent;
};
