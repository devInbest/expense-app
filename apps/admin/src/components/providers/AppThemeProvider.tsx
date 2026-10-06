import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { buildMantineTheme } from '../../theme';
import { applyThemeColor } from '../../constants/themeColors';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useAppDispatch, useAppSelector } from '../../store';
import { setThemeColor } from '../../store/slices/commonSlice';
import ThemeProvider from './ThemeProvider';

/** Applies the app-wide theme color (from the server) to CSS variables and Mantine. */
export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { theme, themeColor } = useAppSelector((state) => state.common);
  const { data: settings } = useAppSettings();

  useEffect(() => {
    if (settings?.themeColor && settings.themeColor !== themeColor) dispatch(setThemeColor(settings.themeColor));
  }, [settings?.themeColor, themeColor, dispatch]);

  useLayoutEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  const mantineTheme = useMemo(() => buildMantineTheme(themeColor), [themeColor]);

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme={theme}>
      <ThemeProvider>
        <Notifications position="top-right" />
        {children}
      </ThemeProvider>
    </MantineProvider>
  );
}
