import type { CapacitorConfig } from '@capacitor/cli';

// Vimotion mobile app — wraps the /vim/* routes of the admin dashboard build.
// The Capacitor app is product-scoped to Vimotion; admin routes are reachable
// in the bundle but never linked from the native shell. Native entry is forced
// to /vim via window.location handling inside the app shell.
const config: CapacitorConfig = {
    appId: 'io.vimotion.app',
    appName: 'Vimotion',
    webDir: 'dist',
    // Allow live reload against the local Vite dev server during native dev.
    // Toggle by setting CAP_DEV_SERVER=<url> in the environment when running
    // `pnpm cap:sync` (handled in scripts/cap-config.cjs). Keep this commented
    // out for production builds — the bundled webDir must be used.
    // server: {
    //     url: 'http://localhost:5173',
    //     cleartext: true,
    // },
    ios: {
        // Status bar text + background are set at runtime by `src/native/statusBar.ts`
        // so they can react to in-app theme changes. This flag keeps the WKWebView
        // from being pushed underneath the status bar when the in-app status bar
        // plugin is not yet loaded (avoids first-paint flash on cold start).
        contentInset: 'always',
        // Allow the keyboard to overlap content so we can use `KeyboardWillShow`
        // listeners and apply our own padding instead of the WebView resizing
        // (which causes jank with the sticky composer in the Create tab).
        scrollEnabled: false,
    },
    android: {
        // Match iOS — let our keyboard listeners drive layout, not the WebView.
        // adjustResize would re-layout under the IME and fight our sticky bars.
        // Resolved to `nothing` via AndroidManifest.xml (windowSoftInputMode).
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
        CapacitorUpdater: {
            // OTA updates via Capgo. autoUpdate runs at app start; bundles are
            // signed + delta-downloaded. Configure CAPGO_APP_ID + CAPGO_API_KEY
            // in CI and they get baked into the build by scripts/cap-config.cjs.
            autoUpdate: true,
            updateUrl: 'https://api.capgo.app/updates',
            statsUrl: 'https://api.capgo.app/stats',
            channelUrl: 'https://api.capgo.app/channel_self',
            directUpdate: true,
        },
    },
};

export default config;
