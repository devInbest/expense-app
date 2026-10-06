import { View } from 'react-native';
import { formatMoney } from '@expense/shared';
import { radius, spacing } from '@/theme';
import { AppText, Icon, Row } from './ui';

const CARD_BG = '#1E1B4B';
const INK = '#FFFFFF';

/** Monthly spend styled like a bank card. */
export function SpendCard({ spent, income, currency, month }: { spent: number; income: number; currency: string; month: Date }) {
  const period = month.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return (
    <View style={{ aspectRatio: 1.7, borderRadius: radius.lg + 4, backgroundColor: CARD_BG, overflow: 'hidden', padding: spacing.lg, justifyContent: 'space-between' }}>
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#4F46E5', opacity: 0.55, top: -120, right: -90 }} />
      <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#7C3AED', opacity: 0.35, bottom: -110, left: -60 }} />

      <View style={{ gap: spacing.xs }}>
        <Row>
          <AppText color={INK} style={{ flex: 1, opacity: 0.85, fontWeight: '600', letterSpacing: 0.5 }}>
            Spent this month
          </AppText>
          <Icon name="contactless-payment" size={26} color={INK} />
        </Row>
        <AppText variant="title" color={INK} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
          {formatMoney(spent, currency)}
        </AppText>
      </View>

      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <AppText color={INK} style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1 }}>
            INCOME
          </AppText>
          <AppText color={INK} style={{ fontWeight: '700' }}>
            {formatMoney(income, currency)}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText color={INK} style={{ fontSize: 10, opacity: 0.6, letterSpacing: 1 }}>
            PERIOD
          </AppText>
          <AppText color={INK} style={{ fontWeight: '700' }}>
            {period}
          </AppText>
        </View>
      </Row>
    </View>
  );
}
