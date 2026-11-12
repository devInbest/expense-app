import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { qk } from '@expense/api-client';
import { fromMinor, LIMITS, toMinor, type CreateTransferInput, type TransferDTO } from '@expense/shared';
import { AmountInput, DateField } from '@/components/finance';
import { popup } from '@/components/popup';
import { Appear, Banner, Button, Chip, ErrorState, ErrorText, Field, Glass, Loading, Row, Screen, Section } from '@/components/ui';
import { transferEndpoints, useAccounts, type TransferEndpoint } from '@/lib/accounts';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, isOffline } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { radius, spacing, useTheme } from '@/theme';

/** `new` records a self transfer; any other id edits that transfer. */
export default function TransferForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'new') return <TransferFormBody />;
  return <EditTransfer id={id} />;
}

function EditTransfer({ id }: { id: string }) {
  const transfer = useQuery({ queryKey: qk.transfer(id), queryFn: () => api.transfers.get(id) });
  if (transfer.isPending) return <Loading />;
  if (transfer.isError) return <ErrorState message={errorMessage(transfer.error)} onRetry={() => void transfer.refetch()} />;
  return <TransferFormBody existing={transfer.data} />;
}

function EndpointChips({
  endpoints,
  value,
  onChange,
}: {
  endpoints: TransferEndpoint[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      {endpoints.map((e) => (
        <Chip key={e.id} label={e.label} icon={e.icon} selected={value === e.id} onPress={() => onChange(e.id)} />
      ))}
    </Row>
  );
}

function TransferFormBody({ existing }: { existing?: TransferDTO }) {
  const user = useUser();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const endpoints = useMemo(() => {
    const list = transferEndpoints(accounts);
    // Keep an end that was removed since visible, so editing an old transfer still shows where it went.
    for (const id of [existing?.fromAccount, existing?.toAccount]) {
      if (id && !list.some((e) => e.id === id)) list.push({ id, label: 'Removed account', icon: 'help-circle-outline' });
    }
    return list;
  }, [accounts, existing]);

  const currency = existing?.currency ?? user.defaultCurrency;
  const [maxDate] = useState(() => new Date(Date.now() + 86_400_000));
  const [amount, setAmount] = useState(existing ? String(fromMinor(existing.amount, existing.currency)) : '');
  const [from, setFrom] = useState(existing?.fromAccount ?? '');
  const [to, setTo] = useState(existing?.toAccount ?? '');
  const [date, setDate] = useState(() => (existing ? new Date(existing.occurredAt) : new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: qk.transfersAll });
    router.back();
  };
  const onError = (err: unknown) => setError(isOffline(err) ? 'Self transfers need an internet connection.' : errorMessage(err));

  const save = useMutation({
    mutationFn: () => {
      const minor = toMinor(amount || '0', currency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (minor > LIMITS.MAX_AMOUNT_MINOR) throw new Error('That amount is too large');
      if (!from) throw new Error('Pick where the money came from');
      if (!to) throw new Error('Pick where the money went');
      if (from === to) throw new Error('Pick two different accounts');
      const body = { amount: minor, fromAccount: from, toAccount: to, occurredAt: date.toISOString(), note: note.trim() };
      return existing ? api.transfers.update(existing._id, body) : api.transfers.create({ ...body, currency: currency as CreateTransferInput['currency'] });
    },
    onSuccess: () => {
      trackFeature(existing ? 'transfer_edit' : 'transfer_add');
      done();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: () => api.transfers.remove(existing!._id),
    onSuccess: done,
    onError,
  });

  const confirmRemove = () =>
    popup.confirm({
      title: 'Delete this transfer?',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate(),
    });

  const pickFrom = (id: string) => {
    setFrom(id);
    if (id === to) setTo('');
  };

  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.lg }}>
      <Stack.Screen options={{ title: existing ? 'Edit self transfer' : 'Self transfer' }} />
      <Appear>
        <Glass blur style={{ padding: spacing.md, gap: spacing.xs }} rounded={radius.xl}>
          <AmountInput value={amount} onChange={setAmount} currency={currency} autoFocus={!existing} />
        </Glass>
      </Appear>

      {!accounts.length ? (
        <Banner
          icon="bank-outline"
          text="Add a bank account or credit card in Profile → Accounts to move money between them and cash."
        />
      ) : null}

      <Appear index={1} style={{ gap: spacing.lg }}>
        <Section title="From">
          <EndpointChips endpoints={endpoints} value={from} onChange={pickFrom} />
        </Section>
        <Section title="To">
          <EndpointChips endpoints={endpoints.filter((e) => e.id !== from)} value={to} onChange={setTo} />
        </Section>

        <DateField label="Date" value={date} onChange={setDate} maximumDate={maxDate} />
        <Field label="Note" value={note} onChangeText={setNote} placeholder="What was it for?" maxLength={280} />

        <View style={{ gap: spacing.sm }}>
          <ErrorText>{error}</ErrorText>
          <Button title={existing ? 'Save changes' : 'Save'} loading={save.isPending} onPress={() => save.mutate()} />
          {existing ? (
            <Button title="Delete" variant="ghost" color={colors.danger} loading={remove.isPending} onPress={confirmRemove} />
          ) : null}
        </View>
      </Appear>
    </Screen>
  );
}
