import type { ExpoConfig } from 'expo/config';

const variant = process.env.APP_VARIANT ?? 'development';
const isProd = variant === 'production';
const suffix = isProd ? '' : `.${variant}`;

const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const easProjectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: isProd ? 'Expense' : `Expense (${variant})`,
  slug: 'expense-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'expenseapp',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: `com.expenseapp${suffix}`,
    icon: './assets/expo.icon',
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Attach receipt photos to your expenses.',
      NSCameraUsageDescription: 'Take photos of receipts.',
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationQueriesSchemes: ['gpay', 'phonepe', 'paytmmp', 'bhim', 'credpay', 'upi'],
    },
  },
  android: {
    package: `com.expenseapp${suffix}`,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    intentFilters: process.env.APP_LINK_HOST
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            data: [{ scheme: 'https', host: process.env.APP_LINK_HOST, pathPrefix: '/join' }],
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ]
      : undefined,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#4F46E5',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    'expo-localization',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    ['expo-notifications', { color: '#4F46E5' }],
    ['expo-image-picker', { photosPermission: 'Attach receipt photos to your expenses.' }],
    googleIosUrlScheme
      ? ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]
      : '@react-native-google-signin/google-signin',
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  updates: easProjectId ? { url: `https://u.expo.dev/${easProjectId}` } : undefined,
  extra: {
    variant,
    eas: easProjectId ? { projectId: easProjectId } : undefined,
  },
};

export default config;
