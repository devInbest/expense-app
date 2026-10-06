import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'pref.themeMode';
const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();

const apply = (next: ThemeMode) => {
  mode = next;
  // Also drives native UI (date pickers, alerts, keyboard) that reads the OS scheme.
  Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  listeners.forEach((l) => l());
};

export const setThemeMode = (next: ThemeMode) => {
  apply(next);
  if (Platform.OS !== 'web') void SecureStore.setItemAsync(KEY, next);
};

/** Restores the saved choice; called once at startup. */
export const loadThemeMode = async () => {
  if (Platform.OS === 'web') return;
  const saved = await SecureStore.getItemAsync(KEY).catch(() => null);
  if (saved && (MODES as readonly string[]).includes(saved) && saved !== mode) apply(saved as ThemeMode);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useThemeMode = () => useSyncExternalStore(subscribe, () => mode);
