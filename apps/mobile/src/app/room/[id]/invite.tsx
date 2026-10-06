import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { qk } from '@expense/api-client';
import { APP_SCHEME, buildInviteLink, phoneSchema, type PublicUserDTO } from '@expense/shared';
import { AppText, Avatar, Banner, Button, Card, ErrorText, Field, ListItem, Loading, Row, Screen, Section } from '@/components/ui';
import { useRoom } from '@/hooks/rooms';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/api';

// buildInviteLink strips one trailing slash, so "expenseapp://" yields "expenseapp://join/CODE".
const LINK_BASE = process.env.EXPO_PUBLIC_APP_LINK_BASE || `${APP_SCHEME}://`;

export default function Invite() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const queryClient = useQueryClient();
  const r = useRoom(id);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUserDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const invite = useMutation({
    mutationFn: (body: Parameters<typeof api.rooms.invite>[1]) => api.rooms.invite(id, body),
    onSuccess: (_, body) => {
      trackFeature(`room_invite_${body.channel}`);
      void queryClient.invalidateQueries({ queryKey: qk.roomInvites(id) });
      Alert.alert('Invite sent', body.channel === 'phone' ? "We've texted them a link to join." : "They'll see it in the app.");
      setQuery('');
      setResults(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!r.room) return <Loading />;
  const code = r.room.inviteCode;
  const link = code ? buildInviteLink(LINK_BASE, code) : null;

  const search = async () => {
    const raw = query.trim();
    if (!raw) return;
    const asPhone = /^[+\d][\d\s-]{6,}$/.test(raw) ? (raw.startsWith('+') ? raw.replace(/[\s-]/g, '') : `+91${raw.replace(/\D/g, '')}`) : null;
    setSearching(true);
    setError(null);
    try {
      setResults(await api.users.search(asPhone ?? raw.replace(/^@/, '').toLowerCase()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const phoneCandidate = (() => {
    const raw = query.trim();
    const value = raw.startsWith('+') ? raw.replace(/[\s-]/g, '') : `+91${raw.replace(/\D/g, '')}`;
    return phoneSchema.safeParse(value).success ? value : null;
  })();

  const memberIds = new Set(r.active.map((m) => m.user._id));

  return (
    <Screen edges={['bottom']}>
      {created ? <Banner icon="check-circle-outline" text={`"${r.room.name}" is ready. Invite people to start tracking together.`} /> : null}
      {!r.canInvite ? <Banner tone="warning" icon="lock-outline" text="Only room admins can invite people to this room." /> : null}

      {link && r.canInvite ? (
        <Section title="Share an invite link">
          <Card>
            <AppText variant="heading" style={{ letterSpacing: 4, textAlign: 'center' }}>
              {code}
            </AppText>
            <Row>
              <Button
                title="Share link"
                icon="share-variant"
                compact
                style={{ flex: 1 }}
                onPress={() => {
                  trackFeature('room_invite_link');
                  void Share.share({ message: `Join "${r.room!.name}" on Expense to track shared expenses: ${link}` });
                }}
              />
              <Button
                title="Copy code"
                icon="content-copy"
                compact
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  void Clipboard.setStringAsync(code!);
                  Alert.alert('Copied');
                }}
              />
            </Row>
          </Card>
        </Section>
      ) : null}

      {r.canInvite ? (
        <Section title="Add someone directly">
          <Field
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setResults(null);
            }}
            placeholder="Phone number or @username"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <Button title="Find" icon="account-search-outline" loading={searching} disabled={!query.trim()} onPress={search} />
          {results ? (
            <Card>
              {results.length ? (
                results.map((u) => (
                  <ListItem
                    key={u._id}
                    left={<Avatar name={u.name} uri={u.avatarUrl} />}
                    title={u.name}
                    subtitle={[u.username ? `@${u.username}` : null, u.phoneHint].filter(Boolean).join(' · ')}
                    right={
                      memberIds.has(u._id) ? (
                        <AppText variant="caption" muted>
                          Member
                        </AppText>
                      ) : (
                        <Button title="Invite" compact onPress={() => invite.mutate({ channel: 'user', userId: u._id })} />
                      )
                    }
                  />
                ))
              ) : (
                <>
                  <AppText muted>No one on Expense matches that.</AppText>
                  {phoneCandidate ? (
                    <Button
                      title={`Text an invite to ${phoneCandidate}`}
                      icon="message-text-outline"
                      compact
                      loading={invite.isPending}
                      onPress={() => invite.mutate({ channel: 'phone', phone: phoneCandidate })}
                    />
                  ) : null}
                </>
              )}
            </Card>
          ) : null}
          <ErrorText>{error}</ErrorText>
        </Section>
      ) : null}
    </Screen>
  );
}
