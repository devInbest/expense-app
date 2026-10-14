import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AppText, Button, Glass, Icon, MOTION, Screen } from '@/components/ui';
import { api, showError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getGoogleIdToken, isGoogleConfigured } from '@/lib/google';
import { getDeviceInfo } from '@/lib/secure';
import { spacing, useTheme } from '@/theme';

export default function Welcome() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [accepted, setAccepted] = useState(true);

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
    <Screen scroll={false} padded={false} edges={['bottom']} contentStyle={{ gap: 0 }}>
      <StatusBar style="dark" />
      <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1, overflow: 'hidden', backgroundColor: '#FCBE98' }}>
        <Image source={require('../../../assets/images/onboarding-hero.jpg')} contentFit="cover" style={[StyleSheet.absoluteFill, { top: 24, bottom: -24 }]} />
        <View
          style={{
            position: 'absolute',
            left: '-25%',
            right: '-25%',
            bottom: -72,
            height: 96,
            backgroundColor: colors.background,
            transform: [{ rotate: '-6deg' }],
          }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <AppText variant="title" color={colors.primary} style={{ textAlign: 'center' }}>
          Spend Smarter{'\n'}Save More
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).duration(500).easing(MOTION.easing)} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <Glass blur style={{ padding: spacing.lg, gap: spacing.md }} rounded={30}>
          <Button title="Continue with phone" icon="cellphone" disabled={!accepted} onPress={() => router.push('/phone')} />
          {isGoogleConfigured() ? (
            <Button
              title="Continue with Google"
              icon={<Image source={require('../../../assets/images/google-g.png')} style={{ width: 20, height: 20 }} />}
              variant="glass"
              disabled={!accepted}
              loading={googleLoading}
              onPress={continueWithGoogle}
            />
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            onPress={() => setAccepted((v) => !v)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <Icon name={accepted ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={accepted ? colors.primary : colors.textMuted} />
            <AppText variant="caption" muted>
              I agree to the Terms and Privacy Policy
            </AppText>
          </Pressable>
        </Glass>
      </Animated.View>
    </Screen>
  );
}
