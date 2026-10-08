import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { qk } from '@expense/api-client';
import { formatMoney, type RoomExpenseDTO } from '@expense/shared';
import { Money } from '@/components/finance';
import {
  AppText,
  Appear,
  Avatar,
  Backdrop,
  Banner,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ErrorState,
  Fab,
  Icon,
  IconButton,
  linearGradient,
  Loading,
  ProgressBar,
  Row,
  Segmented,
} from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { useRoom } from '@/hooks/rooms';
import { api, errorMessage } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

type Tab = 'expenses' | 'balances';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { byId } = useCategories();
  const r = useRoom(id);
  const [tab, setTab] = useState<Tab>('expenses');
  const insets = useSafeAreaInsets();
  const isSplit = r.room?.type === 'split';

  const expenses = useInfiniteQuery({
    queryKey: qk.roomExpenses(id),
    queryFn: ({ pageParam }) => api.rooms.expenses(id, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(r.room),
  });
  const balances = useQuery({ queryKey: qk.roomBalances(id), queryFn: () => api.rooms.balances(id), enabled: isSplit });
  const budget = useQuery({ queryKey: qk.roomBudget(id), queryFn: () => api.rooms.budgetSummary(id), enabled: r.room?.type === 'shared_budget' });

  const items = useMemo(() => expenses.data?.pages.flatMap((p) => p.items) ?? [], [expenses.data]);

  const refresh = () => {
    void r.refetch();
    void expenses.refetch();
    if (isSplit) void balances.refetch();
    else void budget.refetch();
  };

  if (r.isLoading) return <Loading />;
  if (r.error || !r.room) return <ErrorState message={r.error ? errorMessage(r.error) : 'Room not found'} onRetry={() => void r.refetch()} />;

  const room = r.room;
  const inviteButton = r.canInvite ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Invite people"
      hitSlop={8}
      onPress={() => router.push({ pathname: '/room/[id]/invite', params: { id } })}
      style={({ pressed }) => ({
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.22)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name="account-plus-outline" size={18} color={colors.onPrimary} />
    </Pressable>
  ) : null;

  const listBottom = (r.canAddExpense ? 96 : spacing.lg) + insets.bottom;
  const hero = {
    borderRadius: radius.xl,
    padding: spacing.lg + 2,
    gap: spacing.xs,
    overflow: 'hidden' as const,
    backgroundColor: colors.primary,
    experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
    boxShadow: `0 16px 36px ${colors.primaryGlow}`,
  };
  const heroOrb = <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.14)', top: -90, right: -60 }} />;

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      {r.archived ? <Banner tone="warning" icon="archive-outline" text="This room is archived. It's read-only until a manager restores it." /> : null}
      {isSplit ? (
        <Appear style={hero}>
          {heroOrb}
          <AppText color={colors.onPrimary} style={{ opacity: 0.85, fontWeight: '600' }}>
            Total spent
          </AppText>
          <AppText variant="display" color={colors.onPrimary} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(balances.data?.totalSpent ?? 0, room.currency)}
          </AppText>
          <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, marginTop: spacing.xs }}>
            <AppText variant="caption" color={colors.onPrimary} style={{ fontWeight: '700' }}>
              Your spending {formatMoney(balances.data?.spentBy[r.me] ?? 0, room.currency)}
            </AppText>
          </View>
          {inviteButton}
        </Appear>
      ) : (
        <Appear style={hero}>
          {heroOrb}
          <AppText color={colors.onPrimary} style={{ opacity: 0.85, fontWeight: '600' }}>
            Spent this period
          </AppText>
          <AppText variant="display" color={colors.onPrimary} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(budget.data?.budget?.spent ?? budget.data?.totalSpent ?? 0, room.currency)}
          </AppText>
          {budget.data?.budget ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
              <ProgressBar percent={budget.data.budget.percent} color={colors.onPrimary} />
              <AppText variant="caption" color={colors.onPrimary} style={{ fontWeight: '600', opacity: 0.9 }}>
                {budget.data.budget.remaining >= 0
                  ? `${formatMoney(budget.data.budget.remaining, room.currency)} left of ${formatMoney(budget.data.budget.amount, room.currency)}`
                  : `${formatMoney(-budget.data.budget.remaining, room.currency)} over budget`}
              </AppText>
            </View>
          ) : r.isManager ? (
            <Button
              title="Set a budget"
              compact
              variant="glass"
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
              onPress={() => router.push({ pathname: '/room/[id]/settings', params: { id } })}
            />
          ) : (
            <AppText variant="caption" color={colors.onPrimary} style={{ opacity: 0.85 }}>
              No budget set yet.
            </AppText>
          )}
          {inviteButton}
        </Appear>
      )}
      <Segmented
        options={[
          { value: 'expenses', label: 'Expenses' },
          { value: 'balances', label: isSplit ? 'Balances' : 'Summary' },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <Stack.Screen
        options={{
          title: room.name,
          headerRight: () => (
            <Row>
              <IconButton icon="account-multiple-outline" label="Members" onPress={() => router.push({ pathname: '/room/[id]/members', params: { id } })} />
              <IconButton icon="cog-outline" label="Settings" onPress={() => router.push({ pathname: '/room/[id]/settings', params: { id } })} />
            </Row>
          ),
        }}
      />
      {tab === 'expenses' ? (
        <FlatList
          data={items}
          keyExtractor={(e) => e._id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: listBottom }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={expenses.isRefetching} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={() => expenses.hasNextPage && void expenses.fetchNextPage()}
          ListEmptyComponent={expenses.isLoading ? <Loading /> : <EmptyState icon="receipt" title="No expenses yet" message="Add the first one with the + button." />}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ExpenseRow
                expense={item}
                me={r.me}
                name={r.name}
                isSplit={isSplit}
                currency={room.currency}
                category={item.categoryId ? byId.get(item.categoryId) : undefined}
                onPress={() => router.push({ pathname: '/room/[id]/expense-detail', params: { id, expenseId: item._id } })}
              />
            </Appear>
          )}
        />
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: listBottom }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {header}
              {isSplit ? <BalancesView roomId={id} name={r.name} avatar={r.avatar} me={r.me} currency={room.currency} /> : <SummaryView roomId={id} name={r.name} avatar={r.avatar} currency={room.currency} />}
            </>
          }
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      )}
      {r.canAddExpense ? <Fab label="Add expense" safeBottom onPress={() => router.push({ pathname: '/room/[id]/expense', params: { id } })} /> : null}
    </View>
  );
}

