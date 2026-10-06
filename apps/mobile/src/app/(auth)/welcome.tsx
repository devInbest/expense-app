import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Icon, Screen } from '@/components/ui';
import { api, showError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getGoogleIdToken, isGoogleConfigured } from '@/lib/google';
import { getDeviceInfo } from '@/lib/secure';
import { spacing, useTheme } from '@/theme';

export default function Welcome() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      await signIn(await api.auth.google(idToken, await getDeviceInfo()));
    } catch (err) {
      showError(err, 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="wallet-outline" size={48} color={colors.onPrimary} />
        </View>
        <AppText variant="title">Expense</AppText>
        <AppText muted style={{ textAlign: 'center', maxWidth: 300 }}>
          Track your daily spending, set budgets, and split shared costs with friends and family.
        </AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        <Button title="Continue with phone" icon="cellphone" onPress={() => router.push('/phone')} />
        {isGoogleConfigured() ? (
          <Button
            title="Continue with Google"
            icon="google"
            variant="secondary"
            loading={googleLoading}
            onPress={continueWithGoogle}
          />
        ) : null}
        <AppText variant="caption" muted style={{ textAlign: 'center' }}>
          By continuing you agree to our Terms and Privacy Policy.
        </AppText>
      </View>
    </Screen>
  );
}
