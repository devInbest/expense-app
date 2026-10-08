import { useColorScheme } from 'react-native';
import { useThemeMode } from '@/lib/themeMode';

const brand = {
  orange: '#FF4F0F',
  white: '#FFFFFF',
  gray: '#AAAAAA',
  mist: '#F5F5F7',
  black: '#000000',
} as const;

const palette = {
  primary: brand.orange,
  primaryMuted: 'rgba(255,79,15,0.12)',
  /** Gradient end for primary surfaces (buttons, hero cards). */
  primaryDeep: '#E63E00',
  primaryGlow: 'rgba(255,79,15,0.35)',
  success: '#16A34A',
  danger: '#E5383B',
  warning: '#F59E0B',
  info: brand.orange,
  onPrimary: brand.white,
};

export const colors = {
  light: {
    ...palette,
    background: brand.mist,
    surface: brand.white,
    surfaceAlt: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.06)',
    text: brand.black,
    textMuted: 'rgba(0,0,0,0.5)',
    textSubtle: brand.gray,
    income: palette.success,
    expense: brand.black,
    glass: 'rgba(255,255,255,0.62)',
    glassStrong: 'rgba(255,255,255,0.86)',
    glassBorder: 'rgba(255,255,255,0.9)',
    glassHighlight: 'rgba(255,255,255,0.7)',
    shadow: 'rgba(17,17,17,0.08)',
    glow: 'rgba(255,79,15,0.22)',
    glowSoft: 'rgba(255,79,15,0.10)',
    scrim: 'rgba(0,0,0,0.35)',
  },
  dark: {
    ...palette,
    primaryMuted: 'rgba(255,79,15,0.18)',
    background: brand.black,
    surface: '#111113',
    surfaceAlt: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.09)',
    text: brand.white,
    textMuted: 'rgba(255,255,255,0.6)',
    textSubtle: brand.gray,
    income: '#34D399',
    expense: brand.white,
    glass: 'rgba(255,255,255,0.06)',
    glassStrong: 'rgba(28,28,30,0.82)',
    glassBorder: 'rgba(255,255,255,0.12)',
    glassHighlight: 'rgba(255,255,255,0.10)',
    shadow: 'rgba(0,0,0,0.5)',
    glow: 'rgba(255,79,15,0.30)',
    glowSoft: 'rgba(255,79,15,0.12)',
    scrim: 'rgba(0,0,0,0.6)',
  },
};

export type ThemeColors = typeof colors.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 } as const;

export const useTheme = () => {
  const scheme = useColorScheme();
  const mode = useThemeMode();
  const dark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return { dark, colors: dark ? colors.dark : colors.light };
};
