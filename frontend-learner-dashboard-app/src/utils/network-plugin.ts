import { Capacitor } from '@capacitor/core';
import { Network as CapacitorNetwork } from '@capacitor/network';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ConnectionStatus } from '@capacitor/network';

// Crash-proof drop-in for the deprecated lazy-web-chunk behaviour of
// `@capacitor/network` on web.
//
// On web the plugin resolves its implementation by lazily importing a separate
// chunk (`web: () => import('./web').then(m => new m.NetworkWeb())`). After a
// deploy the chunk hash changes; a stale, cached `index-*.js` then resolves that
// dynamic import to a module without `NetworkWeb`, so `new e.NetworkWeb()` throws
// an *unhandled promise rejection*:
//   TypeError: undefined is not an object (evaluating 'new e.NetworkWeb')
// This was observed crashing /assessment/examination on iPad (Sentry 7593599251) —
// the same failure class the `storage-plugin.ts` shim already sidesteps for
// `@capacitor/storage` (`StorageWeb`).
//
// On web we derive connectivity from the browser's own `navigator.onLine` and
// `online`/`offline` events — never touching the plugin, so the chunk import can
// never fire. On native we delegate to the real plugin.
const isNative = (): boolean => {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios' || platform === 'electron';
};

const webStatus = (): ConnectionStatus => {
  const connected =
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  return { connected, connectionType: connected ? 'unknown' : 'none' };
};

export const Network = {
  async getStatus(): Promise<ConnectionStatus> {
    if (isNative()) return CapacitorNetwork.getStatus();
    return webStatus();
  },

  async addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: ConnectionStatus) => void,
  ): Promise<PluginListenerHandle> {
    if (isNative()) {
      return CapacitorNetwork.addListener(eventName, listenerFunc);
    }
    const handler = () => listenerFunc(webStatus());
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return {
      remove: async () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      },
    };
  },
};
