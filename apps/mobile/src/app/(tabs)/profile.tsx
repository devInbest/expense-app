import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { isUpiNumber, upiIdSchema, type NotificationPrefs } from '@expense/shared';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import {
  AppText,
  Appear,
  Button,
  Card,
  Divider,
  ErrorText,
  Field,
  Glass,
  Icon,
  ListItem,
  Screen,
  Section,
  Segmented,
  Sheet,
  ToggleRow,
  useTabBarInset,
} from '@/components/ui';
import { useSyncStatus } from '@/hooks/data';
import { api, errorMessage, showError } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { config } from '@/lib/config';
import { timeAgo } from '@/lib/dates';
import { syncNow } from '@/lib/sync';
import { setThemeMode, useThemeMode } from '@/lib/themeMode';
import { spacing, useTheme } from '@/theme';

const PREFS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'roomActivity', label: 'Room activity' },
  { key: 'budgetAlerts', label: 'Budget alerts' },
  { key: 'recurringReminders', label: 'Recurring transactions' },
  { key: 'productUpdates', label: 'Product updates' },
];

export default function Profile() {
  const user = useUser();
  const { colors } = useTheme();
  const tabInset = useTabBarInset();
  const { signOut, setUser } = useAuth();
  const sync = useSyncStatus();
  const themeMode = useThemeMode();
  const [upiOpen, setUpiOpen] = useState(false);

  const updatePrefs = useMutation({
    mutationFn: (prefs: Partial<NotificationPrefs>) => api.me.update({ notificationPrefs: prefs }),
    onSuccess: setUser,
    onError: (err) => showError(err),
  });

  const confirmSignOut = () => {
    const warn = sync.pending + sync.failed > 0;
    Alert.alert(
      'Sign out?',
      warn ? `${sync.pending + sync.failed} change(s) haven't synced yet and will be lost.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  const signOutEverywhere = () =>
    Alert.alert('Sign out of all devices?', 'You will need to sign in again everywhere, including this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out all',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.auth.logoutAll();
          } finally {
            await signOut({ remote: false });
          }
        },
      },
    ]);

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'Your personal expenses, budgets and profile are permanently deleted. Shared room history stays with other members as "Former member". This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.me.deleteAccount();
              await signOut({ remote: false });
            } catch (err) {
              showError(err, "Couldn't delete account");
            }
          },
        },
      ],
    );

  return (
    <Screen contentStyle={{ paddingBottom: tabInset + spacing.lg }}>
      <Appear>
        <Glass blur rounded={30} style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm, overflow: 'hidden' }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -120,
              width: 320,
              height: 220,
              experimental_backgroundImage: `radial-gradient(circle at center, ${colors.glow} 0%, rgba(255,79,15,0) 70%)`,
            }}
          />
          <ProfilePhoto size={92} />
          <AppText variant="heading" style={{ marginTop: spacing.xs }}>
            {user.name}
          </AppText>
          <AppText muted>{user.phone ?? user.email ?? (user.username ? `@${user.username}` : '')}</AppText>
          <Pressable
            onPress={() => router.push('/account')}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.xs,
              backgroundColor: colors.primaryMuted,
              borderRadius: 999,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}>
            <Icon name="pencil-outline" size={16} color={colors.primary} />
            <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
              Edit profile
            </AppText>
          </Pressable>
        </Glass>
      </Appear>

      <Section title="Appearance">
        <Segmented
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          value={themeMode}
          onChange={setThemeMode}
        />
      </Section>

      <Section title="Money">
        <Card>
          <ListItem icon="qrcode" title="UPI ID" subtitle={!user.upiId ? 'Add so room members can pay you' : isUpiNumber(user.upiId) ? 'Change to a UPI ID so members can pay you directly' : user.upiId} onPress={() => setUpiOpen(true)} />
          <Divider />
          <ListItem icon="target" title="Budgets" onPress={() => router.push('/budgets')} />
          <Divider />
          <ListItem icon="calendar-sync" title="Recurring" onPress={() => router.push('/recurring')} />
          <Divider />
          <ListItem icon="shape-outline" title="Categories" onPress={() => router.push('/categories')} />
          <Divider />
          <ListItem icon="file-export-outline" title="Report" onPress={() => router.push('/export')} />
          <Divider />
          <ListItem icon="trash-can-outline" title="Bin" onPress={() => router.push('/bin')} />
        </Card>
      </Section>

      <Section title="Notifications">
        <Card>
          {PREFS.map((p) => (
            <ToggleRow
              key={p.key}
              label={p.label}
              value={user.notificationPrefs[p.key]}
              onChange={(v) => updatePrefs.mutate({ [p.key]: v })}
            />
          ))}
        </Card>
      </Section>

      <Section title="Security">
        <Card>
          <ListItem icon="account-outline" title="Account details" onPress={() => router.push('/account')} />
          <Divider />
          <ListItem icon="cellphone-link" title="Devices" onPress={() => router.push('/sessions')} />
          <Divider />
          <ListItem icon="logout-variant" title="Sign out of all devices" onPress={signOutEverywhere} />
        </Card>
      </Section>

      <Section title="Sync">
        <Card>
          <ListItem
            icon={sync.syncing ? 'sync' : sync.offline ? 'cloud-off-outline' : 'cloud-check-outline'}
            title={sync.syncing ? 'Syncing…' : sync.offline ? 'Offline' : 'Up to date'}
            subtitle={[
              sync.lastSyncedAt ? `Last synced ${timeAgo(sync.lastSyncedAt)}` : 'Not synced yet',
              sync.pending ? `${sync.pending} pending` : null,
              sync.failed ? `${sync.failed} failed` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => void syncNow()}
            right={<View />}
          />
        </Card>
      </Section>

      <Button title="Sign out" icon="logout" variant="secondary" onPress={confirmSignOut} />
      <Button title="Delete account" icon="delete-outline" variant="danger" onPress={deleteAccount} />
      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Version {config.appVersion} · {Platform.OS}
      </AppText>
      <UpiSheet key={String(upiOpen)} visible={upiOpen} onClose={() => setUpiOpen(false)} />
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
