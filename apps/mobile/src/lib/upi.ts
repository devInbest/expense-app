import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';

export interface UpiApp {
  key: string;
  name: string;
  icon: string;
  color: string;
  androidPackage: string;
  /** iOS: opens the app. Android launches by package instead. */
  homeUrl: string;
}

export const UPI_APPS: UpiApp[] = [
  { key: 'gpay', name: 'Google Pay', icon: 'google', color: '#1A73E8', androidPackage: 'com.google.android.apps.nbu.paisa.user', homeUrl: 'gpay://' },
  { key: 'phonepe', name: 'PhonePe', icon: 'alpha-p-circle', color: '#5F259F', androidPackage: 'com.phonepe.app', homeUrl: 'phonepe://' },
  { key: 'paytm', name: 'Paytm', icon: 'wallet', color: '#00BAF2', androidPackage: 'net.one97.paytm', homeUrl: 'paytmmp://' },
  { key: 'bhim', name: 'BHIM', icon: 'bank', color: '#F47920', androidPackage: 'in.org.npci.upiapp', homeUrl: 'bhim://' },
  { key: 'cred', name: 'CRED', icon: 'credit-card-outline', color: '#1C1C1C', androidPackage: 'com.dreamplug.androidapp', homeUrl: 'credpay://' },
  { key: 'amazonpay', name: 'Amazon Pay', icon: 'shopping-outline', color: '#FF9900', androidPackage: 'in.amazon.mShop.android.shopping', homeUrl: 'amazon://' },
  { key: 'mobikwik', name: 'MobiKwik', icon: 'wallet-outline', color: '#1E88E5', androidPackage: 'com.mobikwik_new', homeUrl: 'mobikwik://' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp', color: '#25D366', androidPackage: 'com.whatsapp', homeUrl: 'whatsapp://' },
];

/** Opens the app. Throws if it isn't installed. */
export const openUpiApp = async (app: UpiApp) => {
  if (Platform.OS === 'android') IntentLauncher.openApplication(app.androidPackage);
  else await Linking.openURL(app.homeUrl);
};

const canOpen = (url: string) => Linking.canOpenURL(url).catch(() => false);

/** Apps confirmed installed, keyed by app, with the real icon where Android provides one (empty string otherwise). */
export const detectInstalledApps = async (): Promise<Record<string, string>> => {
  const found = await Promise.all(
    UPI_APPS.map(async (app): Promise<[string, string] | null> => {
      if (Platform.OS === 'android') {
        const icon = await IntentLauncher.getApplicationIconAsync(app.androidPackage).catch(() => null);
        return icon !== null ? [app.key, icon] : null;
      }
      return (await canOpen(app.homeUrl)) ? [app.key, ''] : null;
    }),
  );
  return Object.fromEntries(found.filter((entry) => entry !== null));
};

const LAST_UPI_KEY = 'pref.upiId';

export const loadLastUpiId = async () => (Platform.OS === 'web' ? null : SecureStore.getItemAsync(LAST_UPI_KEY).catch(() => null));

export const saveLastUpiId = (upiId: string) => {
  if (Platform.OS !== 'web' && upiId) void SecureStore.setItemAsync(LAST_UPI_KEY, upiId).catch(() => undefined);
};
