import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import { Money, RoomExpenseRow, TransactionRow } from '@/components/finance';
import { BudgetsCard } from '@/components/BudgetsCard';
import { SpendCard } from '@/components/SpendCard';
import { SyncBanner } from '@/components/SyncBanner';
import {
  AppText,
  Avatar,
  Banner,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  Fab,
  IconButton,
  Row,
  Screen,
  Section,
} from '@/components/ui';
import { UNKNOWN_CATEGORY, useCategories, useLocalQuery, useSpendingSummary } from '@/hooks/data';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { iso, monthRange } from '@/lib/dates';
import { kv, PENDING_JOIN_KEY } from '@/lib/db';
import { syncNow } from '@/lib/sync';
import { setThemeMode } from '@/lib/themeMode';
import { listTransactions } from '@/lib/transactions';
import { spacing, useTheme } from '@/theme';

const RECENT = 5;

export default function Home() {
  const user = useUser();
  const { colors, dark } = useTheme();
  const { byId } = useCategories();
  const [refreshing, setRefreshing] = useState(false);
  const month = monthRange();
  const range = iso(month);

  const { data: summary, reload: reloadSummary } = useSpendingSummary(range.from, range.to);
  const { data: localRecent } = useLocalQuery(() => listTransactions({ limit: RECENT }), []);
  const roomRecent = useQuery({
    queryKey: qk.roomSpendingItems(range.from, range.to),
    queryFn: () => api.rooms.spendingItems({ from: range.from, to: range.to }),
    staleTime: 60_000,
  });
  const recent = useMemo(() => {
    if (!localRecent) return undefined;
    const items = [
      ...localRecent.map((tx) => ({ kind: 'tx' as const, key: tx.clientId, at: tx.occurredAt, tx })),
      ...(roomRecent.data ?? []).map((room) => ({ kind: 'room' as const, key: `room-${room.expenseId}`, at: room.occurredAt, room })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT);
  }, [localRecent, roomRecent.data]);
  const budgets = useQuery({ queryKey: qk.budgets, queryFn: api.budgets.list });
  const invites = useQuery({ queryKey: qk.myInvites, queryFn: api.invites.mine });
  const notifications = useQuery({ queryKey: qk.notifications, queryFn: () => api.notifications.list() });

  useEffect(() => {
    // A join link opened before sign-in is resumed here.
    void kv.get<string>(PENDING_JOIN_KEY).then((code) => {
      if (!code) return;
      void kv.remove(PENDING_JOIN_KEY);
      router.push({ pathname: '/join/[code]', params: { code } });
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    reloadSummary();
    await Promise.all([syncNow(), roomRecent.refetch(), budgets.refetch(), invites.refetch(), notifications.refetch()]);
    setRefreshing(false);
  };

  const overall = budgets.data?.find((b) => !b.categoryId && b.period === 'monthly') ?? budgets.data?.find((b) => !b.categoryId);
  const categoryBudgets = (budgets.data ?? []).filter((b) => b.categoryId).sort((a, b) => b.percent - a.percent).slice(0, 3);
  const unread = notifications.data?.unread ?? 0;
  const firstName = user.name.split(' ')[0];

  return (
    <View style={{ flex: 1 }}>
      <Screen
        contentStyle={recent && !recent.length ? { flexGrow: 1, paddingBottom: spacing.lg } : { paddingBottom: 88 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Row gap={spacing.md}>
          <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={6}>
            <Avatar name={user.name} uri={user.avatarUrl} size={44} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AppText muted>Hello{firstName ? `, ${firstName}` : ''}</AppText>
          </View>
          <IconButton
            icon={dark ? 'white-balance-sunny' : 'weather-night'}
            label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => setThemeMode(dark ? 'light' : 'dark')}
          />
          <View>
            <IconButton
              icon="bell-outline"
              label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              onPress={() => router.push('/notifications')}
            />
            {unread ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  backgroundColor: colors.danger,
                  borderWidth: 2,
                  borderColor: colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <AppText color="#fff" style={{ fontSize: 10, lineHeight: 12, fontWeight: '700' }}>
                  {unread > 9 ? '9+' : unread}
                </AppText>
              </View>
            ) : null}
          </View>
        </Row>

        <SyncBanner />

        {invites.data?.length ? (
          <Banner
            icon="email-outline"
            text={`You have ${invites.data.length} room invite${invites.data.length > 1 ? 's' : ''}`}
            onPress={() => router.push('/invites')}
          />
        ) : null}

        <SpendCard spent={summary?.expense ?? 0} income={summary?.income ?? 0} currency={user.defaultCurrency} month={month.from} />

        {budgets.data ? (
          <BudgetsCard overall={overall} categories={categoryBudgets} categoryById={byId} currency={user.defaultCurrency} />
        ) : null}

        {recent?.length ? (
          <Section title="Recent" action={<Button title="See all" variant="ghost" compact onPress={() => router.push('/transactions')} />}>
            <Card>
              {recent.map((item) =>
                item.kind === 'room' ? (
                  <RoomExpenseRow
                    key={item.key}
                    item={item.room}
                    currency={user.defaultCurrency}
                    category={item.room.categoryId ? byId.get(item.room.categoryId) : undefined}
                    onPress={() => router.push({ pathname: '/room/[id]/expense-detail', params: { id: item.room.roomId, expenseId: item.room.expenseId } })}
                  />
                ) : (
                  <TransactionRow
                    key={item.key}
                    tx={item.tx}
                    category={byId.get(item.tx.categoryId)}
                    onPress={() => router.push({ pathname: '/transaction/view/[id]', params: { id: item.tx.clientId } })}
                  />
                ),
              )}
            </Card>
          </Section>
        ) : recent ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="receipt" title="No expenses yet" />
          </View>
        ) : null}

        {summary && summary.byCategory.length > 0 ? (
          <Section title="Top spends" action={<Button title="See all" variant="ghost" compact onPress={() => router.navigate('/insights')} />}>
            <Card>
              {summary.byCategory.slice(0, 5).map((c) => {
                const cat = byId.get(c.categoryId) ?? UNKNOWN_CATEGORY;
                return (
                  <Row key={c.categoryId} style={{ paddingVertical: spacing.xs }}>
                    <CategoryIcon icon={cat.icon} color={cat.color} size={40} square />
                    <AppText numberOfLines={1} style={{ flex: 1 }}>
                      {cat.name}
                    </AppText>
                    <Money amount={c.total} currency={user.defaultCurrency} variant="body" />
                  </Row>
                );
              })}
            </Card>
          </Section>
        ) : null}
      </Screen>
      <Fab label="Add transaction" onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} />
    </View>
  );
}
