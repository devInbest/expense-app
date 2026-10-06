import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationResponse } from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { qk } from '@expense/api-client';
import { flushEvents, startSession, trackScreen } from '@/lib/analytics';
import { getNotifications, hrefForNotification } from '@/lib/push';
import { scheduleSync, syncNow } from '@/lib/sync';

/** Sync and analytics triggers: foreground, reconnect, and a slow heartbeat. */
export function useAppLifecycle(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startSession();
        void syncNow();
      } else if (state === 'background') {
        void flushEvents();
      }
    });
    let wasConnected = true;
    const unsubscribeNet = NetInfo.addEventListener((s) => {
      const connected = s.isConnected !== false;
      if (connected && !wasConnected) scheduleSync(500);
      wasConnected = connected;
    });
    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') {
        void syncNow();
        void flushEvents();
      }
    }, 60_000);
    return () => {
      appState.remove();
      unsubscribeNet();
      clearInterval(heartbeat);
    };
  }, [active]);
}

const ID_SEGMENT = /^([0-9a-f]{24}|[0-9a-f-]{36}|[A-Z0-9]{6,12})$/i;

export function useScreenTracking(active: boolean) {
  const pathname = usePathname();
  useEffect(() => {
    if (!active) return;
    const screen = pathname
      .split('/')
      .map((s) => (ID_SEGMENT.test(s) && s !== 'new' ? ':id' : s))
      .join('/');
    trackScreen(screen || '/');
  }, [pathname, active]);
}

/** Opens the right screen when a push is tapped and refreshes data when one arrives. */
export function useNotificationRouting(active: boolean) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!active || !Notifications) return;
    const open = (response: NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;
      router.push(hrefForNotification(response.notification.request.content.data));
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [active, router]);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!active || !Notifications) return;
    const sub = Notifications.addNotificationReceivedListener((n) => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications });
      const roomId = n.request.content.data?.roomId;
      if (typeof roomId === 'string') void queryClient.invalidateQueries({ queryKey: qk.room(roomId) });
      if (n.request.content.data?.inviteId) void queryClient.invalidateQueries({ queryKey: qk.myInvites });
      if (n.request.content.data?.recurringId) void syncNow();
    });
    return () => sub.remove();
  }, [active, queryClient]);
}
