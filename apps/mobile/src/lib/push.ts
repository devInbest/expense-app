import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import { api } from './api';
import { config } from './config';
import { getDeviceId } from './secure';

type NotificationsModule = typeof import('expo-notifications');

let mod: NotificationsModule | null | undefined;

/** Expo Go (SDK 53+) throws on importing expo-notifications on Android, so it is loaded lazily and skipped there. */
export const getNotifications = (): NotificationsModule | null => {
  if (mod !== undefined) return mod;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || config.platform === 'web') {
    mod = null;
    return mod;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    mod = null;
  }
  return mod;
};

/**
 * Asks for permission and registers this device's Expo push token with the API.
 * Silently does nothing in Expo Go, on simulators, web, or builds without an EAS project id.
 */
export const registerForPush = async (): Promise<string | null> => {
  const Notifications = getNotifications();
  if (!Notifications || !Device.isDevice || !config.easProjectId) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });
    await api.me.registerPushToken({ expoPushToken: token, deviceId: await getDeviceId(), platform: config.platform });
    return token;
  } catch (err) {
    console.warn('Push registration failed', err);
    return null;
  }
};

export const unregisterPush = async () => {
  try {
    await api.me.unregisterPushToken(await getDeviceId());
  } catch {
    // Best effort; the server also drops tokens Expo reports as dead.
  }
};

/** Where a tapped notification should take the user. */
export const hrefForNotification = (data: Record<string, unknown> | undefined): Href => {
  if (data?.inviteId) return '/invites';
  if (typeof data?.roomId === 'string') return { pathname: '/room/[id]', params: { id: data.roomId } };
  if (data?.recurringId) return '/recurring';
  return '/notifications';
};
