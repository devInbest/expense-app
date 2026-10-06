import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { phoneSchema } from '@expense/shared';
import { AppText, Button, Field, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { spacing } from '@/theme';

export default function PhoneScreen() {
  const [countryCode, setCountryCode] = useState('+91');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = phoneSchema.safeParse(`${countryCode}${number.replace(/\D/g, '')}`);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth.requestOtp(parsed.data);
      router.push({
        pathname: '/verify',
        params: { phone: parsed.data, resendIn: String(res.resendInSeconds), devCode: res.devCode ?? '' },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Your phone number</AppText>
        <AppText muted>We’ll text you a 6-digit code to sign in. Standard SMS rates may apply.</AppText>
      </View>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 84 }}>
          <Field value={countryCode} onChangeText={(t) => setCountryCode(`+${t.replace(/\D/g, '').slice(0, 4)}`)} keyboardType="phone-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            value={number}
            onChangeText={setNumber}
            placeholder="98765 43210"
            keyboardType="phone-pad"
            autoFocus
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={error}
            onSubmitEditing={submit}
          />
        </View>
      </Row>
      <Button title="Send code" onPress={submit} loading={loading} disabled={number.replace(/\D/g, '').length < 6} />
    </Screen>
  );
}
