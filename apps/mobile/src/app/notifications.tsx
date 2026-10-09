import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import type { NotificationDTO } from '@expense/shared';
import { AppText, Appear, Backdrop, Button, Card, EmptyState, ErrorState, Icon, Loading, RevealScope, Row, useRevealList } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/dates';
import { hrefForNotification } from '@/lib/push';
import { spacing, useTheme } from '@/theme';

const ICONS: Record<string, string> = {
  room_invite: 'email-outline',
  room_joined: 'account-plus-outline',
  room_expense_added: 'receipt',
  room_expense_updated: 'pencil-outline',
  room_expense_deleted: 'delete-outline',
  settlement_recorded: 'handshake-outline',
  settlement_confirmed: 'check-decagram-outline',
  budget_threshold: 'alert-outline',
  recurring_created: 'calendar-sync',
  member_removed: 'account-remove-outline',
  room_deleted: 'delete-outline',
  broadcast: 'bullhorn-outline',
};

export default function Notifications() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const reveal = useRevealList();
  const list = useInfiniteQuery({
    queryKey: [...qk.notifications, 'list'],
    queryFn: ({ pageParam }) => api.notifications.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.notifications.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = list.data?.pages[0]?.unread ?? 0;

  useEffect(() => {
    // Opening the inbox clears the badge after a short delay so the unread dots are still visible.
    if (!unread) return;
    const t = setTimeout(() => markRead.mutate(undefined), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const open = (n: NotificationDTO) => {
    if (!n.readAt) markRead.mutate([n._id]);
    router.push(hrefForNotification(n.data));
  };

  if (list.isLoading) return <Loading />;
  if (list.error) return <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Stack.Screen
        options={{ headerRight: () => (unread ? <Button title="Mark all read" compact variant="ghost" onPress={() => markRead.mutate(undefined)} /> : null) }}
      />
      <RevealScope scrollY={reveal.scrollY}>
        <FlatList
          data={items}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          onScroll={reveal.onScroll}
          scrollEventThrottle={reveal.scrollEventThrottle}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
          ListEmptyComponent={<EmptyState icon="bell-outline" title="No notifications" message="Room activity and budget alerts show up here." />}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <Card onPress={() => open(item)} style={[{ padding: spacing.md }, !item.readAt && { backgroundColor: colors.primaryMuted }]}>
                <Row style={{ alignItems: 'flex-start' }} gap={spacing.md}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 13,
                      backgroundColor: item.readAt ? colors.surfaceAlt : `${colors.primary}22`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={ICONS[item.type] ?? 'bell-outline'} size={20} color={item.readAt ? colors.textMuted : colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="subheading" style={{ fontWeight: item.readAt ? '500' : '700' }}>
                      {item.title}
                    </AppText>
                    <AppText muted>{item.body}</AppText>
                    <AppText variant="caption" color={colors.textSubtle} style={{ marginTop: 2 }}>
                      {timeAgo(item.createdAt)}
                    </AppText>
                  </View>
                  {!item.readAt ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} /> : null}
                </Row>
              </Card>
            </Appear>
          )}
        />
      </RevealScope>
    </View>
  );
}
