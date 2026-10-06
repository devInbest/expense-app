import { File, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

type Purpose = 'receipt' | 'avatar';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED)[number];

const BY_EXTENSION: Record<string, AllowedType> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const contentTypeFor = (asset: ImagePicker.ImagePickerAsset): AllowedType => {
  if (asset.mimeType && (ALLOWED as readonly string[]).includes(asset.mimeType)) return asset.mimeType as AllowedType;
  const ext = asset.uri.split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[ext] ?? 'image/jpeg';
};

/**
 * Lets the user pick (or shoot) a photo, uploads it straight to object storage with a
 * pre-signed URL, and returns the public URL. Returns null if cancelled.
 */
export const pickAndUploadImage = async (purpose: Purpose, source: 'library' | 'camera' = 'library'): Promise<string | null> => {
  const options: ImagePicker.ImagePickerOptions =
    purpose === 'avatar'
      ? { mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1, 1] }
      : { mediaTypes: ['images'], quality: 0.6 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  // RN's fetch(uri).blob() does not yield the real file bytes on device, so read and upload natively.
  const file = new File(asset.uri);
  if (!file.exists || !file.size) throw new Error("Couldn't read the selected photo.");
  const contentType = contentTypeFor(asset);

  const signed = await api.uploads.sign({ purpose, contentType, size: file.size });
  const res = await file.upload(signed.uploadUrl, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    headers: signed.headers,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed (${res.status})`);
  return signed.publicUrl;
};