function ExpenseRow({
  expense,
  me,
  name,
  isSplit,
  currency,
  category,
  onPress,
}: {
  expense: RoomExpenseDTO;
  me: string;
  name: (userId: string) => string;
  isSplit: boolean;
  currency: string;
  category?: { icon: string; color: string; name: string };
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const payers = expense.paidBy.map((p) => name(p.userId)).join(', ');
  const myShare = expense.splits.find((s) => s.userId === me)?.amount ?? 0;
  const myPaid = expense.paidBy.find((p) => p.userId === me)?.amount ?? 0;
  const net = myPaid - myShare;
  return (
    <Card onPress={onPress} style={{ marginBottom: spacing.sm }}>
      <Row gap={spacing.md}>
        <CategoryIcon icon={category?.icon ?? 'receipt'} color={category?.color ?? colors.primary} size={44} square />
        <View style={{ flex: 1 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
            {expense.note || category?.name || 'Expense'}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {payers} paid
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Money amount={expense.amount} currency={currency} variant="body" />
          {isSplit && expense.settledAt ? (
            <AppText variant="caption" color={colors.success}>
              SETTLED
            </AppText>
          ) : isSplit && net !== 0 ? (
            <AppText variant="caption" color={net > 0 ? colors.success : colors.danger}>
              {formatMoney(Math.abs(net), currency)}
            </AppText>
          ) : isSplit && myShare === 0 && myPaid === 0 ? (
            <AppText variant="caption" muted>
              not involved
            </AppText>
          ) : null}
        </View>
      </Row>
    </Card>
  );
}

type AvatarFor = (id: string) => { name: string; uri?: string };

function BalancesView({ roomId, name, avatar, me, currency }: { roomId: string; name: (id: string) => string; avatar: AvatarFor; me: string; currency: string }) {
  const { colors } = useTheme();
  const balances = useQuery({ queryKey: qk.roomBalances(roomId), queryFn: () => api.rooms.balances(roomId) });
  if (balances.isLoading) return <Loading />;
  if (!balances.data) return null;
  const { debts, net, simplified } = balances.data;
  const entries = Object.entries(net).filter(([, v]) => v !== 0).sort((a, b) => b[1] - a[1]);
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <AppText variant="label" muted>
          {simplified ? 'Suggested payments' : 'Who owes whom'}
        </AppText>
        {debts.length ? (
          debts.map((d) => (
            <Row key={`${d.from}-${d.to}`} style={{ paddingVertical: 6 }}>
              <AppText style={{ flex: 1 }}>
                <AppText style={{ fontWeight: d.from === me ? '700' : '400' }}>{name(d.from)}</AppText>
                {d.from === me ? ' owe ' : ' owes '}
                <AppText style={{ fontWeight: d.to === me ? '700' : '400' }}>{name(d.to)}</AppText>
              </AppText>
              <AppText style={{ fontWeight: '600' }} color={d.from === me ? colors.danger : d.to === me ? colors.success : undefined}>
                {formatMoney(d.amount, currency)}
              </AppText>
            </Row>
          ))
        ) : (
          <AppText muted>Everyone is settled up.</AppText>
        )}
      </Card>
      {entries.length ? (
        <Card>
          <AppText variant="label" muted>
            Net balances
          </AppText>
          {entries.map(([userId, value]) => (
            <Row key={userId} style={{ paddingVertical: 4 }}>
              <Avatar {...avatar(userId)} size={28} />
              <AppText style={{ flex: 1 }}>{name(userId)}</AppText>
              <Money
                amount={Math.abs(value)}
                currency={currency}
                variant="body"
                color={value > 0 ? colors.success : value < 0 ? colors.danger : undefined}
              />
            </Row>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function SummaryView({ roomId, name, avatar, currency }: { roomId: string; name: (id: string) => string; avatar: AvatarFor; currency: string }) {
  const { colors } = useTheme();
  const { byId } = useCategories();
  const summary = useQuery({ queryKey: qk.roomBudget(roomId), queryFn: () => api.rooms.budgetSummary(roomId) });
  if (summary.isLoading) return <Loading />;
  if (!summary.data) return null;
  const total = summary.data.totalSpent || 1;
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <AppText variant="label" muted>
          Who paid
        </AppText>
        {summary.data.byMember.map((m) => (
          <View key={m.userId} style={{ gap: 4, paddingVertical: 4 }}>
            <Row>
              <Avatar {...avatar(m.userId)} size={28} />
              <AppText style={{ flex: 1 }}>{name(m.userId)}</AppText>
              <Money amount={m.paid} currency={currency} variant="body" />
            </Row>
            <ProgressBar percent={(m.paid / total) * 100} color={colors.primary} />
          </View>
        ))}
      </Card>
      {summary.data.byCategory.length ? (
        <Card>
          <AppText variant="label" muted>
            By category
          </AppText>
          {summary.data.byCategory.map((c) => (
            <Row key={c.categoryId ?? 'none'} style={{ paddingVertical: 4 }}>
              <AppText style={{ flex: 1 }}>{(c.categoryId && byId.get(c.categoryId)?.name) || 'Uncategorized'}</AppText>
              <Money amount={c.total} currency={currency} variant="body" />
            </Row>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
