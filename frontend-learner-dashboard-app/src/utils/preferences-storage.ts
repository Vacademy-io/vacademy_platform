import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// On web browsers, Capacitor.Preferences tries to dynamically import PreferencesWeb,
// which can fail if the chunk is stale after a deploy. Use localStorage directly on web.
const isNative = () => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' || platform === 'electron';
};

export const preferencesGet = async (key: string): Promise<{ value: string | null }> => {
  if (isNative()) {
    return Preferences.get({ key });
  }
  return { value: localStorage.getItem(key) };
};

export const preferencesSet = async (key: string, value: string): Promise<void> => {
  if (isNative()) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
};

export const preferencesRemove = async (key: string): Promise<void> => {
  if (isNative()) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
};
