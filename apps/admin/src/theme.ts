import { createTheme, type MantineColorsTuple } from '@mantine/core';
import { getPalette } from './constants/themeColors';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Mantine theme whose primary color follows the selected theme palette. */
export const buildMantineTheme = (themeColor: string) =>
  createTheme({
    primaryColor: 'brand',
    primaryShade: { light: 7, dark: 6 },
    autoContrast: true,
    fontFamily: FONT_FAMILY,
    defaultRadius: 'md',
    headings: { fontFamily: FONT_FAMILY },
    colors: { brand: getPalette(themeColor).shades as unknown as MantineColorsTuple },
  });
