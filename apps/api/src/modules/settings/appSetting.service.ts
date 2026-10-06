import type { AppSettingsDTO, AppSettingsInput } from '@expense/shared';
import { AppSetting } from './appSetting.model';

const APP_KEY = 'app';
export const DEFAULT_THEME_COLOR = 'crimson-slate';
const CACHE_MS = 30_000;

let cache: { value: AppSettingsDTO; at: number } | null = null;

const toDTO = (doc: Partial<AppSettingsDTO> | null): AppSettingsDTO => ({
  themeColor: doc?.themeColor || DEFAULT_THEME_COLOR,
  minAppVersion: doc?.minAppVersion || '1.0.0',
  maintenanceMode: Boolean(doc?.maintenanceMode),
  maintenanceMessage: doc?.maintenanceMessage || '',
});

export const getAppSettings = async (): Promise<AppSettingsDTO> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await AppSetting.findOne({ key: APP_KEY }).lean();
  cache = { value: toDTO(doc as Partial<AppSettingsDTO> | null), at: Date.now() };
  return cache.value;
};

export const updateAppSettings = async (input: AppSettingsInput, adminId: unknown): Promise<AppSettingsDTO> => {
  const doc = await AppSetting.findOneAndUpdate(
    { key: APP_KEY },
    { $set: { ...input, updatedBy: adminId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  cache = { value: toDTO(doc as Partial<AppSettingsDTO>), at: Date.now() };
  return cache.value;
};
