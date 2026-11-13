import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isUpiNumber, type PaymentAccountKind } from '@expense/shared';
import { AccountSheet, type AccountEditing } from '@/components/AccountSheet';
import { Appear, Card, Divider, ListItem, Screen, Section } from '@/components/ui';
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_LABEL, useAccounts } from '@/lib/accounts';
import { useUser } from '@/lib/auth';
import { cardThemeFor } from '@/lib/cardThemes';
import { spacing } from '@/theme';

export default function AccountsScreen() {
  const user = useUser();
  const accounts = useAccounts();
  const [editing, setEditing] = useState<AccountEditing>(null);

  const group = (kind: PaymentAccountKind, title: string, emptyText: string, index: number) => {
    const list = accounts.filter((a) => a.kind === kind);
    return (
      <Appear index={index}>
        <Section title={title}>
          <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
            {list.map((a, i) => (
              <View key={a.id}>
                {i ? <Divider /> : null}
                <ListItem icon={ACCOUNT_KIND_ICON[kind]} iconColor={cardThemeFor(a).from} title={a.name} subtitle={a.last4 ? `Ending in ${a.last4}` : 'Add the last 4 digits'} onPress={() => router.push({ pathname: '/account/[id]', params: { id: a.id } })} />
              </View>
            ))}
            {list.length ? <Divider /> : null}
            <ListItem icon="plus" title={`Add ${ACCOUNT_KIND_LABEL[kind].toLowerCase()}`} subtitle={list.length ? undefined : emptyText} onPress={() => setEditing({ kind })} />
          </Card>
        </Section>
      </Appear>
    );
  };

  return (
    <Screen edges={['bottom']} contentStyle={{ gap: spacing.lg, paddingBottom: spacing.lg }}>
      <Appear>
        <Section title="Cash">
          <Card>
            <ListItem icon="cash" title="Cash" subtitle="Always available when you log a payment" />
          </Card>
        </Section>
      </Appear>

      {group('bank', 'Bank accounts', 'Pick which account a bank payment came from', 1)}
      {group('card', 'Credit cards', 'Pick which card a card payment was made with', 2)}

      <Appear index={3}>
        <Section title="UPI">
          <Card>
            <ListItem
              icon="qrcode"
              title="UPI ID"
              subtitle={!user.upiId ? 'Add so room members can pay you' : isUpiNumber(user.upiId) ? 'Change to a UPI ID so members can pay you directly' : user.upiId}
              onPress={() => router.push('/upi')}
            />
          </Card>
        </Section>
      </Appear>

      <AccountSheet key={editing ? (editing.account?.id ?? `new-${editing.kind}`) : 'closed'} editing={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}
