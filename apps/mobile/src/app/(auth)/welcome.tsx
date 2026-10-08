import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppText, Button, Glass, Icon, linearGradient, Row, Screen } from '@/components/ui';
import { api, showError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getGoogleIdToken, isGoogleConfigured } from '@/lib/google';
import { getDeviceInfo } from '@/lib/secure';
import { spacing, useTheme } from '@/theme';

const FEATURES = [
  { icon: 'chart-arc', label: 'Insights' },
  { icon: 'target', label: 'Budgets' },
  { icon: 'account-group', label: 'Split bills' },
];

function FloatingChip({ icon, label, index }: { icon: string; label: string; index: number }) {
  const { colors } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withRepeat(withSequence(withTiming(-5, { duration: 1400 + index * 300 }), withTiming(0, { duration: 1400 + index * 300 })), -1));
  }, [y, index]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View entering={FadeInUp.delay(400 + index * 120).springify().damping(16)} style={style}>
      <Glass rounded={999} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
        <Icon name={icon} size={16} color={colors.primary} />
        <AppText variant="caption" style={{ fontWeight: '700' }}>
          {label}
        </AppText>
      </Glass>
    </Animated.View>
  );
}

export default function Welcome() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(1.06, { duration: 1500 }), withTiming(1, { duration: 1500 })), -1));
  }, [pulse]);
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl }}>
        <Animated.View entering={FadeInDown.duration(600).springify().damping(14)} style={logo}>
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primary,
              experimental_backgroundImage: linearGradient('#FF7A45', colors.primaryDeep),
              boxShadow: `0 20px 50px ${colors.primaryGlow}`,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.4)',
            }}>
            <Icon name="wallet" size={56} color={colors.onPrimary} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="display">
            expense<AppText variant="display" color={colors.primary}>Hog</AppText>
          </AppText>
          <AppText muted style={{ textAlign: 'center', maxWidth: 300, lineHeight: 22 }}>
            Track your daily spending, set budgets, and split shared costs with friends and family.
          </AppText>
        </Animated.View>

        <Row gap={spacing.sm} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {FEATURES.map((f, i) => (
            <FloatingChip key={f.label} icon={f.icon} label={f.label} index={i} />
          ))}
        </Row>
      </View>

      <Animated.View entering={FadeInUp.delay(300).duration(500).springify().damping(18)}>
        <Glass blur style={{ padding: spacing.lg, gap: spacing.md }} rounded={30}>
          <Button title="Continue with phone" icon="cellphone" onPress={() => router.push('/phone')} />
          {isGoogleConfigured() ? (
            <Button title="Continue with Google" icon="google" variant="glass" loading={googleLoading} onPress={continueWithGoogle} />
          ) : null}
          <AppText variant="caption" muted style={{ textAlign: 'center' }}>
            By continuing you agree to our Terms and Privacy Policy.
          </AppText>
        </Glass>
      </Animated.View>
    </Screen>
  );
}
