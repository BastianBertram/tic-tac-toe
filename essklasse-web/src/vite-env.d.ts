/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // Kein VITE_ANTHROPIC_API_KEY: der Anthropic-Key darf NIE über VITE_* in den
  // Client gelangen — er bleibt serverseitig (server/index.mjs Proxy).
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
