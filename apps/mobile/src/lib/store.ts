import { Linking, Platform } from 'react-native';
import { config } from './config';

/**
 * The Play Store listing's package, i.e. the production app id in app.config.ts. Fixed rather than read
 * from the running app, so development builds (com.expenseapp.dev) still open the real listing.
 */
export const PLAY_STORE_PACKAGE = 'com.expenseapp';

const playStoreApp = `market://details?id=${PLAY_STORE_PACKAGE}`;
const playStoreWeb = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;

/** Reviews can only be left on Android for now (no App Store listing yet). */
export const canRateApp = Platform.OS === 'android';

/** Opens the app's Play Store page, where the rating and review section is. Falls back to the website. */
export const openStoreReview = async () => {
  try {
    await Linking.openURL(playStoreApp);
  } catch {
    // No Play Store app (e.g. some emulators): use the browser.
    await Linking.openURL(playStoreWeb);
  }
};

/** Feedback goes by email when a support address is configured. */
export const canSendFeedback = Boolean(config.supportEmail);

export const sendFeedback = (appVersion: string) =>
  Linking.openURL(
    `mailto:${config.supportEmail}?subject=${encodeURIComponent('Feedback for ExpenseHog')}&body=${encodeURIComponent(
      `\n\n—\nApp version ${appVersion} · ${Platform.OS} ${String(Platform.Version)}`,
    )}`,
  );
