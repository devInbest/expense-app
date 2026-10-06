import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { qk } from '@expense/api-client';
import { AppText, Button, Card, EmptyState, Icon, Loading, Screen } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { kv, PENDING_JOIN_KEY } from '@/lib/db';
import { spacing, useTheme } from '@/theme';

export default function JoinRoom() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode ?? '').toUpperCase();
  const { status, user } = useAuth();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const ready = status === 'signedIn' && Boolean(user?.onboarded);

  useEffect(() => {
    if (status === 'signedOut' || (status === 'signedIn' && !user?.onboarded)) {
      // Remember the link, finish sign-in/onboarding, then Home resumes the join.
      void kv.set(PENDING_JOIN_KEY, code).then(() => router.replace('/'));
    }
  }, [status, user?.onboarded, code]);

  const preview = useQuery({ queryKey: ['join', code], queryFn: () => api.rooms.preview(code), enabled: ready, retry: false });

  const join = useMutation({
    mutationFn: () => api.rooms.join(code),
    onSuccess: (room) => {
      trackFeature('room_join_link');
      void queryClient.invalidateQueries({ queryKey: qk.rooms });
      router.replace({ pathname: '/room/[id]', params: { id: room._id } });
    },
  });

  if (!ready || preview.isLoading) return <Loading />;
  if (preview.error) {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon="link-variant-off"
          title="Invite not valid"
          message={`${errorMessage(preview.error)}. Ask for a new link.`}
          action={<Button title="Go home" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }
  const room = preview.data!;

  return (
    <Screen edges={[]}>
      <Card style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={room.icon} size={36} color={colors.primary} />
        </View>
        <AppText variant="heading">{room.name}</AppText>
        <AppText muted>
          {room.type === 'split' ? 'Split expenses' : 'Shared budget'} · {room.memberCount} member{room.memberCount > 1 ? 's' : ''}
        </AppText>
      </Card>
      {room.alreadyMember ? (
        <Button title="Open room" onPress={() => router.replace({ pathname: '/room/[id]', params: { id: room._id } })} />
      ) : (
        <Button title="Join room" onPress={() => join.mutate()} loading={join.isPending} />
      )}
      {join.error ? (
        <AppText color={colors.danger} style={{ textAlign: 'center' }}>
          {errorMessage(join.error)}
        </AppText>
      ) : null}
    </Screen>
  );
}
