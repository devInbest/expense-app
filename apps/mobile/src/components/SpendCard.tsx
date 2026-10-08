import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatMoney } from '@expense/shared';
import { radius, spacing, useTheme } from '@/theme';
import { AppText, Icon, linearGradient, Row } from './ui';

const INK = '#FFFFFF';
const FROST = 'rgba(255,255,255,0.18)';
const FROST_BORDER = 'rgba(255,255,255,0.35)';

/** Eases a number from its previous value to `value`. */
export function useCountUp(value: number, duration = 900) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const from = current.current;
    let frame = requestAnimationFrame(function tick() {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      current.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

function FrostPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2, backgroundColor: FROST, borderWidth: 1, borderColor: FROST_BORDER, borderRadius: radius.md, padding: spacing.md }}>
      <AppText color={INK} style={{ fontSize: 10, opacity: 0.8, letterSpacing: 1, fontWeight: '700' }}>
        {label}
      </AppText>
      <AppText color={INK} numberOfLines={1} adjustsFontSizeToFit style={{ fontWeight: '800', fontSize: 15 }}>
        {value}
      </AppText>
    </View>
  );
}

/** Monthly spend styled like a bank card. */
export function SpendCard({ spent, income, currency, month }: { spent: number; income: number; currency: string; month: Date }) {
  const { colors } = useTheme();
  const period = month.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const shownSpent = useCountUp(spent);
  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(16)}
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg + 2,
        gap: spacing.lg,
        overflow: 'hidden',
        backgroundColor: colors.primary,
        experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
        boxShadow: `0 18px 40px ${colors.primaryGlow}`,
      }}>
      <View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: FROST, top: -110, right: -70 }} />
      <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 24, borderColor: 'rgba(255,255,255,0.10)', bottom: -60, left: -40 }} />

      <Row>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText color={INK} style={{ opacity: 0.85, fontWeight: '600' }}>
            Spent this month
          </AppText>
          <AppText variant="display" color={INK} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(shownSpent, currency)}
          </AppText>
        </View>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FROST,
            borderWidth: 1,
            borderColor: FROST_BORDER,
            alignSelf: 'flex-start',
          }}>
          <Icon name="contactless-payment" size={24} color={INK} />
        </View>
      </Row>

      <Row gap={spacing.sm}>
        <FrostPill label="INCOME" value={formatMoney(income, currency)} />
        <FrostPill label="PERIOD" value={period} />
      </Row>
    </Animated.View>
  );
}
