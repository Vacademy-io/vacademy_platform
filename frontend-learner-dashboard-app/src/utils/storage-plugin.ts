import { Capacitor } from '@capacitor/core';
import { Storage as CapacitorStorage } from '@capacitor/storage';

// Crash-proof drop-in for the deprecated `@capacitor/storage` plugin on web.
//
// On web browsers the plugin resolves its implementation by lazily importing a
// separate `StorageWeb` chunk (`web: () => import('./web').then(m => new m.StorageWeb())`).
// After a deploy the chunk hash changes; a stale, cached `index-*.js` then resolves
// that dynamic import to a module without `StorageWeb`, so `new e.StorageWeb()` throws
// an *unhandled promise rejection*:
//   TypeError: undefined is not an object (evaluating 'new e.StorageWeb')
// This was observed crashing /assessment/examination on Safari (Sentry 7593586138).
//
// Same failure class the `preferences-storage.ts` shim already sidesteps for
// `@capacitor/preferences` (`PreferencesWeb`). Here we read/write `localStorage`
// directly on web instead — using the plugin's own key scheme so existing stored
// data and cross-plugin reads (`@capacitor/preferences` shares the same
// `CapacitorStorage` group/prefix on web) stay byte-for-byte compatible.
const isNative = (): boolean => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' || platform === 'electron';
};

// Matches @capacitor/storage's default web group ('CapacitorStorage'). No caller
// in this app overrides it via configure({ group }).
const WEB_KEY_PREFIX = 'CapacitorStorage.';

export const Storage = {
  async get({ key }: { key: string }): Promise<{ value: string | null }> {
    if (isNative()) return CapacitorStorage.get({ key });
    return { value: localStorage.getItem(WEB_KEY_PREFIX + key) };
  },

  async set({ key, value }: { key: string; value: string }): Promise<void> {
    if (isNative()) {
      await CapacitorStorage.set({ key, value });
      return;
    }
    localStorage.setItem(WEB_KEY_PREFIX + key, value);
  },

  async remove({ key }: { key: string }): Promise<void> {
    if (isNative()) {
      await CapacitorStorage.remove({ key });
      return;
    }
    localStorage.removeItem(WEB_KEY_PREFIX + key);
  },
};
