import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Platform as AppPlatform } from '@expense/shared';

const defaultApiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5099/api/v1' : 'http://localhost:5099/api/v1';

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || defaultApiUrl,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  appVersion: Constants.expoConfig?.version ?? '1.0.0',
  easProjectId: (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId,
  platform: (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web') as AppPlatform,
};
