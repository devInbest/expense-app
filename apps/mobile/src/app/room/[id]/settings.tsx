import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { qk } from '@expense/api-client';
import { fromMinor, toMinor, type RoomSettings } from '@expense/shared';
import { CurrencyField } from '@/components/CurrencyField';
import { AmountInput } from '@/components/finance';
import { AppText, Banner, Button, Card, ErrorText, Field, Loading, Screen, Section, ToggleRow } from '@/components/ui';
import { useRoom } from '@/hooks/rooms';
import { api, errorMessage, showError } from '@/lib/api';
import { spacing } from '@/theme';

export default function RoomSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const r = useRoom(id);
  const room = r.room;
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const budget = useQuery({ queryKey: qk.roomBudget(id), queryFn: () => api.rooms.budgetSummary(id), enabled: room?.type === 'shared_budget' });
  const [budgetAmount, setBudgetAmount] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.room(id) });
  const update = useMutation({
    mutationFn: (body: Parameters<typeof api.rooms.update>[1]) => api.rooms.update(id, body),
    onSuccess: () => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const setBudget = useMutation({
    mutationFn: (amount: number) => api.rooms.setBudget(id, { amount, period: 'monthly' }),
    onSuccess: () => {
      void invalidate();
      Alert.alert('Budget saved');
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const archive = useMutation({
    mutationFn: (archived: boolean) => (archived ? api.rooms.archive(id) : api.rooms.unarchive(id)),
    onSuccess: () => {
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
    },
    onError: (e) => showError(e),
  });

  const remove = useMutation({
    mutationFn: () => api.rooms.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: qk.room(id) });
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      router.dismissTo('/rooms');
    },
    onError: (e) => showError(e, 'Could not delete room'),
  });

  const confirmDelete = async () => {
    if (room?.type === 'split') {
      try {
        const balances = await queryClient.fetchQuery({ queryKey: qk.roomBalances(id), queryFn: () => api.rooms.balances(id), staleTime: 0 });
        if (Object.values(balances.net).some((v) => v !== 0)) {
          Alert.alert('Settle up first', 'Some expenses aren’t fully paid yet. Restore the room, mark every share as paid, then archive and delete it.');
          return;
        }
      } catch (err) {
        showError(err);
        return;
      }
    }
    Alert.alert('Delete room?', 'All expenses, payments and members will be removed for everyone. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() },
    ]);
  };

  if (!room) return <Loading />;
  const canEdit = r.isManager && !r.archived;
  const s = room.settings;
  const toggle = (key: keyof RoomSettings) => (value: boolean) => update.mutate({ settings: { [key]: value } });
  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.sm }}>
      {!r.isManager ? <Banner icon="information-outline" text="Only the owner and admins can change room settings." /> : null}
      <Section title="Details">
        <Card>
          <Field label="Name" value={name ?? room.name} onChangeText={setName} editable={canEdit} maxLength={60} />
          <CurrencyField value={room.currency} onChange={() => {}} disabled />
          {canEdit ? (
            <Button
              title="Save"
              compact
              loading={update.isPending}
              disabled={name === null}
              onPress={() => update.mutate({ name: name ?? undefined })}
            />
          ) : null}
          <ErrorText>{error}</ErrorText>
        </Card>
      </Section>

      {room.type === 'shared_budget' ? (
        <Section title="Monthly budget">
          <Card>
            <AmountInput
              value={budgetAmount ?? (budget.data?.budget ? String(fromMinor(budget.data.budget.amount, room.currency)) : '')}
              onChange={setBudgetAmount}
              currency={room.currency}
            />
            {canEdit ? (
              <Button
                title="Save budget"
                compact
                loading={setBudget.isPending}
                onPress={() => {
                  const minor = toMinor(budgetAmount ?? '0', room.currency);
                  if (minor > 0) setBudget.mutate(minor);
                }}
              />
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section title="Permissions">
        <Card>
          {room.type === 'split' ? (
            <ToggleRow label="Simplify debts" value={s.simplifyDebts} onChange={toggle('simplifyDebts')} disabled={!canEdit} />
          ) : null}
          <ToggleRow label="Members can add expenses" value={s.membersCanAddExpense} onChange={toggle('membersCanAddExpense')} disabled={!canEdit} />
          <ToggleRow label="Members can invite people" value={s.membersCanInvite} onChange={toggle('membersCanInvite')} disabled={!canEdit} />
        </Card>
      </Section>

      {r.role === 'owner' ? (
        <Section title="More">
          <Button
            title={r.archived ? 'Restore room' : 'Archive room'}
            icon="archive-outline"
            variant="warning"
            loading={archive.isPending}
            onPress={() =>
              r.archived
                ? archive.mutate(false)
                : Alert.alert('Archive room?', 'It becomes read-only for everyone. You can restore it later.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive', style: 'destructive', onPress: () => archive.mutate(true) },
                  ])
            }
          />
          {r.archived ? <Button title="Delete room" variant="danger" loading={remove.isPending} onPress={() => void confirmDelete()} /> : null}
        </Section>
      ) : null}
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Created On {new Date(room.createdAt).toLocaleDateString()}
      </AppText>
    </Screen>
  );
}
