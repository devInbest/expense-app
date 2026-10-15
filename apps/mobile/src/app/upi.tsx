import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { isUpiNumber, upiIdSchema } from '@expense/shared';
import { QrCode } from '@/components/QrCode';
import { AppText, Appear, Banner, Button, Card, ErrorText, Field, Glass, IconButton, Row, Screen, Sheet } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { upiPayLink } from '@/lib/upi';
import { radius, spacing, useTheme } from '@/theme';

export default function UpiScreen() {
  const user = useUser();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const upiId = user.upiId;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    await Clipboard.setStringAsync(upiId!);
    setCopied(true);
  };

  return (
    <Screen edges={['bottom']} contentStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
      {!upiId ? (
        <Appear>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <AppText variant="subheading">No UPI ID yet</AppText>
            <AppText muted style={{ textAlign: 'center' }}>
              Add your UPI ID to get a QR code anyone can scan to pay you, and so room members can pay you in one tap.
            </AppText>
            <Button title="Add UPI ID" icon="plus" onPress={() => setEditing(true)} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
          </Card>
        </Appear>
      ) : (
        <>
          {isUpiNumber(upiId) ? (
            <Banner tone="warning" icon="alert-circle-outline" text="This is a UPI number. Change it to a UPI ID (like name@okicici) to get a payment QR code." />
          ) : (
            <Appear>
              <Glass blur rounded={radius.xl} style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
                <QrCode value={upiPayLink(upiId, user.name)} />
                <AppText variant="subheading" style={{ marginTop: spacing.xs }}>
                  {user.name}
                </AppText>
                <AppText muted style={{ textAlign: 'center' }}>
                  Scan with any UPI app to pay me
                </AppText>
              </Glass>
            </Appear>
          )}

          <Appear index={1}>
            <Card style={{ gap: spacing.xs }}>
              <AppText variant="caption" muted>
                UPI ID
              </AppText>
              <Row style={{ alignItems: 'center' }}>
                <AppText selectable style={{ flex: 1, fontWeight: '600' }}>
                  {upiId}
                </AppText>
                <IconButton
                  icon={copied ? 'check' : 'content-copy'}
                  label={copied ? 'Copied' : 'Copy UPI ID'}
                  color={copied ? colors.success : colors.primary}
                  onPress={() => void copy()}
                />
              </Row>
            </Card>
          </Appear>

          <Button title="Change UPI ID" icon="pencil-outline" variant="glass" color={colors.primary} onPress={() => setEditing(true)} />
        </>
      )}
      <UpiSheet key={String(editing)} visible={editing} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function UpiSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [value, setValue] = useState(user.upiId ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (upiId: string) => api.me.update({ upiId }),
    onSuccess: (updated) => {
      setUser(updated);
      onClose();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const submit = (next: string) => {
    const parsed = upiIdSchema.safeParse(next);
    if (next && !parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid UPI ID');
    setError(null);
    save.mutate(next);
  };

  return (
    <Sheet visible={visible} title="UPI ID" onClose={onClose}>
      <Field
        label="UPI ID"
        hint="Find it in your UPI app's profile. Room members can then pay you in one tap."
        value={value}
        onChangeText={setValue}
        placeholder="9876543210@ybl"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        maxLength={100}
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" loading={save.isPending && save.variables !== ''} onPress={() => submit(value.trim())} />
      {user.upiId ? <Button title="Remove" variant="ghost" loading={save.isPending && save.variables === ''} onPress={() => submit('')} /> : null}
    </Sheet>
  );
}
