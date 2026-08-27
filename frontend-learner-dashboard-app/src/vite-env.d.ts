/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIDE_MODE_CHANGE_BUTTON?: string;
  readonly VITE_CASHFREE_SANDBOX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by Vite `define` from package.json — the embedded JS bundle version.
declare const __APP_VERSION__: string;

// Injected by Vite `define`. True only in a Mac App Store build.
declare const __MAC_APP_STORE__: boolean;
