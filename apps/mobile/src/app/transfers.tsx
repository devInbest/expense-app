import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import { Money, TransferRow } from '@/components/finance';
import { AppText, Appear, Card, Divider, EmptyState, ErrorState, Fab, Glass, IconButton, Loading, Row, Screen } from '@/components/ui';
import { useAccounts } from '@/lib/accounts';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDay, formatMonth, iso, monthRange } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

/** Self transfers between cash, bank accounts and cards, month by month. */
export default function Transfers() {
  const user = useUser();
  const { colors } = useTheme();
  const accounts = useAccounts();
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const month = monthRange(new Date(), offset);
  const range = iso(month);
  const transfers = useQuery({
    queryKey: qk.transfers(range.from, range.to),
    queryFn: () => api.transfers.list({ from: range.from, to: range.to }),
  });

  const list = transfers.data;
  const total = useMemo(() => (list ?? []).filter((t) => t.currency === user.defaultCurrency).reduce((s, t) => s + t.amount, 0), [list, user.defaultCurrency]);
  const days = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof list>>();
    for (const t of list ?? []) {
      const key = new Date(t.occurredAt).toDateString();
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, title: formatDay(key), items }));
  }, [list]);

  const onRefresh = async () => {
    setRefreshing(true);
    await transfers.refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        edges={['bottom']}
        contentStyle={{ flexGrow: 1, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <Appear>
          <Glass blur rounded={radius.xl} style={{ padding: spacing.md, gap: spacing.sm }}>
            <Row>
              <IconButton icon="chevron-left" label="Previous month" onPress={() => setOffset((o) => o - 1)} />
              <AppText variant="subheading" style={{ flex: 1, textAlign: 'center' }}>
                {formatMonth(month.from)}
              </AppText>
              <View pointerEvents={offset >= 0 ? 'none' : 'auto'} style={{ opacity: offset >= 0 ? 0.3 : 1 }}>
                <IconButton icon="chevron-right" label="Next month" onPress={() => setOffset((o) => Math.min(0, o + 1))} />
              </View>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText muted>
                {list?.length ?? 0} {list?.length === 1 ? 'transfer' : 'transfers'}
              </AppText>
              <Money amount={total} currency={user.defaultCurrency} variant="subheading" />
            </Row>
          </Glass>
        </Appear>

        {transfers.isPending ? (
          <Loading />
        ) : transfers.isError ? (
          <ErrorState message={errorMessage(transfers.error)} onRetry={() => void transfers.refetch()} />
        ) : !days.length ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="swap-horizontal"
              title="No self transfers"
              message={accounts.length ? 'Move money between cash, your bank accounts and cards.' : 'Add your bank accounts and cards in Profile → Accounts, then move money between them and cash.'}
            />
          </View>
        ) : (
          days.map((day, i) => (
            <Appear key={day.key} index={i + 1}>
              <AppText variant="label" muted style={{ marginBottom: spacing.xs }}>
                {day.title}
              </AppText>
              <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
                {day.items.map((t, j) => (
                  <View key={t._id}>
                    {j ? <Divider /> : null}
                    <TransferRow transfer={t} accounts={accounts} onPress={() => router.push({ pathname: '/transfer/[id]', params: { id: t._id } })} />
                  </View>
                ))}
              </Card>
            </Appear>
          ))
        )}
      </Screen>
      <Fab label="Add self transfer" icon="swap-horizontal" safeBottom onPress={() => router.push({ pathname: '/transfer/[id]', params: { id: 'new' } })} />
    </View>
  );
}
