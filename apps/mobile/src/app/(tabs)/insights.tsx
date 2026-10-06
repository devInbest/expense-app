import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatMoney, type PaymentMethod, type TransactionType } from '@expense/shared';
import { Money, TransactionRow } from '@/components/finance';
import { TrendChart } from '@/components/TrendChart';
import { AppText, Card, CategoryIcon, EmptyState, Icon, IconButton, Row, Screen, Section, Segmented, Sheet } from '@/components/ui';
import { UNKNOWN_CATEGORY, useCategories, useLocalQuery, useSpendingSummary } from '@/hooks/data';
import { useUser } from '@/lib/auth';
import { iso, monthRange, yearRange, type Range } from '@/lib/dates';
import { listTransactions } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';

type Period = 'month' | 'year';

const shift = (period: Period, offset: number): Range => {
  const now = new Date();
  if (period === 'year') return yearRange(new Date(now.getFullYear() + offset, 0, 1));
  return monthRange(now, offset);
};

const label = (period: Period, r: Range) =>
  period === 'year' ? String(r.from.getFullYear()) : r.from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shortLabel = (period: Period, r: Range) =>
  period === 'year' ? String(r.from.getFullYear()) : r.from.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank: 'Bank',
  other: 'Other',
};
const METHOD_META: Record<string, { icon: string; color: string }> = {
  cash: { icon: 'cash', color: '#16A34A' },
  upi: { icon: 'qrcode-scan', color: '#7C3AED' },
  card: { icon: 'credit-card-outline', color: '#2563EB' },
  bank: { icon: 'bank-outline', color: '#0891B2' },
  other: { icon: 'wallet-outline', color: '#F59E0B' },
};

type DrillDown = { title: string; paymentMethod?: PaymentMethod; categoryId?: string; periodTotal: number };

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        gap: 2,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="subheading" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

function FilteredTransactionsSheet({
  filter,
  from,
  to,
  type,
  periodLabel,
  currency,
  onClose,
}: {
  filter: DrillDown;
  from: string;
  to: string;
  type: TransactionType;
  periodLabel: string;
  currency: string;
  onClose: () => void;
}) {
  const { byId } = useCategories();
  const { paymentMethod, categoryId } = filter;
  const { data: items } = useLocalQuery(
    () => listTransactions({ from, to, type, paymentMethod, categoryId, limit: 500 }),
    [from, to, type, paymentMethod, categoryId],
  );
  const open = (clientId: string) => {
    onClose();
    router.push({ pathname: '/transaction/view/[id]', params: { id: clientId } });
  };

  const list = items ?? [];
  const sum = list.reduce((s, t) => s + t.amount, 0);
  const largest = list.reduce((m, t) => Math.max(m, t.amount), 0);
  const share = filter.periodTotal > 0 ? Math.round((sum / filter.periodTotal) * 100) : 0;
  const breakdown = useMemo(() => {
    const groups = new Map<string, number>();
    for (const t of items ?? []) {
      const key = paymentMethod ? t.categoryId : t.paymentMethod;
      groups.set(key, (groups.get(key) ?? 0) + t.amount);
    }
    return [...groups].sort((a, b) => b[1] - a[1]);
  }, [items, paymentMethod]);
  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <Sheet visible title={`${filter.title} · ${periodLabel}`} onClose={onClose}>
      {items === undefined ? null : list.length ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Stat label="Total" value={fmt(sum)} />
            <Stat label="Percentage" value={`${share}%`} />
            <Stat label="Transactions" value={String(list.length)} />
            <Stat label="Average" value={fmt(Math.round(sum / list.length))} />
            <Stat label="Largest" value={fmt(largest)} />
          </View>

          {breakdown.length > 1 ? (
            <Section title={paymentMethod ? 'By category' : 'By payment method'}>
              <Card>
                {breakdown.map(([key, value]) => {
                  const cat = paymentMethod ? (byId.get(key) ?? UNKNOWN_CATEGORY) : null;
                  const meta = paymentMethod ? null : (METHOD_META[key] ?? METHOD_META.other!);
                  return (
                    <Row key={key} style={{ paddingVertical: spacing.xs }}>
                      <CategoryIcon icon={cat?.icon ?? meta!.icon} color={cat?.color ?? meta!.color} size={32} square />
                      <AppText numberOfLines={1} style={{ flex: 1 }}>
                        {cat?.name ?? METHOD_LABEL[key] ?? key}
                      </AppText>
                      <View style={{ alignItems: 'flex-end' }}>
                        <AppText style={{ fontVariant: ['tabular-nums'] }}>{fmt(value)}</AppText>
                        <AppText variant="caption" muted>
                          {sum > 0 ? Math.round((value / sum) * 100) : 0}%
                        </AppText>
                      </View>
                    </Row>
                  );
                })}
              </Card>
            </Section>
          ) : null}

          <Section title="Transactions">
            <View>
              {list.map((tx) => (
                <TransactionRow key={tx.clientId} tx={tx} category={byId.get(tx.categoryId)} onPress={() => open(tx.clientId)} />
              ))}
            </View>
          </Section>
        </>
      ) : (
        <EmptyState icon="text-box-search-outline" title="No transactions" />
      )}
    </Sheet>
  );
}

