import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Alert } from 'react-native';
import { qk } from '@expense/api-client';
import { AppText, Button, Card, Divider, ErrorState, ListItem, Loading, Screen } from '@/components/ui';
import { api, errorMessage, showError } from '@/lib/api';
import { timeAgo } from '@/lib/dates';

const PLATFORM_ICON: Record<string, string> = { ios: 'apple', android: 'android', web: 'web' };

export default function Sessions() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: api.me.sessions });
  const revoke = useMutation({
    mutationFn: (id: string) => api.me.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessions }),
    onError: (err) => showError(err),
  });

  if (sessions.isLoading) return <Loading />;
  if (sessions.error) return <ErrorState message={errorMessage(sessions.error)} onRetry={() => void sessions.refetch()} />;

  return (
    <Screen edges={[]}>
      <AppText muted>If you see a device you don’t recognise, sign it out and secure your phone number.</AppText>
      <Card>
        {sessions.data?.map((s, i) => (
          <Fragment key={s._id}>
            {i > 0 ? <Divider /> : null}
            <ListItem
              icon={PLATFORM_ICON[s.platform] ?? 'devices'}
              title={`${s.deviceName ?? s.platform}${s.current ? ' (this device)' : ''}`}
              subtitle={`Active ${timeAgo(s.lastUsedAt)}${s.appVersion ? ` · v${s.appVersion}` : ''}`}
              right={
                s.current ? undefined : (
                  <Button
                    title="Sign out"
                    compact
                    variant="ghost"
                    onPress={() =>
                      Alert.alert('Sign out this device?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign out', style: 'destructive', onPress: () => revoke.mutate(s._id) },
                      ])
                    }
                  />
                )
              }
            />
          </Fragment>
        ))}
      </Card>
    </Screen>
  );
}
