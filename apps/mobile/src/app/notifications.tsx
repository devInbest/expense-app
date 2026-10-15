import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import type { NotificationDTO } from '@expense/shared';
import { AppText, Appear, Backdrop, Button, Card, CategoryIcon, EmptyState, ErrorState, Loading, RevealScope, Row, useRevealList } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDay, timeAgo } from '@/lib/dates';
import { notificationKind } from '@/lib/notifications';
import { spacing, useTheme } from '@/theme';

type ListRow = { kind: 'header'; key: string; title: string } | { kind: 'item'; key: string; item: NotificationDTO };

export default function Notifications() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const unread = list.data?.pages[0]?.unread ?? 0;

  const rows = useMemo(() => {
    const out: ListRow[] = [];
    let day = '';
    for (const item of items) {
      const label = formatDay(item.createdAt);
      if (label !== day) {
        day = label;
        out.push({ kind: 'header', key: `h-${label}`, title: label });
      }
      out.push({ kind: 'item', key: item._id, item });
    }
    return out;
  }, [items]);

  useEffect(() => {
    // Opening the inbox clears the badge after a short delay so the unread dots are still visible.
    if (!unread) return;
    const t = setTimeout(() => markRead.mutate(undefined), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const open = (n: NotificationDTO) => {
    if (!n.readAt) markRead.mutate([n._id]);
    router.push({ pathname: '/notification/[id]', params: { id: n._id } });
  };

  if (list.isLoading || list.error)
    return (
      <View style={{ flex: 1 }}>
        <Backdrop />
        {list.error ? <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} /> : <Loading />}
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Stack.Screen
        options={{
          headerRight: () =>
            unread ? <Button title="Mark all read" icon="check-all" compact variant="secondary" onPress={() => markRead.mutate(undefined)} /> : null,
        }}
      />
      <RevealScope scrollY={reveal.scrollY}>
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
          onScroll={reveal.onScroll}
          scrollEventThrottle={reveal.scrollEventThrottle}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={() => list.hasNextPage && void list.fetchNextPage()}
          ListEmptyComponent={<EmptyState icon="bell-outline" title="Nothing is Here" message="You're all caught up." />}
          renderItem={({ item: row, index }) =>
            row.kind === 'header' ? (
              <Appear index={index}>
                <AppText variant="label" muted style={{ paddingHorizontal: spacing.xs, marginTop: index ? spacing.md : 0 }}>
                  {row.title}
                </AppText>
              </Appear>
            ) : (
              <Appear index={index}>
                <NotificationCard item={row.item} onPress={() => open(row.item)} />
              </Appear>
            )
          }
        />
      </RevealScope>
    </View>
  );
}

function NotificationCard({ item, onPress }: { item: NotificationDTO; onPress: () => void }) {
  const { colors } = useTheme();
  const kind = notificationKind(item.type, colors);
  const unread = !item.readAt;
  const tint = kind.color;
  return (
    <Card
      onPress={onPress}
      style={[{ padding: spacing.md }, unread && { borderColor: `${colors.primary}40`, boxShadow: `0 10px 30px ${colors.glowSoft}` }]}>
      <Row style={{ alignItems: 'flex-start' }} gap={spacing.md}>
        <View style={{ opacity: unread ? 1 : 0.7 }}>
          <CategoryIcon icon={kind.icon} color={tint} size={40} square />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Row gap={spacing.sm}>
            <AppText variant="subheading" numberOfLines={1} style={{ flex: 1, fontWeight: unread ? '700' : '500' }}>
              {item.title}
            </AppText>
            <AppText variant="caption" color={unread ? colors.primary : colors.textSubtle} style={{ fontWeight: unread ? '600' : '400' }}>
              {timeAgo(item.createdAt)}
            </AppText>
          </Row>
          <AppText variant="caption" muted numberOfLines={3} style={{ lineHeight: 18 }}>
            {item.body}
          </AppText>
        </View>
        {unread ? (
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: colors.primary, boxShadow: `0 0 8px ${colors.glow}` }} />
        ) : null}
      </Row>
    </Card>
  );
}
