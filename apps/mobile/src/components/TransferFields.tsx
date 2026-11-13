import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { qk } from '@expense/api-client';
import { earliestTransferDate, LIMITS, toMinor, TRANSFER_TOO_OLD_MESSAGE, type CreateTransferInput, type TransferDTO } from '@expense/shared';
import { DateField, EndpointPicker } from '@/components/finance';
import { Appear, Banner, Button, ErrorText, Field, Section } from '@/components/ui';
import { transferEndpoints, useAccounts } from '@/lib/accounts';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, isOffline } from '@/lib/api';
import { spacing } from '@/theme';

/**
 * Everything in the self transfer form below the amount: date, note, From, To and Save.
 * The amount input lives with the caller, so the Add transaction page can share it across its tabs.
 */
export function TransferFields({ existing, amount, currency }: { existing?: TransferDTO; amount: string; currency: string }) {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const endpoints = useMemo(() => {
    const list = transferEndpoints(accounts);
    // Keep an end that was removed since visible, so editing an old transfer still shows where it went.
    for (const id of [existing?.fromAccount, existing?.toAccount]) {
      if (id && !list.some((e) => e.id === id))
        list.push({
          id,
          label: 'Removed account',
          icon: 'help-circle-outline',
        });
    }
    return list;
  }, [accounts, existing]);

  const [maxDate] = useState(() => new Date(Date.now() + 86_400_000));
  const [minDate] = useState(() => earliestTransferDate());
  const [from, setFrom] = useState(existing?.fromAccount ?? '');
  const [to, setTo] = useState(existing?.toAccount ?? '');
  const [date, setDate] = useState(() => (existing ? new Date(existing.occurredAt) : new Date()));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const minor = toMinor(amount || '0', currency);
      if (minor <= 0) throw new Error('Enter an amount');
      if (minor > LIMITS.MAX_AMOUNT_MINOR) throw new Error('That amount is too large');
      if (!from) throw new Error('Pick where the money came from');
      if (!to) throw new Error('Pick where the money went');
      if (from === to) throw new Error('Pick two different accounts');
      const dateChanged = !existing || date.getTime() !== new Date(existing.occurredAt).getTime();
      if (dateChanged && date < minDate) throw new Error(TRANSFER_TOO_OLD_MESSAGE);
      const body = {
        amount: minor,
        fromAccount: from,
        toAccount: to,
        occurredAt: date.toISOString(),
        note: note.trim(),
      };
      return existing
        ? api.transfers.update(existing._id, body)
        : api.transfers.create({
            ...body,
            currency: currency as CreateTransferInput['currency'],
          });
    },
    onSuccess: () => {
      trackFeature(existing ? 'transfer_edit' : 'transfer_add');
      void queryClient.invalidateQueries({ queryKey: qk.transfersAll });
      router.back();
    },
    onError: (err: unknown) => setError(isOffline(err) ? 'Self transfers need an internet connection.' : errorMessage(err)),
  });

  // Editing: Save stays off until something actually differs from the saved transfer.
  const changed =
    !existing ||
    toMinor(amount || '0', currency) !== existing.amount ||
    from !== existing.fromAccount ||
    to !== existing.toAccount ||
    date.getTime() !== new Date(existing.occurredAt).getTime() ||
    note.trim() !== existing.note;

  const pickFrom = (id: string) => {
    setFrom(id);
    if (id === to) setTo('');
  };

  return (
    <>
      <Appear index={1} style={{ gap: spacing.lg }}>
        <DateField label="Date" value={date} onChange={setDate} maximumDate={maxDate} minimumDate={minDate} />
        <Field label="Note" value={note} onChangeText={setNote} placeholder="What was it for?" maxLength={280} />
      </Appear>

      {!accounts.length ? (
        <Banner icon="bank-outline" text="Add a bank account or credit card in Profile → Accounts to move money between them and cash." />
      ) : null}

      <Appear index={2} style={{ gap: spacing.lg }}>
        <Section title="From">
          <EndpointPicker endpoints={endpoints} value={from} onChange={pickFrom} />
        </Section>
        <Section title="To">
          <EndpointPicker endpoints={endpoints.filter((e) => e.id !== from)} value={to} onChange={setTo} />
        </Section>

        <View style={{ gap: spacing.sm }}>
          <ErrorText>{error}</ErrorText>
          <Button title={existing ? 'Save changes' : 'Save'} loading={save.isPending} disabled={!changed} onPress={() => save.mutate()} />
        </View>
      </Appear>
    </>
  );
}
