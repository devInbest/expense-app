import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import { LIMITS } from '@expense/shared';
import { Money, TransferRow } from '@/components/finance';
import { AppText, Appear, Card, Divider, EmptyState, ErrorState, Fab, Icon, linearGradient, Loading, Row, Screen } from '@/components/ui';
import { useAccounts } from '@/lib/accounts';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { formatDay, formatMonth, iso, monthRange } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

/** Round frosted arrow on the gradient card. */
function NavButton({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}>
      <Icon name={icon} size={20} color={colors.onPrimary} />
    </Pressable>
  );
}

/** Month summary in the app's gradient style, matching the Activity month card. */
function MonthCard({
  month,
  count,
  total,
  currency,
  canGoNext,
  canGoPrev,
  onPrev,
  onNext,
}: {
  month: Date;
  count: number;
  total: number;
  currency: string;
  canGoNext: boolean;
  canGoPrev: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.xl,
        padding: spacing.md + 2,
        gap: spacing.lg,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
        boxShadow: `0 12px 30px ${colors.primaryGlow}`,
      }}>
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.14)', top: -90, right: -50 }} />
      <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -60, left: -30 }} />

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
          <Icon name="swap-horizontal" size={24} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading" color={colors.onPrimary} numberOfLines={1}>
            {formatMonth(month)}
          </AppText>
          <AppText variant="caption" color={colors.onPrimary} style={{ opacity: 0.85 }}>
            {count} {count === 1 ? 'Transfer' : 'Transfers'}
          </AppText>
        </View>
        <Row gap={spacing.xs}>
          <NavButton icon="chevron-left" label="Previous month" onPress={onPrev} disabled={!canGoPrev} />
          <NavButton icon="chevron-right" label="Next month" onPress={onNext} disabled={!canGoNext} />
        </Row>
      </Row>

      <View style={{ gap: 2 }}>
        <AppText variant="caption" color={colors.onPrimary} style={{ opacity: 0.85, fontWeight: '600' }}>
          Total movement
        </AppText>
        <Money amount={total} currency={currency} variant="title" color={colors.onPrimary} />
      </View>
    </View>
  );
}

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
          <MonthCard
            month={month.from}
            count={list?.length ?? 0}
            total={total}
            currency={user.defaultCurrency}
            canGoNext={offset < 0}
            canGoPrev={offset > -LIMITS.TRANSFER_MAX_MONTHS_BACK}
            onPrev={() => setOffset((o) => Math.max(-LIMITS.TRANSFER_MAX_MONTHS_BACK, o - 1))}
            onNext={() => setOffset((o) => Math.min(0, o + 1))}
          />
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
                    <TransferRow transfer={t} accounts={accounts} onPress={() => router.push({ pathname: '/transfer/view/[id]', params: { id: t._id } })} />
                  </View>
                ))}
              </Card>
            </Appear>
          ))
        )}
      </Screen>
      <Fab label="Add self transfer" icon="swap-horizontal" safeBottom onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new', type: 'transfer' } })} />
    </View>
  );
}
