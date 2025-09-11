/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIDE_MODE_CHANGE_BUTTON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
