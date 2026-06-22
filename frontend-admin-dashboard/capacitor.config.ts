import type { CapacitorConfig } from '@capacitor/cli';
import { getFlavorByKey } from './flavor.config';

// Multi-flavor native config. The same web build ships as more than one app:
//   - vacademy-admin (io.vacademy.admin.app, "Vacademy Admin") — the full admin
//     portal, self-hosted OTA (our admin-core OTA backend, learner-app style).
//   - vimotion (io.vimotion.app, "Vimotion") — the /vim video-studio shell,
//     Capgo cloud OTA.
//
// Selected at build/sync time via VITE_CAP_FLAVOR (defaults to `vimotion` so an
// env-less `cap sync` keeps producing the pre-existing Vimotion app). The npm
// scripts (cap:*:vacademy-admin / cap:*:vimotion) set it for you.
const flavor = getFlavorByKey(process.env.VITE_CAP_FLAVOR);

// OTA plugin config differs by flavor. Both use @capgo/capacitor-updater, but:
//   - self-hosted: autoUpdate OFF — we check our own backend and call
//     CapacitorUpdater.download/set/notifyAppReady from src/services/ota-update.ts.
//   - capgo: autoUpdate ON against the Capgo cloud endpoints.
const otaPluginConfig =
    flavor.ota === 'capgo'
        ? {
              autoUpdate: true,
              updateUrl: 'https://api.capgo.app/updates',
              statsUrl: 'https://api.capgo.app/stats',
              channelUrl: 'https://api.capgo.app/channel_self',
              directUpdate: true,
          }
        : {
              // Self-hosted OTA: we drive the update lifecycle ourselves.
              autoUpdate: false,
          };

const config: CapacitorConfig = {
    appId: flavor.appId,
    appName: flavor.appName,
    webDir: 'dist',
    // Allow live reload against the local Vite dev server during native dev.
    // Set CAP_DEV_SERVER=<url> before `cap sync` to enable.
    ...(process.env.CAP_DEV_SERVER
        ? { server: { url: process.env.CAP_DEV_SERVER, cleartext: true } }
        : {}),
    ios: {
        // Keeps the WKWebView from being pushed underneath the status bar before
        // the in-app status bar plugin loads (avoids first-paint flash on cold
        // start). Status bar colour/style are set at runtime by statusBar.ts.
        contentInset: 'always',
        // Let our keyboard listeners drive layout instead of the WebView resizing.
        scrollEnabled: false,
    },
    android: {
        allowMixedContent: false,
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 1500,
            launchAutoHide: false,
            backgroundColor: '#FAFAF7',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
            useDialog: false,
        },
        StatusBar: {
            backgroundColor: '#FFFFFF',
            style: 'LIGHT',
            overlaysWebView: false,
        },
        Keyboard: {
            // Don't resize the WebView; we handle it via env(safe-area-inset-bottom)
            // and a runtime --keyboard-height CSS var so sticky elements stay glued.
            resize: 'none',
            style: 'DEFAULT',
            resizeOnFullScreen: true,
        },
        FirebaseMessaging: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        PrivacyScreen: {
            // Blur app contents in iOS app switcher + Android recent apps so
            // institute data never appears in the OS task screenshot.
            enable: true,
            imageName: 'Splash',
            preventScreenshots: false,
        },
        CapacitorUpdater: otaPluginConfig,
    },
};

export default config;
