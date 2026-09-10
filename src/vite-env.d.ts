/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEATURE_SERVER?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
