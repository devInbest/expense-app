import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import type { CursorPage, NotificationDTO } from '@expense/shared';
import { AppText, Appear, Backdrop, BackdropSlice, Button, Card, Divider, ErrorState, Glass, Icon, Loading, Row, Screen, TAB_BAR_FADE } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/dates';
import { notificationKind, notificationTarget } from '@/lib/notifications';
import { radius, spacing, useTheme } from '@/theme';

type InboxPages = InfiniteData<CursorPage<NotificationDTO> & { unread: number }>;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
      <AppText muted style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText style={{ flex: 2, textAlign: 'right', fontWeight: '500' }}>{value}</AppText>
    </Row>
  );
}

export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [screenHeight, setScreenHeight] = useState(0);

  const notification = useQuery({
    queryKey: [...qk.notifications, 'detail', id],
    queryFn: () => api.notifications.get(id),
    initialData: () =>
      queryClient
        .getQueryData<InboxPages>([...qk.notifications, 'list'])
        ?.pages.flatMap((p) => p.items)
        .find((n) => n._id === id),
  });
  const n = notification.data;

  useEffect(() => {
    if (!n || n.readAt) return;
    void api.notifications.markRead([n._id]).then(() => queryClient.invalidateQueries({ queryKey: qk.notifications }));
  }, [n, queryClient]);

  if (!n)
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        {notification.error ? (
          <ErrorState message={errorMessage(notification.error)} onRetry={() => void notification.refetch()} />
        ) : (
          <Loading />
        )}
      </View>
    );

  const kind = notificationKind(n.type, colors);
  const target = notificationTarget(n);
  const when = new Date(n.createdAt);

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Screen edges={[]} contentStyle={{ gap: spacing.md, paddingBottom: (target ? 54 + spacing.sm : 0) + TAB_BAR_FADE + spacing.lg + insets.bottom }}>
        <Appear>
          <Glass
            blur
            rounded={radius.xl}
            style={{
              gap: spacing.lg,
              padding: spacing.lg,
              paddingLeft: spacing.lg + 6,
              overflow: 'hidden',
              experimental_backgroundImage: `linear-gradient(135deg, ${kind.color}1F 0%, ${kind.color}00 60%)`,
            }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: kind.color }} />
            <Row gap={spacing.sm}>
              <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: kind.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={kind.icon} size={17} color={colors.onPrimary} />
              </View>
              <AppText variant="label" color={kind.color} style={{ flex: 1 }} numberOfLines={1}>
                {kind.label}
              </AppText>
              <AppText variant="caption" muted style={{ fontWeight: '600' }}>
                {timeAgo(n.createdAt)}
              </AppText>
            </Row>
            <AppText variant="title" style={{ fontSize: 26, lineHeight: 32 }}>
              {n.title}
            </AppText>
          </Glass>
        </Appear>

        <Appear index={1}>
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="subheading" style={{ marginBottom: spacing.xs }}>
              Message
            </AppText>
            <AppText style={{ lineHeight: 22 }} selectable>
              {n.body}
            </AppText>
            <Divider />
            <DetailRow label="Time" value={when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} />
            <DetailRow label="Date" value={when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />
          </Card>
        </Appear>
      </Screen>

      {target ? (
        <SafeAreaView
          edges={['bottom']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: TAB_BAR_FADE, paddingBottom: spacing.sm }}>
          <BackdropSlice fade={TAB_BAR_FADE} screenHeight={screenHeight || undefined} />
          <Button title={target.label} icon={target.icon} onPress={() => router.push(target.href)} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}
