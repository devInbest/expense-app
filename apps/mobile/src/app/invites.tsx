import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { qk } from '@expense/api-client';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, Loading, Row, Screen } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, showError } from '@/lib/api';
import { timeAgo } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';

export default function Invites() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const invites = useQuery({ queryKey: qk.myInvites, queryFn: api.invites.mine });

  const accept = useMutation({
    mutationFn: (inviteId: string) => api.invites.accept(inviteId),
    onSuccess: (room) => {
      trackFeature('room_invite_accept');
      void queryClient.invalidateQueries({ queryKey: qk.myInvites });
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      router.replace({ pathname: '/room/[id]', params: { id: room._id } });
    },
    onError: (err) => showError(err),
  });
  const decline = useMutation({
    mutationFn: (inviteId: string) => api.invites.decline(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.myInvites }),
    onError: (err) => showError(err),
  });

  if (invites.isLoading) return <Loading />;
  if (invites.error) return <ErrorState message={errorMessage(invites.error)} onRetry={() => void invites.refetch()} />;

  return (
    <Screen edges={[]}>
      {invites.data?.length ? (
        invites.data.map((inv) => (
          <Card key={inv._id}>
            <Row gap={spacing.md}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={inv.room.icon} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="subheading">{inv.room.name}</AppText>
                <AppText variant="caption" muted>
                  {inv.invitedBy.name} invited you · {timeAgo(inv.createdAt)}
                </AppText>
              </View>
            </Row>
            <Row>
              <Button title="Decline" variant="ghost" compact style={{ flex: 1 }} onPress={() => decline.mutate(inv._id)} />
              <Button title="Join" compact style={{ flex: 1 }} loading={accept.isPending} onPress={() => accept.mutate(inv._id)} />
            </Row>
          </Card>
        ))
      ) : (
        <EmptyState icon="email-open-outline" title="No pending invites" message="When someone adds you to a room, it shows up here." />
      )}
    </Screen>
  );
}
