import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiClientError, qk } from '@expense/api-client';
import type { RoomMemberDTO } from '@expense/shared';
import { AppText, Avatar, Button, Card, Divider, ErrorState, ListItem, Loading, Row, Screen, Section } from '@/components/ui';
import { useRoom } from '@/hooks/rooms';
import { api, errorMessage, showError } from '@/lib/api';
import { timeAgo } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

const ROLE_LABEL = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
} as const;

export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const r = useRoom(id);
  const invites = useQuery({
    queryKey: qk.roomInvites(id),
    queryFn: () => api.rooms.invites(id),
    enabled: r.canInvite,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.room(id) });
  const onError = (err: unknown) => showError(err);

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'member' }) => api.rooms.updateMemberRole(id, userId, role),
    onSuccess: invalidate,
    onError,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.rooms.removeMember(id, userId),
    onSuccess: invalidate,
    onError,
  });
  const transfer = useMutation({
    mutationFn: (userId: string) => api.rooms.transferOwnership(id, userId),
    onSuccess: invalidate,
    onError,
  });
  const revoke = useMutation({
    mutationFn: (inviteId: string) => api.rooms.revokeInvite(id, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.roomInvites(id) }),
    onError,
  });
  const leave = useMutation({
    mutationFn: () => api.rooms.leave(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      router.dismissTo('/rooms');
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === 'UNSETTLED_BALANCE') {
        Alert.alert(
          'Settle up first',
          'You still owe or are owed money in this room. Each expense is settled when the person who added it marks the shares as paid.',
        );
      } else if (err instanceof ApiClientError && err.code === 'OWNER_MUST_TRANSFER') {
        Alert.alert('Transfer ownership first', 'Make someone else the owner before you leave, or archive the room.');
      } else {
        showError(err);
      }
    },
  });

  const manage = (m: RoomMemberDTO) => {
    if (m.user._id === r.me || m.role === 'owner' || !r.isManager) return;
    const actions: {
      text: string;
      style?: 'destructive' | 'cancel';
      onPress?: () => void;
    }[] = [];
    if (r.role === 'owner') {
      actions.push({
        text: m.role === 'admin' ? 'Make member' : 'Make admin',
        onPress: () =>
          setRole.mutate({
            userId: m.user._id,
            role: m.role === 'admin' ? 'member' : 'admin',
          }),
      });
      actions.push({
        text: 'Make owner',
        onPress: () =>
          Alert.alert(`Make ${m.user.name} the owner?`, 'You will become an admin.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Transfer', onPress: () => transfer.mutate(m.user._id) },
          ]),
      });
    }
    actions.push({
      text: 'Remove from room',
      style: 'destructive',
      onPress: () =>
        Alert.alert(`Remove ${m.user.name}?`, 'Their past expenses stay in the room history.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeMember.mutate(m.user._id),
          },
        ]),
    });
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(m.user.name, ROLE_LABEL[m.role], actions);
  };

  if (r.isLoading) return <Loading />;
  if (r.error || !r.room) return <ErrorState message={errorMessage(r.error)} onRetry={() => void r.refetch()} />;

  const former = r.members.filter((m) => m.status !== 'active');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen edges={[]} contentStyle={{ paddingBottom: spacing.lg }}>
        <Section title={`Members (${r.active.length})`}>
          <Card>
            {r.active.map((m, i) => (
              <View key={m._id}>
                {i > 0 ? <Divider /> : null}
                <ListItem
                  left={<Avatar name={m.user.name} uri={m.user.avatarUrl} />}
                  title={m.user._id === r.me ? `${m.user.name} (you)` : m.user.name}
                  subtitle={[m.user.username ? `@${m.user.username}` : null, m.user.phoneHint].filter(Boolean).join(' · ') || undefined}
                  right={
                    <AppText variant="caption" color={m.role === 'member' ? colors.textMuted : colors.primary}>
                      {ROLE_LABEL[m.role]}
                    </AppText>
                  }
                  onPress={r.isManager && m.user._id !== r.me && m.role !== 'owner' ? () => manage(m) : undefined}
                />
              </View>
            ))}
          </Card>
        </Section>

        {r.canInvite && invites.data?.length ? (
          <Section title="Pending invites">
            <Card>
              {invites.data.map((inv) => (
                <Row key={inv._id}>
                  <View style={{ flex: 1 }}>
                    <AppText>{inv.targetUser?.name ?? inv.phone ?? 'Invite'}</AppText>
                    <AppText variant="caption" muted>
                      Sent {timeAgo(inv.createdAt)} · expires {timeAgo(inv.expiresAt).replace(' ago', '')}
                    </AppText>
                  </View>
                  <Button title="Revoke" compact variant="ghost" onPress={() => revoke.mutate(inv._id)} />
                </Row>
              ))}
            </Card>
          </Section>
        ) : null}

        {former.length ? (
          <Section title="Former members">
            <Card>
              {former.map((m) => (
                <ListItem
                  key={m._id}
                  left={<Avatar name={m.user.name} uri={m.user.avatarUrl} />}
                  title={m.user.name}
                  subtitle={m.status === 'removed' ? 'Removed' : 'Left'}
                />
              ))}
            </Card>
          </Section>
        ) : null}
      </Screen>
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Row>
          {r.canInvite ? (
            <Button
              title="Invite people"
              icon="account-plus-outline"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/room/[id]/invite', params: { id } })}
            />
          ) : null}
          <Button
            title="Leave room"
            icon="logout"
            variant="danger"
            style={{ flex: 1 }}
            loading={leave.isPending}
            onPress={() =>
              Alert.alert('Leave this room?', "You'll lose access to its expenses.", [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: () => leave.mutate(),
                },
              ])
            }
          />
        </Row>
      </SafeAreaView>
    </View>
  );
}
