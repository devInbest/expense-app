import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { linearGradient } from '@/components/ui';
import { useTheme } from '@/theme';

const MIN_VISIBLE_MS = 2000;

/** Branded launch screen shown over the app until `ready` and the minimum display time have both passed. */
export function BrandSplash({ ready }: { ready: boolean }) {
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  if (ready && elapsed) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(350)}
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          experimental_backgroundImage: linearGradient(colors.primary, colors.primaryDeep, 160),
        },
      ]}>
      <StatusBar style="light" />
      <Animated.View entering={FadeIn.duration(500)}>
        <Image source={require('../../assets/images/splash-icon.png')} tintColor="#FFFFFF" contentFit="contain" style={{ width: 360, height: 360 }} />
      </Animated.View>
    </Animated.View>
  );
}
