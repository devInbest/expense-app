import { useColorScheme } from 'react-native';
import { useThemeMode } from '@/lib/themeMode';

const palette = {
  primary: '#4F46E5',
  primaryMuted: '#EEF2FF',
  success: '#059669',
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
};

export const colors = {
  light: {
    ...palette,
    background: '#F7F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F2F6',
    border: '#E4E5EB',
    text: '#111827',
    textMuted: '#6B7280',
    onPrimary: '#FFFFFF',
    income: palette.success,
    expense: '#111827',
  },
  dark: {
    ...palette,
    primary: '#818CF8',
    primaryMuted: '#1E1B4B',
    info: '#60A5FA',
    background: '#0B0B10',
    surface: '#16161D',
    surfaceAlt: '#1F1F28',
    border: '#2A2A35',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    onPrimary: '#0B0B10',
    income: '#34D399',
    expense: '#F3F4F6',
  },
};

export type ThemeColors = typeof colors.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const useTheme = () => {
  const scheme = useColorScheme();
  const mode = useThemeMode();
  const dark = mode === 'system' ? scheme === 'dark' : mode === 'dark';
  return { dark, colors: dark ? colors.dark : colors.light };
};
