import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { qk } from '@expense/api-client';
import { fromMinor, type TransferDTO } from '@expense/shared';
import { AmountInput } from '@/components/finance';
import { TransferFields } from '@/components/TransferFields';
import { Appear, ErrorState, Glass, Loading, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { radius, spacing } from '@/theme';

/** Edits a saved self transfer. New transfers are added from the Add transaction page's Self Transfer tab. */
export default function TransferForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'new')
    return (
      <Redirect
        href={{
          pathname: '/transaction/[id]',
          params: { id: 'new', type: 'transfer' },
        }}
      />
    );
  return <EditTransfer id={id} />;
}

function EditTransfer({ id }: { id: string }) {
  const transfer = useQuery({
    queryKey: qk.transfer(id),
    queryFn: () => api.transfers.get(id),
  });
  if (transfer.isPending) return <Loading />;
  if (transfer.isError) return <ErrorState message={errorMessage(transfer.error)} onRetry={() => void transfer.refetch()} />;
  return <EditTransferBody existing={transfer.data} />;
}

function EditTransferBody({ existing }: { existing: TransferDTO }) {
  const [amount, setAmount] = useState(String(fromMinor(existing.amount, existing.currency)));
  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.lg }}>
      <Stack.Screen options={{ title: 'Edit self transfer' }} />
      <Appear>
        <Glass blur style={{ padding: spacing.md, gap: spacing.xs }} rounded={radius.xl}>
          <AmountInput value={amount} onChange={setAmount} currency={existing.currency} />
        </Glass>
      </Appear>
      <TransferFields existing={existing} amount={amount} currency={existing.currency} />
    </Screen>
  );
}
