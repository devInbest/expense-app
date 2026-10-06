import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatMoney } from '@expense/shared';
import { spacing, useTheme } from '@/theme';
import { AppText } from './ui';

type Period = 'week' | 'month' | 'year';
type Bucket = { key: string; label: string; title: string; value: number };

const CHART_HEIGHT = 120;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Buckets are generated for the whole period so days or months without spending still show as gaps. */
const buildBuckets = (period: Period, from: Date, to: Date, values: Map<string, number>): Bucket[] => {
  if (period === 'year') {
    const year = from.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const date = new Date(year, m, 1);
      const prefix = `${year}-${pad(m + 1)}`;
      let value = 0;
      for (const [k, v] of values) if (k.startsWith(prefix)) value += v;
      return {
        key: prefix,
        label: date.toLocaleDateString(undefined, { month: 'narrow' }),
        title: date.toLocaleDateString(undefined, { month: 'long' }),
        value,
      };
    });
  }
  const buckets: Bucket[] = [];
  for (let d = new Date(from); d < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const key = dayKey(d);
    const day = d.getDate();
    const label = period === 'week' ? d.toLocaleDateString(undefined, { weekday: 'narrow' }) : day === 1 || day % 7 === 1 ? String(day) : '';
    buckets.push({ key, label, title: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: values.get(key) ?? 0 });
  }
  return buckets;
};

export function TrendChart({
  period,
  from,
  to,
  days,
  currency,
  color,
}: {
  period: Period;
  from: Date;
  to: Date;
  days: { date: string; value: number }[];
  currency: string;
  color: string;
}) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const buckets = useMemo(
    () => buildBuckets(period, new Date(fromMs), new Date(toMs), new Map(days.map((d) => [d.date, d.value]))),
    [period, fromMs, toMs, days],
  );
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const average = buckets.reduce((s, b) => s + b.value, 0) / buckets.length;
  const active = buckets.find((b) => b.key === selected);
  const gap = period === 'month' ? 3 : spacing.md;

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="caption" muted>
        {active
          ? `${active.title} · ${formatMoney(active.value, currency)}`
          : `Avg ${formatMoney(Math.round(average), currency)} / ${period === 'year' ? 'month' : 'day'}`}
      </AppText>

      <View style={{ height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap }}>
        {buckets.map((b) => {
          const isActive = b.key === selected;
          return (
            <Pressable
              key={b.key}
              accessibilityLabel={`${b.title}: ${formatMoney(b.value, currency)}`}
              onPress={() => setSelected(isActive ? null : b.key)}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: b.value > 0 ? Math.max(4, (b.value / max) * CHART_HEIGHT) : 4,
                  borderRadius: 999,
                  backgroundColor: b.value > 0 ? color : colors.border,
                  opacity: selected && !isActive ? 0.3 : 1,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap, marginTop: -spacing.xs }}>
        {buckets.map((b) => (
          <View key={b.key} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
            <AppText variant="caption" muted numberOfLines={1} style={{ width: 24, textAlign: 'center', fontSize: 10 }}>
              {b.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
