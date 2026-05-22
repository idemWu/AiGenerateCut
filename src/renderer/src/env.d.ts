/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_R2_IMAGE_HOSTNAME?: string
  readonly VITE_SITE_ACCESS_KEY?: string
  readonly VITE_SITE_GATE_ENABLED?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
