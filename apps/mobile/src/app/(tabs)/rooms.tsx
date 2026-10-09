import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';
import { qk } from '@expense/api-client';
import { formatMoney } from '@expense/shared';
import {
  AppText,
  Appear,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Glass,
  Icon,
  IconButton,
  linearGradient,
  Loading,
  Row,
  Screen,
  Sheet,
  useTabBarInset,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { radius, spacing, useTheme } from '@/theme';

const LONG_PRESS_MS = 1000;

function SummaryTile({ label, icon, tone, value }: { label: string; icon: string; tone: string; value: string }) {
  return (
    <Glass style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      <Row gap={spacing.sm}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${tone}1F`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={tone} />
        </View>
        <AppText variant="caption" muted style={{ fontWeight: '600' }}>
          {label}
        </AppText>
      </Row>
      <AppText variant="subheading" color={tone} numberOfLines={1} adjustsFontSizeToFit style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </Glass>
  );
}

export default function Rooms() {
  const { colors } = useTheme();
  const tabInset = useTabBarInset();
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
    <View style={{ flex: 1 }}>
      <Screen
        contentStyle={{ flexGrow: 1, paddingBottom: tabInset + 90 }}
        refreshControl={<RefreshControl refreshing={rooms.isRefetching} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <Appear>
          <Row>
            <AppText variant={selected.size ? 'heading' : 'title'} style={{ flex: 1 }}>
              {selected.size ? `${selected.size} selected` : showArchived ? 'Archived' : 'Rooms'}
            </AppText>
            {selected.size ? (
              <>
                <IconButton glass icon="close" label="Clear selection" onPress={() => setSelected(new Set())} />
                <IconButton glass icon="trash-can-outline" label="Delete selected rooms" color={colors.danger} onPress={confirmDelete} />
              </>
            ) : (
              <IconButton
                glass
                icon={showArchived ? 'archive' : 'archive-outline'}
                label={showArchived ? 'Show active rooms' : 'Show archived rooms'}
                color={showArchived ? colors.primary : colors.textMuted}
                onPress={() => setShowArchived((v) => !v)}
              />
            )}
          </Row>
        </Appear>

        {invites.data?.length ? (
          <Banner icon="email-outline" text={`${invites.data.length} pending invite${invites.data.length > 1 ? 's' : ''}`} onPress={() => router.push('/invites')} />
        ) : null}

        {!showArchived && splitRooms.length ? (
          <Appear index={1}>
            <Row gap={spacing.md}>
              <SummaryTile label="You paid" icon="check-decagram-outline" tone={colors.success} value={sumLabel('paid')} />
              <SummaryTile label="Remaining" icon="clock-outline" tone={colors.primary} value={sumLabel('remaining')} />
            </Row>
          </Appear>
        ) : null}

        {rooms.isLoading ? (
          <Loading />
        ) : rooms.error ? (
          <ErrorState message={errorMessage(rooms.error)} onRetry={() => void rooms.refetch()} />
        ) : visibleRooms.length ? (
          visibleRooms.map((r, i) => {
            const bal = r.myBalance ?? 0;
            const selectable = showArchived && r.myRole === 'owner';
            const isSelected = selected.has(r._id);
            const tone = bal > 0 ? colors.success : colors.danger;
            return (
              <Appear key={r._id} index={i + 2}>
                <Card
                  style={isSelected ? { borderWidth: 2, borderColor: colors.primary } : undefined}
                  delayLongPress={LONG_PRESS_MS}
                  onLongPress={selectable ? () => toggleSelected(r._id) : undefined}
                  onPress={() =>
                    selected.size && selectable ? toggleSelected(r._id) : router.push({ pathname: '/room/[id]', params: { id: r._id } })
                  }>
                  <Row gap={spacing.md}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 16,
                        backgroundColor: colors.primary,
                        experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
                        boxShadow: `0 6px 14px ${colors.primaryGlow}`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Icon name={isSelected ? 'check' : r.icon} color={colors.onPrimary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="subheading" numberOfLines={1}>
                        {r.name}
                      </AppText>
                      <Row gap={4}>
                        <Icon name="account-multiple-outline" size={14} color={colors.textMuted} />
                        <AppText variant="caption" muted>
                          {r.memberCount ?? 1} member{(r.memberCount ?? 1) > 1 ? 's' : ''}
                        </AppText>
                      </Row>
                    </View>
                    {r.type === 'split' && bal !== 0 ? (
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <View style={{ backgroundColor: `${tone}1A`, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 }}>
                          <AppText color={tone} style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                            {formatMoney(Math.abs(bal), r.currency)}
                          </AppText>
                        </View>
                        <AppText variant="caption" muted style={{ fontSize: 11 }}>
                          {bal > 0 ? 'you get back' : 'you owe'}
                        </AppText>
                      </View>
                    ) : (
                      <Icon name="chevron-right" size={20} color={colors.textSubtle} />
                    )}
                  </Row>
                </Card>
              </Appear>
            );
          })
        ) : (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="account-group-outline"
              title={showArchived ? 'No archived rooms' : 'No rooms yet'}
              message={showArchived ? undefined : 'Create a room to share expenses with friends, family or flatmates.'}
            />
          </View>
        )}
      </Screen>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: tabInset }}>
        <Glass rounded={999} style={{ flexDirection: 'row', gap: spacing.sm, padding: 6, backgroundColor: colors.surface }}>
          <Button title="Create Room" icon="plus" style={{ flex: 1 }} onPress={() => router.push('/room/new')} />
          <Button title="Join Room" icon="link-variant" variant="secondary" style={{ flex: 1 }} onPress={() => setJoinOpen(true)} />
        </Glass>
      </View>
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
      <Field
        label="Invite code or link"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        placeholder=" e.g. K7Q2M9XD"
        style={{ paddingHorizontal: 16, paddingVertical: 18 }}
      />
      <Button title="Continue" icon="arrow-right" onPress={submit} />
    </Sheet>
  );
}
