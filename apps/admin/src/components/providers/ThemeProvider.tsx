import { useEffect, type ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { useAppSelector } from '../../store';

/** Keeps Mantine's color scheme and the `data-theme` attribute in sync with the stored preference. */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppSelector((state) => state.common.theme);
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return children;
}
