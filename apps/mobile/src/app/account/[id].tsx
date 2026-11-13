import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountSheet, useSaveAccounts, type AccountEditing } from '@/components/AccountSheet';
import { PaymentCard } from '@/components/PaymentCard';
import { popup } from '@/components/popup';
import { AppText, Appear, BackdropSlice, Banner, Button, Card, Divider, Row, Screen, TAB_BAR_FADE } from '@/components/ui';
import { ACCOUNT_KIND_LABEL, accountLabel, useAccounts } from '@/lib/accounts';
import { useUser } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ paddingVertical: 6 }}>
      <AppText muted style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText style={{ flex: 2, textAlign: 'right', fontWeight: '500' }}>{value}</AppText>
    </Row>
  );
}

/** A saved bank account or credit card, shown as a payment card with Edit and Remove. */
export default function AccountView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = useAccounts();
  const [editing, setEditing] = useState<AccountEditing>(null);
  const [screenHeight, setScreenHeight] = useState(0);
  const remove = useSaveAccounts(
    () => router.back(),
    (msg) => popup.error('Couldn’t remove', msg),
  );

  const account = accounts.find((a) => a.id === id);
  if (!account) {
    return (
      <Screen edges={['bottom']}>
        <Banner icon="alert-circle-outline" tone="warning" text="This account was removed." />
      </Screen>
    );
  }

  const confirmRemove = () =>
    popup.confirm({
      title: `Remove ${accountLabel(account)}?`,
      message: 'Past transactions keep their amounts; they just won’t show this account any more.',
      icon: 'trash-can-outline',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => remove.mutate(accounts.filter((a) => a.id !== account.id)),
    });

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
      <Stack.Screen options={{ title: ACCOUNT_KIND_LABEL[account.kind] }} />
      <Screen edges={[]} contentStyle={{ gap: spacing.lg, paddingBottom: 54 + spacing.sm * 2 + TAB_BAR_FADE + spacing.lg + insets.bottom }}>
        <Appear>
          <PaymentCard account={account} holder={user.name} />
        </Appear>

        <Appear index={1}>
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="subheading" style={{ marginBottom: spacing.xs }}>
              {account.kind === 'card' ? 'Card details' : 'Account details'}
            </AppText>
            <DetailRow label="Name" value={account.name} />
            <DetailRow label="Type" value={account.kind === 'card' ? 'Credit card' : 'Bank account (debit)'} />
            <Divider />
            <DetailRow label="Last 4 digits" value={account.last4 || '—'} />
          </Card>
        </Appear>
      </Screen>

      <SafeAreaView
        edges={['bottom']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: TAB_BAR_FADE, paddingBottom: spacing.sm }}>
        <BackdropSlice fade={TAB_BAR_FADE} screenHeight={screenHeight || undefined} />
        <Row style={{ gap: spacing.sm }}>
          <Button title="Edit" variant="glass" color={colors.primary} style={{ flex: 1 }} onPress={() => setEditing({ kind: account.kind, account })} />
          <Button title="Remove" variant="glass" color={colors.danger} style={{ flex: 1 }} loading={remove.isPending} onPress={confirmRemove} />
        </Row>
      </SafeAreaView>

      <AccountSheet key={editing ? `edit-${account.id}` : 'closed'} editing={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
