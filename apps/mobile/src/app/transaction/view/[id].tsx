import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatMoney, type PaymentMethod } from '@expense/shared';
import { AppText, Banner, Button, Divider, Icon, Loading, Row, Screen } from '@/components/ui';
import { UNKNOWN_CATEGORY, useCategories, useLocalQuery } from '@/hooks/data';
import { errorMessage } from '@/lib/api';
import { shareReceipt } from '@/lib/receipt';
import { getTransaction, setTransactionBinned } from '@/lib/transactions';
import { radius, spacing, useTheme } from '@/theme';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank', other: 'Other' };

function DetailRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <Row style={{ paddingVertical: 6, alignItems: 'flex-start' }}>
      <AppText muted={!bold} style={{ flex: 1, fontWeight: bold ? '700' : undefined }}>
        {label}
      </AppText>
      <AppText color={valueColor} style={{ flex: 2, textAlign: 'right', fontWeight: bold || valueColor ? '600' : '500' }}>
        {value}
      </AppText>
    </Row>
  );
}

export default function TransactionView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { byId } = useCategories();
  const { data: tx } = useLocalQuery(() => getTransaction(id), [id]);
  const [sharing, setSharing] = useState(false);

  if (tx === undefined) return <Loading />;
  if (!tx) {
    return (
      <Screen edges={[]}>
        <Banner icon="alert-circle-outline" tone="warning" text="This transaction couldn’t be found on this device." />
      </Screen>
    );
  }

  const cat = byId.get(tx.categoryId) ?? UNKNOWN_CATEGORY;
  const isIncome = tx.type === 'income';
  const tone = isIncome ? colors.income : colors.danger;
  const when = new Date(tx.occurredAt);
  const method = METHOD_LABEL[tx.paymentMethod] ?? tx.paymentMethod;
  const amount = formatMoney(tx.amount, tx.currency);

  const download = async () => {
    setSharing(true);
    try {
      await shareReceipt(tx, cat.name, method);
    } catch (err) {
      Alert.alert('Couldn’t download receipt', errorMessage(err));
    } finally {
      setSharing(false);
    }
  };

  const moveToBin = () =>
    Alert.alert('Move to bin?', 'It won’t count in your totals. You can restore it from the bin anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to bin',
        style: 'destructive',
        onPress: async () => {
          await setTransactionBinned(id, true);
          router.back();
        },
      },
    ]);

  const restore = async () => {
    await setTransactionBinned(id, false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen edges={[]} contentStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }}>
        <View
          style={{
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xl,
            marginTop: -spacing.lg,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: `${cat.color}26`,
          }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={cat.icon} size={36} color={cat.color} />
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 3 }}>
            <AppText variant="caption" color={tone} style={{ fontWeight: '600' }}>
              {isIncome ? 'Income' : 'Expense'}
            </AppText>
          </View>
          <AppText variant="title" style={{ fontSize: 30, fontVariant: ['tabular-nums'] }}>
            {amount}
          </AppText>
        </View>

        {tx.binned ? <Banner tone="warning" icon="trash-can-outline" text="In the bin. It isn’t counted in your totals." /> : null}
        {tx.syncError ? <Banner tone="danger" icon="alert-circle-outline" text={`Not saved to your account: ${tx.syncError}`} /> : null}

        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
          <AppText variant="subheading" style={{ marginBottom: spacing.xs }}>
            Transaction details
          </AppText>
          <DetailRow label="Category" value={cat.name} />
          <DetailRow label={isIncome ? 'Received via' : 'Paid with'} value={method} />
          <DetailRow label="Time" value={when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} />
          <DetailRow label="Date" value={when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />
          {tx.note ? (
            <>
              <Divider />
              <DetailRow label="Note" value={tx.note} />
            </>
          ) : null}
          <Divider />
          <DetailRow label="Total" value={amount} bold />
        </View>
      </Screen>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Download receipt"
          disabled={sharing}
          onPress={() => void download()}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: 14,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderColor: colors.primary,
            opacity: pressed || sharing ? 0.6 : 1,
          })}>
          {sharing ? <ActivityIndicator color={colors.primary} /> : <Icon name="download-outline" size={20} color={colors.primary} />}
          <AppText color={colors.primary} style={{ fontWeight: '700' }}>
            Download Receipt
          </AppText>
        </Pressable>
        {tx.binned ? (
          <Button title="Restore transaction" icon="restore" onPress={() => void restore()} />
        ) : (
          <Button title="Move to bin" icon="trash-can-outline" variant="danger" onPress={moveToBin} />
        )}
      </SafeAreaView>
    </View>
  );
}
