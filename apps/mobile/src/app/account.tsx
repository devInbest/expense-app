import { useState } from 'react';
import { Alert, View } from 'react-native';
import { phoneSchema, updateProfileSchema } from '@expense/shared';
import { CurrencyField } from '@/components/CurrencyField';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { AppText, Banner, Button, Card, ErrorText, Field, Row, Screen, Section } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, errorMessage, showError } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { getGoogleIdToken, isGoogleConfigured } from '@/lib/google';
import { spacing } from '@/theme';

export default function Account() {
  const user = useUser();
  const { setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [currency, setCurrency] = useState(user.defaultCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = updateProfileSchema.safeParse({
      name,
      username: username.trim() || undefined,
      email: email.trim(),
      defaultCurrency: currency,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check your details');
    setSaving(true);
    setError(null);
    try {
      setUser(await api.me.update(parsed.data));
      Alert.alert('Saved');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const linkGoogle = async () => {
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      setUser(await api.me.linkGoogle(idToken));
      trackFeature('link_google');
    } catch (err) {
      showError(err, "Couldn't link Google");
    }
  };

  return (
    <Screen edges={[]}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
        <ProfilePhoto size={96} />
        <AppText variant="caption" muted>
          Tap to change your photo
        </AppText>
      </View>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        hint="Friends can find you by username to add you to rooms."
      />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <CurrencyField
        label="Default currency"
        value={currency}
        onChange={setCurrency}
        hint="Applies to new personal transactions. Existing ones keep their currency."
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={saving} />

      <Section title="Sign-in methods">
        <Card>
          <PhoneLink />
          <Row>
            <View style={{ flex: 1 }}>
              <AppText>Google</AppText>
              <AppText variant="caption" muted>
                {user.hasGoogle ? `Linked${user.email ? ` · ${user.email}` : ''}` : 'Not linked'}
              </AppText>
            </View>
            {!user.hasGoogle && isGoogleConfigured() ? <Button title="Link" compact variant="secondary" onPress={linkGoogle} /> : null}
          </Row>
        </Card>
      </Section>
    </Screen>
  );
}

function PhoneLink() {
  const user = useUser();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'enter' | 'verify'>('idle');
  const [devCode, setDevCode] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    const parsed = phoneSchema.safeParse(phone.startsWith('+') ? phone : `+91${phone}`);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid phone');
    try {
      const res = await api.me.requestPhoneLink(parsed.data);
      setPhone(parsed.data);
      setDevCode(res.devCode);
      setStep('verify');
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const verify = async () => {
    try {
      setUser(await api.me.verifyPhoneLink(phone, code));
      setStep('idle');
      trackFeature('link_phone');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <Row>
        <View style={{ flex: 1 }}>
          <AppText>Phone</AppText>
          <AppText variant="caption" muted>
            {user.phone ?? 'Not added — add one so friends can invite you by number'}
          </AppText>
        </View>
        {step === 'idle' ? (
          <Button title={user.phone ? 'Change' : 'Add'} compact variant="secondary" onPress={() => setStep('enter')} />
        ) : null}
      </Row>
      {step === 'enter' ? (
        <>
          <Field value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" autoFocus />
          <Button title="Send code" compact onPress={request} />
        </>
      ) : null}
      {step === 'verify' ? (
        <>
          {devCode ? <Banner icon="bug-outline" text={`Development code: ${devCode}`} /> : null}
          <Field value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" autoFocus />
          <Button title="Verify" compact onPress={verify} disabled={code.length !== 6} />
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
