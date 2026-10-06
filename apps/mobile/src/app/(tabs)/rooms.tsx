import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import { formatMoney } from '@expense/shared';
import { AppText, Banner, Button, Card, EmptyState, ErrorState, Field, Icon, IconButton, Loading, Row, Screen, Sheet } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { spacing, useTheme } from '@/theme';

const LONG_PRESS_MS = 1000;

export default function Rooms() {
  const { colors } = useTheme();
  const user = useUser();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [joinOpen, setJoinOpen] = useState(false);
  const rooms = useQuery({ queryKey: [...qk.rooms, { showArchived }], queryFn: () => api.rooms.list(showArchived) });
  const invites = useQuery({ queryKey: qk.myInvites, queryFn: api.invites.mine });
  const visibleRooms = (rooms.data ?? []).filter((r) => !!r.archivedAt === showArchived);
  const splitRooms = visibleRooms.filter((r) => r.type === 'split');
  const totals = new Map<string, { paid: number; remaining: number }>();
  for (const r of splitRooms) {
    const t = totals.get(r.currency) ?? { paid: 0, remaining: 0 };
    t.paid += r.myPaid ?? 0;
    t.remaining += Math.max(0, -(r.myBalance ?? 0));
    totals.set(r.currency, t);
  }
  const sumLabel = (key: 'paid' | 'remaining') =>
    [...totals].map(([currency, t]) => formatMoney(t[key], currency)).join(' + ') || formatMoney(0, user.defaultCurrency);

  const refresh = () => {
    void rooms.refetch();
    void invites.refetch();
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeSelected = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => api.rooms.remove(id)));
      return results.flatMap((r, i) => (r.status === 'rejected' ? [{ id: ids[i]!, reason: r.reason as unknown }] : []));
    },
    onSuccess: (failed) => {
      setSelected(new Set(failed.map((f) => f.id)));
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      if (failed.length) Alert.alert('Some rooms weren’t deleted', errorMessage(failed[0]!.reason));
    },
  });

  const confirmDelete = () => {
    const count = selected.size;
    Alert.alert(
      `Delete ${count} room${count > 1 ? 's' : ''}?`,
      'All expenses, payments and members will be removed for everyone. Split rooms must be fully settled. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeSelected.mutate([...selected]) },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen contentStyle={{ flexGrow: 1, paddingBottom: spacing.lg }} refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={refresh} />}>
        <Row>
          <AppText variant={selected.size ? 'subheading' : 'title'} style={{ flex: 1 }}>
            {selected.size ? `${selected.size} selected` : 'Rooms'}
          </AppText>
          {selected.size ? (
            <>
              <IconButton icon="close" label="Clear selection" onPress={() => setSelected(new Set())} />
              <IconButton icon="trash-can-outline" label="Delete selected rooms" color={colors.danger} onPress={confirmDelete} />
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showArchived ? 'Show active rooms' : 'Show archived rooms'}
              accessibilityState={{ selected: showArchived }}
              hitSlop={8}
              onPress={() => setShowArchived((v) => !v)}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: showArchived ? colors.primary : colors.surfaceAlt,
                opacity: pressed ? 0.7 : 1,
              })}>
              <Icon name={showArchived ? 'archive' : 'archive-outline'} size={20} color={showArchived ? colors.onPrimary : colors.textMuted} />
            </Pressable>
          )}
        </Row>

        {invites.data?.length ? (
          <Banner icon="email-outline" text={`${invites.data.length} pending invite${invites.data.length > 1 ? 's' : ''}`} onPress={() => router.push('/invites')} />
        ) : null}

        {!showArchived && splitRooms.length ? (
          <Row gap={spacing.md}>
            <Card style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
              <AppText variant="caption" muted>
                You paid
              </AppText>
              <AppText variant="subheading" color={colors.success} style={{ fontVariant: ['tabular-nums'] }}>
                {sumLabel('paid')}
              </AppText>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
              <AppText variant="caption" muted>
                Remaining balance
              </AppText>
              <AppText variant="subheading" color={colors.danger} style={{ fontVariant: ['tabular-nums'] }}>
                {sumLabel('remaining')}
              </AppText>
            </Card>
          </Row>
        ) : null}

        {rooms.isLoading ? (
          <Loading />
        ) : rooms.error ? (
          <ErrorState message={errorMessage(rooms.error)} onRetry={() => void rooms.refetch()} />
        ) : visibleRooms.length ? (
          visibleRooms.map((r) => {
            const bal = r.myBalance ?? 0;
            const selectable = showArchived && r.myRole === 'owner';
            const isSelected = selected.has(r._id);
            return (
              <Card
                key={r._id}
                style={isSelected ? { borderWidth: 2, borderColor: colors.primary } : undefined}
                delayLongPress={LONG_PRESS_MS}
                onLongPress={selectable ? () => toggleSelected(r._id) : undefined}
                onPress={() =>
                  selected.size && selectable ? toggleSelected(r._id) : router.push({ pathname: '/room/[id]', params: { id: r._id } })
                }>
                <Row gap={spacing.md}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: isSelected ? colors.primary : colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={isSelected ? 'check' : r.icon} color={isSelected ? colors.surface : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="subheading" numberOfLines={1}>
                      {r.name}
                    </AppText>
                    <AppText variant="caption" muted>
                      {r.memberCount ?? 1} member{(r.memberCount ?? 1) > 1 ? 's' : ''}
                    </AppText>
                  </View>
                  {r.type === 'split' && bal !== 0 ? (
                    <AppText color={bal > 0 ? colors.success : colors.danger} style={{ fontWeight: '600' }}>
                      {formatMoney(Math.abs(bal), r.currency)}
                    </AppText>
                  ) : null}
                </Row>
              </Card>
            );
          })
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState icon="account-group-outline" title={showArchived ? 'No archived rooms' : 'No rooms yet'} />
          </View>
        )}
      </Screen>
      <Row style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Button title="Create Room" style={{ flex: 1 }} onPress={() => router.push('/room/new')} />
        <Button title="Join Room" variant="secondary" style={{ flex: 1 }} onPress={() => setJoinOpen(true)} />
      </Row>
      {joinOpen ? <JoinSheet onClose={() => setJoinOpen(false)} /> : null}
    </View>
  );
}

function JoinSheet({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const submit = () => {
    const clean = code.trim().toUpperCase().replace(/.*\/JOIN\//, '');
    if (!/^[A-Z0-9]{6,12}$/.test(clean)) {
      Alert.alert('Invalid code', 'Paste the invite link or enter the code you were sent.');
      return;
    }
    onClose();
    router.push({ pathname: '/join/[code]', params: { code: clean } });
  };
  return (
    <Sheet visible title="Join a room" onClose={onClose}>
      <Field label="Invite code or link" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} autoFocus placeholder="e.g. K7Q2M9XD" />
      <Button title="Continue" onPress={submit} />
    </Sheet>
  );
}
