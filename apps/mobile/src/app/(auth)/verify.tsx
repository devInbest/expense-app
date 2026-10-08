import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { AuthHeader } from '@/components/AuthHeader';
import { AppText, Appear, Banner, Button, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getDeviceInfo } from '@/lib/secure';
import { radius, spacing, useTheme } from '@/theme';

const LENGTH = 6;

function CodeBoxes({ code, focused, error }: { code: string; focused: boolean; error: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {Array.from({ length: LENGTH }, (_, i) => {
        const active = focused && i === Math.min(code.length, LENGTH - 1);
        const filled = i < code.length;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              aspectRatio: 0.85,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: filled || active ? colors.glassStrong : colors.glass,
              borderWidth: 1.5,
              borderColor: error ? colors.danger : active ? colors.primary : filled ? `${colors.primary}55` : colors.glassBorder,
              boxShadow: active ? `0 0 0 4px ${colors.primaryMuted}` : `0 4px 12px ${colors.shadow}`,
            }}>
            <AppText style={{ fontSize: 26, fontWeight: '800' }}>{code[i] ?? ''}</AppText>
          </View>
        );
      })}
    </View>
  );
}

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ phone: string; resendIn?: string; devCode?: string }>();
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [devCode, setDevCode] = useState(params.devCode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(Number(params.resendIn ?? 30));
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (value.length !== LENGTH) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(await api.auth.verifyOtp(params.phone, value, await getDeviceInfo()));
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
      shake.set(withSequence(...[-10, 10, -8, 8, -4, 0].map((v) => withTiming(v, { duration: 55 }))));
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
    <Screen edges={['bottom']} contentStyle={{ gap: spacing.xl }}>
      <AuthHeader icon="shield-key-outline" title="Enter the code" subtitle={`Sent to ${params.phone}`} />
      {devCode ? <Banner icon="bug-outline" text={`Development build: your code is ${devCode}`} /> : null}
      <Appear index={1} style={{ gap: spacing.sm }}>
        <Animated.View style={shakeStyle}>
          <CodeBoxes code={code} focused={focused} error={!!error} />
          <TextInput
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, LENGTH);
              setCode(digits);
              if (error) setError(null);
              if (digits.length === LENGTH) void verify(digits);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={LENGTH}
            caretHidden
            accessibilityLabel="Verification code"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' }}
          />
        </Animated.View>
        {error ? (
          <AppText variant="caption" color={colors.danger} style={{ textAlign: 'center' }}>
            {error}
          </AppText>
        ) : null}
      </Appear>
      <Appear index={2} style={{ gap: spacing.sm }}>
        <Button title="Verify" icon="check-circle-outline" onPress={() => verify()} loading={loading} disabled={code.length !== LENGTH} />
        <Button
          title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          variant="ghost"
          disabled={cooldown > 0}
          onPress={resend}
        />
      </Appear>
    </Screen>
  );
}
