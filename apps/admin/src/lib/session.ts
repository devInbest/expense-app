import type { AdminDTO } from '@expense/shared';
import { STORAGE_KEYS } from '../constants';

// The admin session lives in localStorage; these helpers are the only place that touches those keys.

export const getAccessToken = () => localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
export const getRefreshToken = () => localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

export const isAuthenticated = () => Boolean(getAccessToken() || getRefreshToken());

export const getStoredAdmin = (): AdminDTO | null => {
  const raw = localStorage.getItem(STORAGE_KEYS.ADMIN);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminDTO;
  } catch {
    return null;
  }
};

export const saveSession = (s: { accessToken?: string; refreshToken?: string; admin?: AdminDTO }) => {
  if (s.accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, s.accessToken);
  if (s.refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, s.refreshToken);
  if (s.admin) localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(s.admin));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.ADMIN);
};
