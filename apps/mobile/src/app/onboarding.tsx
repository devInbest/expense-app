import * as Localization from 'expo-localization';
import { useState } from 'react';
import { CURRENCY_CODES, DEFAULT_CURRENCY, completeOnboardingSchema } from '@expense/shared';
import { AuthHeader } from '@/components/AuthHeader';
import { CurrencyField } from '@/components/CurrencyField';
import { Appear, Button, Field, Glass, Screen } from '@/components/ui';
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
    <Screen edges={['top', 'bottom']} contentStyle={{ gap: spacing.xl, paddingTop: spacing.xxl }}>
      <AuthHeader icon="hand-wave-outline" title="Welcome!" subtitle="A couple of details to set things up. You can change these later." />
      <Appear index={1}>
        <Glass style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" autoFocus={!user.name} error={error} />
          <CurrencyField
            label="Default currency"
            value={currency}
            onChange={setCurrency}
            hint="Used for your personal expenses. Each room picks its own currency."
          />
        </Glass>
      </Appear>
      <Appear index={2} style={{ gap: spacing.sm }}>
        <Button title="Get started" icon="rocket-launch-outline" onPress={submit} loading={loading} />
        <Button title="Use a different account" variant="ghost" onPress={() => void signOut()} />
      </Appear>
    </Screen>
  );
}
