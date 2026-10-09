import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import type { RoomSpendingItemDTO, TransactionType } from '@expense/shared';
import { Money, RoomExpenseRow, TransactionRow } from '@/components/finance';
import { SyncBanner } from '@/components/SyncBanner';
import {
  AppText,
  Appear,
  Backdrop,
  Chip,
  EmptyState,
  Fab,
  Glass,
  Icon,
  IconButton,
  linearGradient,
  MOTION,
  RevealScope,
  Row,
  useRevealList,
  useTabBarInset,
} from '@/components/ui';
import { useCategories, useLocalQuery, useSpendingSummary } from '@/hooks/data';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDay, formatMonth, iso, monthRange } from '@/lib/dates';
import { syncNow } from '@/lib/sync';
import { listTransactions, type LocalTransaction } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';

const PAGE = 100;

/** Seasonal icon per month, January first. */
const MONTH_ICON = [
  'snowflake',
  'heart-outline',
  'flower-outline',
  'weather-sunny',
  'white-balance-sunny',
  'fire',
  'weather-pouring',
  'umbrella-outline',
  'leaf',
  'leaf-maple',
  'weather-windy',
  'gift-outline',
];

function CollapseChevron({ collapsed, color }: { collapsed: boolean; color: string }) {
  const progress = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(collapsed ? 1 : 0, MOTION));
  }, [collapsed, progress]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.get() * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="chevron-up" size={20} color={color} />
    </Animated.View>
  );
}

/** Day header card; its bottom corners round off in step with the rows closing beneath it. */
function DayHeaderShape({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const progress = useSharedValue(collapsed ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(collapsed ? 1 : 0, MOTION));
  }, [collapsed, progress]);
  const corners = useAnimatedStyle(() => ({
    borderBottomLeftRadius: radius.lg * progress.get(),
    borderBottomRightRadius: radius.lg * progress.get(),
  }));
  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          backgroundColor: colors.glassStrong,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        corners,
      ]}>
      {children}
    </Animated.View>
  );
}

/** Animates its children's height and opacity between open and closed. */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const height = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, MOTION));
  }, [open, progress]);
  const style = useAnimatedStyle(() => ({ height: height.get() * progress.get(), opacity: progress.get() }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      {/* Absolutely positioned so the content keeps its natural height while the wrapper shrinks. */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }} onLayout={(e) => height.set(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  );
}

function MonthCard({ from, to, count }: { from: Date; to: Date; count: number }) {
  const { colors } = useTheme();
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const day = new Date().getDate();
  const left = totalDays - day;
  return (
    <View
      style={{
        borderRadius: radius.lg,
        padding: spacing.md + 2,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
        boxShadow: `0 12px 30px ${colors.primaryGlow}`,
      }}>
      <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)', top: -80, right: -40 }} />
      <Row gap={spacing.md}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={MONTH_ICON[from.getMonth()]!} size={24} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" color={colors.onPrimary}>
            {formatMonth(from)}
          </AppText>
          <AppText variant="caption" color={colors.onPrimary} numberOfLines={1} style={{ opacity: 0.85 }}>
            {count} {count === 1 ? 'Transaction' : 'Transactions'}
          </AppText>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
          <AppText variant="caption" color={colors.primaryDeep} style={{ fontWeight: '800' }}>
            {left === 0 ? 'Last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}
          </AppText>
        </View>
      </Row>
    </View>
  );
}

function StatTile({ label, icon, tone, children }: { label: string; icon: string; tone: string; children: React.ReactNode }) {
  return (
    <Glass style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      <Row gap={spacing.sm}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${tone}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={tone} />
        </View>
        <AppText variant="caption" muted style={{ fontWeight: '600' }}>
          {label}
        </AppText>
      </Row>
      {children}
    </Glass>
  );
}

type FeedItem = { kind: 'tx'; key: string; at: string; tx: LocalTransaction } | { kind: 'room'; key: string; at: string; room: RoomSpendingItemDTO };

export default function Transactions() {
  const user = useUser();
  const { colors } = useTheme();
  const tabInset = useTabBarInset();
  const reveal = useRevealList();
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
      data,
    }));
  }, [items, roomItems.data, type]);

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
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Appear>
            <MonthCard from={month.from} to={month.to} count={summary?.count ?? 0} />
          </Appear>
          <Appear index={1}>
            <Row gap={spacing.md}>
              <StatTile label="Income" icon="arrow-bottom-left" tone={colors.income}>
                <Money amount={summary?.income ?? 0} currency={user.defaultCurrency} color={colors.income} />
              </StatTile>
              <StatTile label="Spent" icon="arrow-top-right" tone={colors.primary}>
                <Money amount={summary?.expense ?? 0} currency={user.defaultCurrency} type="expense" />
              </StatTile>
            </Row>
          </Appear>
          <Appear index={2}>
            <Row>
              <Chip label="All" selected={!type} onPress={() => setType(undefined)} />
              <Chip label="Expenses" selected={type === 'expense'} onPress={() => setType('expense')} />
              <Chip label="Income" selected={type === 'income'} onPress={() => setType('income')} />
              <View style={{ flex: 1 }} />
              <IconButton glass icon="trash-can-outline" label="Bin" color={colors.danger} onPress={() => router.push('/bin')} />
            </Row>
          </Appear>
          <SyncBanner />
        </View>
        <RevealScope scrollY={reveal.scrollY}>
          <SectionList
            sections={sections}
            keyExtractor={(i) => i.key}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: tabInset + 80 }}
            showsVerticalScrollIndicator={false}
            onScroll={reveal.onScroll}
            scrollEventThrottle={reveal.scrollEventThrottle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
            stickySectionHeadersEnabled={false}
            extraData={collapsed}
            onEndReached={() => {
              if ((items?.length ?? 0) >= limit) setLimit((l) => l + PAGE);
            }}
            renderSectionHeader={({ section }) => {
              const isCollapsed = collapsed.has(section.key);
              return (
                <Appear>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isCollapsed }}
                    accessibilityLabel={`${section.title}, ${isCollapsed ? 'expand' : 'collapse'}`}
                    onPress={() => toggleDay(section.key)}
                    style={({ pressed }) => ({ marginTop: spacing.md, opacity: pressed ? 0.7 : 1 })}>
                    <DayHeaderShape collapsed={isCollapsed}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                      <AppText variant="label" style={{ flex: 1 }}>
                        {section.title}
                      </AppText>
                      {section.total > 0 ? <Money amount={section.total} currency={user.defaultCurrency} variant="body" type="expense" /> : null}
                      <CollapseChevron collapsed={isCollapsed} color={colors.textMuted} />
                    </DayHeaderShape>
                  </Pressable>
                </Appear>
              );
            }}
            renderItem={({ item, index, section }) => {
              const last = index === section.data.length - 1;
              return (
                <Collapsible open={!collapsed.has(section.key)}>
                  <Appear
                    style={{
                      paddingHorizontal: spacing.md,
                      backgroundColor: colors.glass,
                      borderLeftWidth: 1,
                      borderRightWidth: 1,
                      borderBottomWidth: last ? 1 : 0,
                      borderColor: colors.glassBorder,
                      borderBottomLeftRadius: last ? radius.lg : 0,
                      borderBottomRightRadius: last ? radius.lg : 0,
                    }}>
                    {item.kind === 'room' ? (
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
                    )}
                  </Appear>
                </Collapsible>
              );
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <EmptyState icon="text-box-search-outline" title={type ? 'No matches' : 'Nothing this month'} />
              </View>
            }
          />
        </RevealScope>
        <Fab label="Add transaction" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} />
      </SafeAreaView>
    </View>
  );
}
