import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { config } from './config';
import { tokenStorage } from './secure';
import { http } from './api';

/**
 * Downloads an authenticated export from the API into the cache directory and opens the
 * share sheet. A throwaway request first makes sure the access token is fresh.
 */
export const downloadAndShare = async (path: string, params: Record<string, unknown>, filename: string, mimeType: string) => {
  await http.get('/me');
  const token = await tokenStorage.getAccessToken();
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : String(v)]),
  ).toString();

  const destination = new File(Paths.cache, filename);
  const file = await File.downloadFileAsync(`${config.apiUrl}${path}?${query}`, destination, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-platform': config.platform,
      'x-app-version': config.appVersion,
    },
    idempotent: true,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  }
  return file.uri;
};
