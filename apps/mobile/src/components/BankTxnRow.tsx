import { Pressable, View } from 'react-native';
import type { BankTransactionDTO, BankTxnLinkKind } from '@expense/shared';
import { formatDay, formatTime } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';
import { Money } from './finance';
import { AppText, CategoryIcon } from './ui';

export const LINK_LABEL: Record<BankTxnLinkKind, string> = {
  transaction: 'Saved as personal',
  room_expense: 'Added to a room',
  room_payment: 'Room payment',
};

export const bankTxnTitle = (t: BankTransactionDTO) => t.counterparty || (t.direction === 'debit' ? 'Money sent' : 'Money received');

export const bankTxnSource = (t: BankTransactionDTO) => [t.bank, t.accountMask ? `••${t.accountMask}` : null].filter(Boolean).join(' ');

export function BankTxnRow({ item, onPress }: { item: BankTransactionDTO; onPress?: () => void }) {
  const { colors } = useTheme();
  const debit = item.direction === 'debit';
  const meta = [
    item.link ? LINK_LABEL[item.link.kind] : bankTxnSource(item),
    `${formatDay(item.occurredAt)}, ${formatTime(item.occurredAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={debit ? 'arrow-top-right' : 'arrow-bottom-left'} color={debit ? colors.danger : colors.income} size={44} square />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {bankTxnTitle(item)}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <Money amount={item.amount} currency={item.currency} type={debit ? 'expense' : 'income'} variant="body" />
    </Pressable>
  );
}
