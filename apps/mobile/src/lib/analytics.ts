import * as Crypto from 'expo-crypto';
import { APP_EVENT_NAMES, LIMITS } from '@expense/shared';
import { api, isOffline } from './api';
import { config } from './config';
import { tokenStorage } from './secure';

interface QueuedEvent {
  name: string;
  sessionId: string;
  at: string;
  props?: Record<string, string | number | boolean | null>;
}

const MAX_QUEUE = 200;
let sessionId = Crypto.randomUUID();
let queue: QueuedEvent[] = [];

export const track = (name: string, props?: QueuedEvent['props']) => {
  queue.push({ name, sessionId, at: new Date().toISOString(), props });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= 20) void flushEvents();
};

export const trackScreen = (screen: string) => track(APP_EVENT_NAMES.SCREEN_VIEW, { screen });
export const trackFeature = (feature: string) => track(APP_EVENT_NAMES.FEATURE_USED, { feature });

/** A new usage session starts every time the app comes to the foreground. */
export const startSession = () => {
  sessionId = Crypto.randomUUID();
  track(APP_EVENT_NAMES.APP_OPEN);
};

export const flushEvents = async () => {
  if (queue.length === 0) return;
  if (!(await tokenStorage.getRefreshToken())) {
    queue = [];
    return;
  }
  const batch = queue.splice(0, LIMITS.MAX_EVENTS_BATCH);
  try {
    await api.events.track({ platform: config.platform, appVersion: config.appVersion, events: batch });
  } catch (err) {
    if (isOffline(err)) queue.unshift(...batch);
  }
};
