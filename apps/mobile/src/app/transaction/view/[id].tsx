import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { formatMoney, type PaymentMethod } from '@expense/shared';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Appear, BackdropSlice, Banner, Button, Card, Divider, Glass, Icon, Loading, Row, Screen, TAB_BAR_FADE } from '@/components/ui';
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
      <AppText color={valueColor} style={{ flex: 2, textAlign: 'right', fontWeight: bold || valueColor ? '700' : '500' }}>
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
  const insets = useSafeAreaInsets();
  const [screenHeight, setScreenHeight] = useState(0);

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
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Screen edges={[]} contentStyle={{ gap: spacing.md, paddingBottom: 54 * 2 + spacing.sm * 2 + TAB_BAR_FADE + spacing.lg + insets.bottom }}>
        <Appear>
          <Glass blur rounded={radius.xl} style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, overflow: 'hidden' }}>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -110,
                width: 320,
                height: 240,
                experimental_backgroundImage: `radial-gradient(circle at center, ${cat.color}55 0%, ${cat.color}00 70%)`,
              }}
            />
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 26,
                backgroundColor: `${cat.color}22`,
                borderWidth: 1,
                borderColor: `${cat.color}40`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name={cat.icon} size={38} color={cat.color} />
            </View>
            <View style={{ backgroundColor: `${tone}1A`, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <AppText variant="caption" color={tone} style={{ fontWeight: '700' }}>
                {isIncome ? 'Income' : 'Expense'}
              </AppText>
            </View>
            <AppText variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {amount}
            </AppText>
          </Glass>
        </Appear>

        {tx.binned ? <Banner tone="warning" icon="trash-can-outline" text="In the bin. It isn’t counted in your totals." /> : null}
        {tx.syncError ? <Banner tone="danger" icon="alert-circle-outline" text={`Not saved to your account: ${tx.syncError}`} /> : null}

        <Appear index={1}>
          <Card style={{ gap: spacing.xs }}>
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
          </Card>
        </Appear>
      </Screen>

      <SafeAreaView
        edges={['bottom']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: TAB_BAR_FADE, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <BackdropSlice fade={TAB_BAR_FADE} screenHeight={screenHeight || undefined} />
        <Button
          title="Download Receipt"
          icon="download-outline"
          variant="glass"
          color={colors.primary}
          loading={sharing}
          onPress={() => void download()}
        />
        {tx.binned ? (
          <Button title="Restore transaction" icon="restore" onPress={() => void restore()} />
        ) : (
          <Button title="Move to bin" icon="trash-can-outline" variant="glass" color={colors.danger} onPress={moveToBin} />
        )}
      </SafeAreaView>
    </View>
  );
}
