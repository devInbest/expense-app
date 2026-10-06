import * as Localization from 'expo-localization';
import { useState } from 'react';
import { View } from 'react-native';
import { CURRENCY_CODES, DEFAULT_CURRENCY, completeOnboardingSchema } from '@expense/shared';
import { CurrencyField } from '@/components/CurrencyField';
import { AppText, Button, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { registerForPush } from '@/lib/push';
import { spacing } from '@/theme';

const detectCurrency = () => {
  const code = Localization.getLocales()[0]?.currencyCode;
  return code && CURRENCY_CODES.includes(code) ? code : DEFAULT_CURRENCY;
};

export default function Onboarding() {
  const user = useUser();
  const { setUser, signOut } = useAuth();
  const [name, setName] = useState(user.name ?? '');
  const [currency, setCurrency] = useState(detectCurrency);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = completeOnboardingSchema.safeParse({
      name,
      defaultCurrency: currency,
      timezone: Localization.getCalendars()[0]?.timeZone ?? 'Asia/Kolkata',
      locale: Localization.getLocales()[0]?.languageTag,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details');
      return;
    }
    setLoading(true);
    try {
      const updated = await api.me.onboard(parsed.data);
      setUser(updated);
      void registerForPush();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <AppText variant="title">Welcome!</AppText>
        <AppText muted>A couple of details to set things up. You can change these later.</AppText>
      </View>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" autoFocus={!user.name} error={error} />
      <CurrencyField
        label="Default currency"
        value={currency}
        onChange={setCurrency}
        hint="Used for your personal expenses. Each room picks its own currency."
      />
      <Button title="Get started" onPress={submit} loading={loading} />
      <Button title="Use a different account" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}
