import { View } from 'react-native';
import type { PaymentAccount } from '@expense/shared';
import { AppText, Icon, linearGradient, Row } from '@/components/ui';
import { cardThemeFor } from '@/lib/cardThemes';
import { radius, spacing } from '@/theme';

const ON_CARD = '#FFFFFF';
const ON_CARD_MUTED = 'rgba(255,255,255,0.72)';

/** The gold contact chip, drawn so it needs no image asset. */
function Chip() {
  return (
    <View
      style={{
        width: 46,
        height: 34,
        borderRadius: 7,
        overflow: 'hidden',
        backgroundColor: '#D9B45A',
        experimental_backgroundImage: linearGradient('#F4DC8F', '#B8892E', 135),
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.12)',
      }}>
      {/* Contact pads */}
      <View style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
      <View style={{ position: 'absolute', right: 15, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 11, height: 1, backgroundColor: 'rgba(0,0,0,0.22)' }} />
    </View>
  );
}

/**
 * A saved account drawn as a payment card in its bank's / card's colours (see `cardThemes`),
 * marked DEBIT for bank accounts and CREDIT for credit cards.
 */
export function PaymentCard({ account, holder }: { account: PaymentAccount; holder: string }) {
  const credit = account.kind === 'card';
  // Bank / card colours come from the name ("SBI Savings" → SBI blue, "Axis Neo" → Neo pink).
  const theme = cardThemeFor(account);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 1.586,
        borderRadius: radius.xl,
        padding: spacing.lg,
        overflow: 'hidden',
        justifyContent: 'space-between',
        backgroundColor: theme.from,
        experimental_backgroundImage: linearGradient(theme.from, theme.to, 135),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        boxShadow: `0 18px 40px ${theme.to}73`,
      }}>
      {/* Light sweeps for depth */}
      <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.10)', top: -130, right: -70 }} />
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: theme.accent,
          bottom: -110,
          left: -50,
        }}
      />

      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="subheading" color={ON_CARD} numberOfLines={1}>
            {account.name}
          </AppText>
          <AppText variant="caption" color={ON_CARD_MUTED} style={{ fontWeight: '600' }}>
            {credit ? 'Credit card' : 'Bank account'}
          </AppText>
        </View>
        <View
          style={{
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.28)',
          }}>
          <AppText variant="caption" color={ON_CARD} style={{ fontWeight: '800', letterSpacing: 1.4 }}>
            {credit ? 'CREDIT' : 'DEBIT'}
          </AppText>
        </View>
      </Row>

      <Row gap={spacing.md}>
        <Chip />
        <Icon name="contactless-payment" size={26} color={ON_CARD_MUTED} />
      </Row>

      <AppText color={ON_CARD} style={{ fontSize: 20, fontWeight: '600', letterSpacing: 2.5, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        ••••  ••••  ••••  {account.last4 || '••••'}
      </AppText>

      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <AppText color={ON_CARD_MUTED} style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>
            {credit ? 'CARD HOLDER' : 'ACCOUNT HOLDER'}
          </AppText>
          <AppText color={ON_CARD} numberOfLines={1} style={{ fontWeight: '700', letterSpacing: 0.8 }}>
            {holder.toUpperCase()}
          </AppText>
        </View>
        <Icon name={credit ? 'credit-card-outline' : 'bank'} size={28} color={ON_CARD} />
      </Row>
    </View>
  );
}
