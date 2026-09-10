/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_SERVER?: string
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
