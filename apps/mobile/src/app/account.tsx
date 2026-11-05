import { useState } from 'react';
import { View } from 'react-native';
import { popup } from '@/components/popup';
import { phoneSchema, updateProfileSchema } from '@expense/shared';
import { CurrencyField } from '@/components/CurrencyField';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { AppText, Banner, Button, Card, Field, Row, Screen, Section } from '@/components/ui';
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
  const [invalid, setInvalid] = useState<Partial<Record<'name' | 'username' | 'email' | 'defaultCurrency', boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<'name' | 'username' | 'email' | 'phone' | 'currency' | null>(null);

  const clearInvalid = (field: 'name' | 'username' | 'email' | 'defaultCurrency') =>
    setInvalid((current) => (current[field] ? { ...current, [field]: false } : current));

  const dirty =
    name.trim() !== user.name.trim() ||
    username.trim() !== (user.username ?? '') ||
    email.trim() !== (user.email ?? '') ||
    currency !== user.defaultCurrency;

  const save = async () => {
    const parsed = updateProfileSchema.safeParse({
      name,
      username: username.trim() || undefined,
      email: email.trim(),
      defaultCurrency: currency,
    });
    if (!parsed.success) {
      const next: Partial<Record<'name' | 'username' | 'email' | 'defaultCurrency', boolean>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'username' || field === 'email' || field === 'defaultCurrency') next[field] = true;
      }
      setInvalid(next);
      return;
    }
    setInvalid({});
    setSaving(true);
    try {
      setUser(await api.me.update(parsed.data));
      setEditing(null);
      popup.success('Saved');
    } catch (err) {
      popup.error("Couldn't save", errorMessage(err));
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
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
        <ProfilePhoto size={96} />
        <AppText variant="caption" muted>
          Tap to change your photo
        </AppText>
      </View>
      <Field
        label="Name"
        value={name}
        onChangeText={(value) => { setName(value); clearInvalid('name'); }}
        invalid={invalid.name}
        lockable
        editing={editing === 'name'}
        onRequestEdit={() => setEditing('name')}
      />
      <Field
        label="Username"
        value={username}
        onChangeText={(value) => { setUsername(value); clearInvalid('username'); }}
        autoCapitalize="none"
        autoCorrect={false}
        invalid={invalid.username}
        lockable
        editing={editing === 'username'}
        onRequestEdit={() => setEditing('username')}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={(value) => { setEmail(value); clearInvalid('email'); }}
        keyboardType="email-address"
        autoCapitalize="none"
        invalid={invalid.email}
        lockable
        editing={editing === 'email'}
        onRequestEdit={() => setEditing('email')}
      />
      <PhoneField editing={editing === 'phone'} onRequestEdit={() => setEditing('phone')} />
      <CurrencyField
        label="Default currency"
        value={currency}
        onChange={(value) => { setCurrency(value); clearInvalid('defaultCurrency'); }}
        invalid={invalid.defaultCurrency}
        hint="Applies to new personal transactions. Existing ones keep their currency."
        lockable
        editing={editing === 'currency'}
        onRequestEdit={() => setEditing('currency')}
      />
      <Button title="Save changes" onPress={save} loading={saving} disabled={!dirty} />

      <Section title="Sign-in methods">
        <Card>
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

/** Phone is verified by OTP — it isn't part of the profile Save payload. */
function PhoneField({ editing, onRequestEdit }: { editing: boolean; onRequestEdit: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState(user.phone ?? '');
  const [code, setCode] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [devCode, setDevCode] = useState<string>();
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const normalized = phone.trim().replace(/[\s()-]/g, '');
  const current = user.phone ?? '';
  const dirty = normalized !== current;

  const request = async () => {
    const parsed = phoneSchema.safeParse(normalized.startsWith('+') ? normalized : `+91${normalized}`);
    if (!parsed.success) {
      setPhoneInvalid(true);
      return;
    }
    setPhoneInvalid(false);
    setSending(true);
    try {
      const res = await api.me.requestPhoneLink(parsed.data);
      setPhone(parsed.data);
      setDevCode(res.devCode);
      setCode('');
      setCodeInvalid(false);
      setAwaitingCode(true);
    } catch (err) {
      popup.error("Couldn't send code", errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      setUser(await api.me.verifyPhoneLink(phone, code));
      setAwaitingCode(false);
      setCodeInvalid(false);
      setDevCode(undefined);
      trackFeature('link_phone');
      popup.success('Phone saved');
    } catch {
      setCodeInvalid(true);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Field
        label="Phone"
        value={phone}
        onChangeText={(value) => {
          setPhone(value);
          setPhoneInvalid(false);
          if (awaitingCode) setAwaitingCode(false);
        }}
        placeholder="+91 98765 43210"
        keyboardType="phone-pad"
        autoCapitalize="none"
        invalid={phoneInvalid}
        lockable
        editing={editing}
        onRequestEdit={onRequestEdit}
      />
      {awaitingCode ? (
        <>
          {devCode ? <Banner icon="bug-outline" text={`Development code: ${devCode}`} /> : null}
          <Field
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, '').slice(0, 6));
              setCodeInvalid(false);
            }}
            placeholder="6-digit code"
            keyboardType="number-pad"
            autoFocus
            invalid={codeInvalid}
          />
          <Button title="Verify phone" compact onPress={verify} loading={verifying} disabled={code.length !== 6} />
        </>
      ) : dirty && normalized.length > 0 ? (
        <Button title="Send code" compact onPress={request} loading={sending} />
      ) : null}
    </View>
  );
}
