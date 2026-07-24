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
