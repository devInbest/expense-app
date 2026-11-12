import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { isUpiNumber, LIMITS, paymentAccountSchema, type PaymentAccount, type PaymentAccountKind } from '@expense/shared';
import { popup } from '@/components/popup';
import { Appear, Button, Card, Divider, ErrorText, Field, ListItem, Screen, Section, Sheet } from '@/components/ui';
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_LABEL, accountLabel, useAccounts } from '@/lib/accounts';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

type Editing = { kind: PaymentAccountKind; account?: PaymentAccount } | null;

const useSaveAccounts = (onDone?: () => void, onError?: (msg: string) => void) => {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (accounts: PaymentAccount[]) => api.me.update({ accounts }),
    onSuccess: (updated) => {
      setUser(updated);
      onDone?.();
    },
    onError: (err) => onError?.(errorMessage(err)),
  });
};

export default function AccountsScreen() {
  const user = useUser();
  const accounts = useAccounts();
  const [editing, setEditing] = useState<Editing>(null);

  const group = (kind: PaymentAccountKind, title: string, emptyText: string, index: number) => {
    const list = accounts.filter((a) => a.kind === kind);
    return (
      <Appear index={index}>
        <Section title={title}>
          <Card style={{ paddingVertical: spacing.xs, gap: 0 }}>
            {list.map((a, i) => (
              <View key={a.id}>
                {i ? <Divider /> : null}
                <ListItem icon={ACCOUNT_KIND_ICON[kind]} title={a.name} subtitle={a.last4 ? `Ending in ${a.last4}` : 'Add the last 4 digits'} onPress={() => setEditing({ kind, account: a })} />
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

function AccountSheet({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { colors } = useTheme();
  const accounts = useAccounts();
  const existing = editing?.account;
  const kind = editing?.kind ?? 'bank';
  const [name, setName] = useState(existing?.name ?? '');
  const [last4, setLast4] = useState(existing?.last4 ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = useSaveAccounts(onClose, setError);

  const submit = () => {
    const parsed = paymentAccountSchema.safeParse({ id: existing?.id ?? Crypto.randomUUID(), kind, name, last4: last4.trim() });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the details');
    if (!existing && accounts.length >= LIMITS.MAX_PAYMENT_ACCOUNTS) return setError(`You can save up to ${LIMITS.MAX_PAYMENT_ACCOUNTS} accounts`);
    setError(null);
    const next = existing ? accounts.map((a) => (a.id === existing.id ? parsed.data : a)) : [...accounts, parsed.data];
    save.mutate(next);
  };

  const remove = () =>
    popup.confirm({
      title: `Remove ${accountLabel(existing!)}?`,
      message: 'Past transactions keep their amounts; they just won’t show this account any more.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => save.mutate(accounts.filter((a) => a.id !== existing!.id)),
    });

  return (
    <Sheet
      visible={editing !== null}
      showClose={false}
      dragToDismiss
      title={existing ? `Edit ${ACCOUNT_KIND_LABEL[kind].toLowerCase()}` : `Add ${ACCOUNT_KIND_LABEL[kind].toLowerCase()}`}
      onClose={onClose}>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={kind === 'card' ? 'e.g. HDFC Regalia' : 'e.g. SBI Savings'}
        maxLength={40}
      />
      <Field
        label="Last 4 digits"
        value={last4}
        onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))}
        placeholder="1234"
        keyboardType="number-pad"
        maxLength={4}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Save"
        loading={save.isPending}
        disabled={Boolean(existing) && name.trim() === existing!.name && last4.trim() === existing!.last4}
        onPress={submit}
      />
      {existing ? <Button title="Remove" variant="ghost" color={colors.danger} onPress={remove} /> : null}
      <View style={{ height: spacing.lg }} />
    </Sheet>
  );
}
