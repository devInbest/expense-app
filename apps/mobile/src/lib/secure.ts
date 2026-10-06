import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { DeviceInfo } from '@expense/shared';
import { config } from './config';

const KEYS = { access: 'auth.access', refresh: 'auth.refresh', deviceId: 'device.id' };

// SecureStore is unavailable on web; fall back to memory so the web build still runs.
const memory = new Map<string, string>();
const store = {
  get: async (key: string) => (Platform.OS === 'web' ? memory.get(key) ?? null : SecureStore.getItemAsync(key)),
  set: async (key: string, value: string) =>
    Platform.OS === 'web' ? void memory.set(key, value) : SecureStore.setItemAsync(key, value),
  remove: async (key: string) => (Platform.OS === 'web' ? void memory.delete(key) : SecureStore.deleteItemAsync(key)),
};

let accessToken: string | null = null;

export const tokenStorage = {
  getAccessToken: async () => (accessToken ??= await store.get(KEYS.access)),
  getRefreshToken: () => store.get(KEYS.refresh),
  setTokens: async (tokens: { accessToken: string; refreshToken?: string }) => {
    accessToken = tokens.accessToken;
    await store.set(KEYS.access, tokens.accessToken);
    if (tokens.refreshToken) await store.set(KEYS.refresh, tokens.refreshToken);
  },
  clear: async () => {
    accessToken = null;
    await Promise.all([store.remove(KEYS.access), store.remove(KEYS.refresh)]);
  },
};

let deviceId: string | null = null;

/** Stable per-install id; sessions and push tokens are keyed by it. */
export const getDeviceId = async () => {
  if (deviceId) return deviceId;
  deviceId = await store.get(KEYS.deviceId);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await store.set(KEYS.deviceId, deviceId);
  }
  return deviceId;
};

export const getDeviceInfo = async (): Promise<DeviceInfo> => ({
  deviceId: await getDeviceId(),
  platform: config.platform,
  appVersion: config.appVersion,
  deviceName: (Device.deviceName ?? Device.modelName ?? undefined)?.slice(0, 128),
});
