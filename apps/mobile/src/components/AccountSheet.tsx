import { useMutation } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useState } from 'react';
import { View } from 'react-native';
import { LIMITS, paymentAccountSchema, type PaymentAccount, type PaymentAccountKind } from '@expense/shared';
import { Button, ErrorText, Field, Sheet } from '@/components/ui';
import { ACCOUNT_KIND_LABEL, useAccounts } from '@/lib/accounts';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/theme';

/** Which sheet is open: adding a new account of `kind`, or editing `account`. */
export type AccountEditing = { kind: PaymentAccountKind; account?: PaymentAccount } | null;

/** Saves the full list of accounts to the profile (the API replaces it wholesale). */
export const useSaveAccounts = (onDone?: () => void, onError?: (msg: string) => void) => {
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

/** Add or edit a bank account / credit card: a name and the last 4 digits. */
export function AccountSheet({ editing, onClose }: { editing: AccountEditing; onClose: () => void }) {
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
      <View style={{ height: spacing.lg }} />
    </Sheet>
  );
}
