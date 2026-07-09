import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AppInfo } from '@capacitor/app';

// Crash-proof drop-in for the deprecated lazy-web-chunk behaviour of
// `@capacitor/app` on web.
//
// On web the plugin resolves its implementation by lazily importing a separate
// chunk (`web: () => import('./web').then(m => new m.AppWeb())`). After a deploy
// the chunk hash changes; a stale, cached `index-*.js` then resolves that dynamic
// import to a module without `AppWeb`, so `new e.AppWeb()` throws an *unhandled
// promise rejection*:
//   TypeError: undefined is not an object (evaluating 'new e.AppWeb')
// This was observed crashing /assessment/examination on iPad (Sentry 7593599251) —
// the same failure class the `storage-plugin.ts` shim already sidesteps for
// `@capacitor/storage` (`StorageWeb`).
//
// On web there is no hardware back button, deep link or app-lifecycle to bridge,
// so every method is an inert no-op that never touches the plugin (and so never
// loads the chunk). On native we delegate to the real plugin.
const isNative = (): boolean => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' || platform === 'electron';
};

type AppListenerEvent =
  | 'backButton'
  | 'appUrlOpen'
  | 'appStateChange'
  | 'pause'
  | 'resume'
  | 'appRestoredResult';

export const App = {
  async addListener(
    eventName: AppListenerEvent,
    listenerFunc: (event: any) => void,
  ): Promise<PluginListenerHandle> {
    if (isNative()) {
      return (
        CapacitorApp.addListener as (
          e: string,
          cb: (event: any) => void,
        ) => Promise<PluginListenerHandle>
      )(eventName, listenerFunc);
    }
    // No back button / deep links / app-state on web — return an inert handle so
    // callers' `await` + `.remove()` keep working without loading the AppWeb chunk.
    return { remove: async () => {} };
  },

  async getInfo(): Promise<AppInfo> {
    if (isNative()) return CapacitorApp.getInfo();
    // Matches the real plugin's web behaviour: getInfo is not available on web.
    // Every caller already guards this in try/catch and falls back.
    throw new Error('App.getInfo() is not available on web');
  },

  async minimizeApp(): Promise<void> {
    if (isNative()) {
      await CapacitorApp.minimizeApp();
    }
    // no-op on web
  },

  async exitApp(): Promise<void> {
    if (isNative()) {
      await CapacitorApp.exitApp();
    }
    // no-op on web
  },
};