export default function Insights() {
  const user = useUser();
  const { colors } = useTheme();
  const { byId } = useCategories();
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState<TransactionType>('expense');
  const current = shift(period, offset);
  const previous = shift(period, offset - 1);
  const cur = iso(current);
  const prev = iso(previous);

  const { data } = useSpendingSummary(cur.from, cur.to, type);
  const { data: before } = useSpendingSummary(prev.from, prev.to, type);

  const total = type === 'expense' ? (data?.expense ?? 0) : (data?.income ?? 0);
  const prevTotal = type === 'expense' ? (before?.expense ?? 0) : (before?.income ?? 0);
  const change = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const trendDays = useMemo(
    () =>
      (data?.byDay ?? []).map((d) => ({
        date: d.date,
        value: type === 'expense' ? d.expense : d.income,
      })),
    [data, type],
  );
  const currency = user.defaultCurrency;

  const hasCategories = Boolean(data?.byCategory.length);
  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ flexGrow: 1, paddingBottom: spacing.lg }}>
        <View style={{ gap: spacing.lg }}>
          <AppText variant="title">Insights</AppText>
          <Segmented
            options={[
              { value: 'expense', label: 'Spending' },
              { value: 'income', label: 'Income' },
            ]}
            value={type}
            onChange={setType}
          />
          <Row style={{ alignItems: 'stretch' }}>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Segmented
                compact
                options={[
                  { value: 'month', label: 'Month' },
                  { value: 'year', label: 'Year' },
                ]}
                value={period}
                onChange={(p) => {
                  setPeriod(p);
                  setOffset(0);
                }}
              />
            </View>
            <Row gap={2} style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm + 2, paddingHorizontal: spacing.xs, paddingVertical: 2 }}>
              <IconButton icon="chevron-left" size={18} label="Previous" onPress={() => setOffset((o) => o - 1)} />
              <Pressable
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityLabel={offset < 0 ? 'Jump to current period' : label(period, current)}
                disabled={offset === 0}
                onPress={() => setOffset(0)}>
                <Row gap={4} style={{ justifyContent: 'center' }}>
                  <Icon name="calendar-month-outline" size={15} color={colors.primary} />
                  <AppText style={{ fontSize: 13, fontWeight: '700' }}>{shortLabel(period, current)}</AppText>
                </Row>
              </Pressable>
              <IconButton
                icon="chevron-right"
                size={18}
                label="Next"
                onPress={() => setOffset((o) => Math.min(0, o + 1))}
                color={offset >= 0 ? colors.border : undefined}
              />
            </Row>
          </Row>

          <Card>
            <AppText muted>{type === 'expense' ? 'Total spent' : 'Total income'}</AppText>
            <Money amount={total} currency={currency} variant="title" />
            {change !== null ? (
              <AppText variant="caption" color={change > 0 === (type === 'expense') ? colors.danger : colors.success}>
                {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change)}% vs previous
              </AppText>
            ) : null}
          </Card>

          {data && total > 0 ? (
            <Section title="Trend">
              <Card>
                <TrendChart
                  key={`${period}-${offset}-${type}`}
                  period={period}
                  from={current.from}
                  to={current.to}
                  days={trendDays}
                  currency={currency}
                  color={type === 'expense' ? colors.primary : colors.income}
                />
              </Card>
            </Section>
          ) : null}
        </View>

        {hasCategories && data ? (
          <Section title="Categories">
            <Card>
              {data.byCategory.map((c) => {
                const cat = byId.get(c.categoryId) ?? UNKNOWN_CATEGORY;
                return (
                  <Pressable
                    key={c.categoryId}
                    disabled={!c.categoryId}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${cat.name} transactions`}
                    onPress={() => setDrillDown({ title: cat.name, categoryId: c.categoryId, periodTotal: total })}
                    style={({ pressed }) => ({ gap: 6, paddingVertical: spacing.xs, opacity: pressed ? 0.6 : 1 })}>
                    <Row>
                      <CategoryIcon icon={cat.icon} color={cat.color} size={40} square />
                      <AppText numberOfLines={1} style={{ flex: 1 }}>
                        {cat.name}
                      </AppText>
                      <Money amount={c.total} currency={currency} variant="body" />
                    </Row>
                  </Pressable>
                );
              })}
            </Card>
          </Section>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="chart-donut" title="No data for this period" />
          </View>
        )}

        {data?.byPaymentMethod.length ? (
          <Section title="Payment Methods">
            <View style={{ gap: spacing.sm }}>
              {[...data.byPaymentMethod]
                .sort((a, b) => b.total - a.total)
                .map((m) => {
                  const meta = METHOD_META[m.paymentMethod] ?? METHOD_META.other!;
                  const name = METHOD_LABEL[m.paymentMethod] ?? m.paymentMethod;
                  const methodsTotal = data.byPaymentMethod.reduce((s, x) => s + x.total, 0);
                  return (
                    <Pressable
                      key={m.paymentMethod}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${name} transactions`}
                      onPress={() => setDrillDown({ title: name, paymentMethod: m.paymentMethod, periodTotal: methodsTotal })}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        backgroundColor: colors.surface,
                        borderRadius: radius.lg,
                        padding: spacing.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      })}>
                      <CategoryIcon icon={meta.icon} color={meta.color} size={40} square />
                      <AppText numberOfLines={1} style={{ flex: 1 }}>
                        {name}
                      </AppText>
                      <Money amount={m.total} currency={currency} variant="body" />
                    </Pressable>
                  );
                })}
            </View>
          </Section>
        ) : null}
      </Screen>
      {drillDown ? (
        <FilteredTransactionsSheet
          filter={drillDown}
          from={cur.from}
          to={cur.to}
          type={type}
          periodLabel={label(period, current)}
          currency={currency}
          onClose={() => setDrillDown(null)}
        />
      ) : null}
    </View>
  );
}
