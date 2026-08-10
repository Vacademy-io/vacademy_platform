/* eslint-disable @typescript-eslint/no-var-requires */

// OfflineMedia: free-disk-space query + streaming AES-CTR video decrypt (plan §B1/B4).
// `setupCapacitorElectronPlugins()` (electron/src/setup.ts init()) instantiates each exported
// class once and bridges every prototype method to `ipcMain.handle('<ClassName>-<method>', ...)`.
// electron-rt.ts (preload, same file required from the renderer/preload bundle) mirrors that as
// `window.CapacitorCustomPlatform.plugins.OfflineMedia.<method>(...)`, which
// src/lib/offline/native/offline-media.ts's `registerPlugin('OfflineMedia', { electron: ... })`
// implementation calls into. Requiring './offline-media-plugin' here only needs to succeed in
// both the main process (where the class is actually instantiated) and the preload context
// (where only its prototype method names are introspected, never instantiated) — both are
// Node-capable Electron contexts, so a plain `require` is safe in either.
const { OfflineMedia } = require('../offline-media-plugin');

module.exports = {
  offlineMedia: { OfflineMedia },
};
