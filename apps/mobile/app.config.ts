import type { ExpoConfig } from 'expo/config';

type Variant = 'development' | 'preview' | 'production';

const variants: Record<Variant, { name: string; appId: string }> = {
  development: { name: 'ExpenseHog(dev)', appId: 'com.expenseapp.dev' },
  preview: { name: 'ExpenseHog(pre)', appId: 'com.expenseapp' },
  production: { name: 'ExpenseHog', appId: 'com.expenseapp' },
};

const envVariant = process.env.APP_VARIANT as Variant | undefined;
const variant: Variant = envVariant && envVariant in variants ? envVariant : 'development';
const { name, appId } = variants[variant];

const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const easProjectId = process.env.EAS_PROJECT_ID || 'f63a4900-0a5a-474a-a434-db2f96f2bc71';

const config: ExpoConfig = {
  name,
  slug: 'expense-app',
  owner: 'ash.0167',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'expenseapp',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: appId,
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Attach receipt photos to your expenses.',
      NSCameraUsageDescription: 'Take photos of receipts.',
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationQueriesSchemes: ['gpay', 'phonepe', 'paytmmp', 'bhim', 'credpay', 'upi'],
    },
  },
  android: {
    package: appId,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#141414',
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
        // Blank on purpose: the branded logo is drawn by BrandSplash, so the native splash is plain brand colour.
        backgroundColor: '#FF4F0F',
        image: './assets/images/splash-blank.png',
        imageWidth: 240,
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#FF4F0F',
          image: './assets/images/splash-blank.png',
        },
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    'expo-localization',
    'expo-sharing',
    '@react-native-community/datetimepicker',
    ['expo-notifications', { icon: './assets/images/android-icon-monochrome.png', color: '#FF4F0F' }],
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
