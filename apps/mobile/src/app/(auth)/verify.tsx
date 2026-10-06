import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText, Banner, Button, Field, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getDeviceInfo } from '@/lib/secure';
import { spacing } from '@/theme';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ phone: string; resendIn?: string; devCode?: string }>();
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.devCode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(Number(params.resendIn ?? 30));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(await api.auth.verifyOtp(params.phone, value, await getDeviceInfo()));
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      const res = await api.auth.requestOtp(params.phone);
      setCooldown(res.resendInSeconds);
      setDevCode(res.devCode);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Enter the code</AppText>
        <AppText muted>Sent to {params.phone}</AppText>
      </View>
      {devCode ? <Banner icon="bug-outline" text={`Development build: your code is ${devCode}`} /> : null}
      <Field
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (digits.length === 6) void verify(digits);
        }}
        placeholder="••••••"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        maxLength={6}
        error={error}
        style={{ fontSize: 28, letterSpacing: 12, textAlign: 'center' }}
      />
      <Button title="Verify" onPress={() => verify()} loading={loading} disabled={code.length !== 6} />
      <Button
        title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        variant="ghost"
        disabled={cooldown > 0}
        onPress={resend}
      />
    </Screen>
  );
}
