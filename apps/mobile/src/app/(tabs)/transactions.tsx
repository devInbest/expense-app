import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, RefreshControl, SectionList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import type { RoomSpendingItemDTO, TransactionType } from '@expense/shared';
import { Money, RoomExpenseRow, TransactionRow } from '@/components/finance';
import { SyncBanner } from '@/components/SyncBanner';
import { AppText, Card, Chip, EmptyState, Fab, Icon, IconButton, Row } from '@/components/ui';
import { useCategories, useLocalQuery, useSpendingSummary } from '@/hooks/data';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDay, formatMonth, iso, monthRange } from '@/lib/dates';
import { syncNow } from '@/lib/sync';
import { listTransactions, type LocalTransaction } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';

const PAGE = 100;

/** Seasonal color and icon per month, January first. */
const MONTH_THEME: { color: string; icon: string }[] = [
  { color: '#4FA3E0', icon: 'snowflake' },
  { color: '#E85D9A', icon: 'heart-outline' },
  { color: '#5DBB63', icon: 'flower-outline' },
  { color: '#F2B33D', icon: 'weather-sunny' },
  { color: '#F28C38', icon: 'white-balance-sunny' },
  { color: '#E85A4F', icon: 'fire' },
  { color: '#2BA59B', icon: 'weather-pouring' },
  { color: '#3F7FD9', icon: 'umbrella-outline' },
  { color: '#8E6BD6', icon: 'leaf' },
  { color: '#D9822B', icon: 'leaf-maple' },
  { color: '#A0653A', icon: 'weather-windy' },
  { color: '#C93B4A', icon: 'gift-outline' },
];

function CollapseChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const [progress] = useState(() => new Animated.Value(collapsed ? 1 : 0));
  useEffect(() => {
    Animated.timing(progress, { toValue: collapsed ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [collapsed, progress]);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="chevron-up" size={20} color={color} />
    </Animated.View>
  );
}

function MonthCard({ from, to, count }: { from: Date; to: Date; count: number }) {
  const { colors } = useTheme();
  const { color, icon } = MONTH_THEME[from.getMonth()]!;
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const day = new Date().getDate();
  const left = totalDays - day;
  return (
    <View style={{ backgroundColor: `${color}26`, borderRadius: radius.lg, padding: spacing.md }}>
      <Row gap={spacing.md}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{formatMonth(from)}</AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {count} {count === 1 ? 'Transaction' : 'Transactions'}
          </AppText>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 }}>
          <AppText variant="caption" color={color} style={{ fontWeight: '700' }}>
            {left === 0 ? 'Last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}
          </AppText>
        </View>
      </Row>
    </View>
  );
}

type FeedItem = { kind: 'tx'; key: string; at: string; tx: LocalTransaction } | { kind: 'room'; key: string; at: string; room: RoomSpendingItemDTO };

export default function Transactions() {
  const user = useUser();
  const { colors, dark } = useTheme();
  const { byId } = useCategories();
  const [type, setType] = useState<TransactionType | undefined>();
  const [limit, setLimit] = useState(PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const month = monthRange(new Date(), 0);
  const range = iso(month);

  const { data: items } = useLocalQuery(
    () => listTransactions({ ...range, type, limit }),
    [range.from, type, limit],
  );
  const roomItems = useQuery({
    queryKey: qk.roomSpendingItems(range.from, range.to),
    queryFn: () => api.rooms.spendingItems({ from: range.from, to: range.to }),
    staleTime: 60_000,
  });
  const { data: summary, reload: reloadSummary } = useSpendingSummary(range.from, range.to);
  const sections = useMemo(() => {
    const rooms = type === 'income' ? [] : (roomItems.data ?? []);
    const feed: FeedItem[] = [
      ...(items ?? []).map((tx) => ({ kind: 'tx' as const, key: tx.clientId, at: tx.occurredAt, tx })),
      ...rooms.map((room) => ({ kind: 'room' as const, key: `room-${room.expenseId}`, at: room.occurredAt, room })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const groups = new Map<string, FeedItem[]>();
    for (const item of feed) {
      const key = new Date(item.at).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()].map(([key, data]) => ({
      key,
      title: formatDay(key),
      total: data.reduce((s, i) => s + (i.kind === 'room' ? i.room.share : i.tx.type === 'expense' ? i.tx.amount : 0), 0),
      data: collapsed.has(key) ? [] : data,
    }));
  }, [items, roomItems.data, type, collapsed]);

  const toggleDay = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const onRefresh = async () => {
    setRefreshing(true);
    reloadSummary();
    await Promise.all([syncNow(), roomItems.refetch()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <MonthCard from={month.from} to={month.to} count={summary?.count ?? 0} />
        <Row gap={spacing.md}>
          <Card style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="caption" muted>
              Income
            </AppText>
            <Money amount={summary?.income ?? 0} currency={user.defaultCurrency} color={colors.income} />
          </Card>
          <Card style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <AppText variant="caption" muted>
              Spent
            </AppText>
            <Money amount={summary?.expense ?? 0} currency={user.defaultCurrency} type="expense" />
          </Card>
        </Row>
        <Row>
          <Chip label="All" selected={!type} onPress={() => setType(undefined)} />
          <Chip label="Expenses" selected={type === 'expense'} onPress={() => setType('expense')} />
          <Chip label="Income" selected={type === 'income'} onPress={() => setType('income')} />
          <View style={{ flex: 1 }} />
          <IconButton icon="trash-can-outline" label="Bin" color={colors.danger} onPress={() => router.push('/bin')} />
        </Row>
        <SyncBanner />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: 88 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickySectionHeadersEnabled={false}
        onEndReached={() => {
          if ((items?.length ?? 0) >= limit) setLimit((l) => l + PAGE);
        }}
        renderSectionHeader={({ section }) => {
          const isCollapsed = collapsed.has(section.key);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !isCollapsed }}
              accessibilityLabel={`${section.title}, ${isCollapsed ? 'expand' : 'collapse'}`}
              onPress={() => toggleDay(section.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.xs,
                marginBottom: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 4,
                backgroundColor: dark ? '#262626' : '#EDEDED',
                opacity: pressed ? 0.7 : 1,
              })}>
              <AppText variant="label" style={{ flex: 1, fontWeight: '700' }}>
                {section.title}
              </AppText>
              {section.total > 0 ? <Money amount={section.total} currency={user.defaultCurrency} variant="subheading" type="expense" /> : null}
              <CollapseChevron collapsed={isCollapsed} color={colors.textMuted} />
            </Pressable>
          );
        }}
        renderItem={({ item }) =>
          item.kind === 'room' ? (
            <RoomExpenseRow
              item={item.room}
              currency={user.defaultCurrency}
              category={item.room.categoryId ? byId.get(item.room.categoryId) : undefined}
              onPress={() => router.push({ pathname: '/room/[id]/expense-detail', params: { id: item.room.roomId, expenseId: item.room.expenseId } })}
            />
          ) : (
            <TransactionRow
              tx={item.tx}
              category={byId.get(item.tx.categoryId)}
              onPress={() => router.push({ pathname: '/transaction/view/[id]', params: { id: item.tx.clientId } })}
            />
          )
        }
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="text-box-search-outline" title={type ? 'No matches' : 'Nothing this month'} />
          </View>
        }
      />
      <Fab label="Add transaction" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} />
    </SafeAreaView>
  );
}
