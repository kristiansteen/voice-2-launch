// ── Offline (air-gapped) mode ─────────────────────────────────────────────────
// Enabled only by the offline build: `npm run build:offline` sets VITE_OFFLINE=true.
// The online build never sets it, so everything below is dead code there.
//
// In offline mode the browser talks ONLY to the local AILEAN server
// (offline/ailean_server.py), which serves the app and forwards:
//   /llm  → llamafile / llama.cpp   (127.0.0.1:8080, OpenAI-compatible API)
//   /stt  → whisper.cpp server      (127.0.0.1:8081)
//   /tts  → Piper HTTP server       (127.0.0.1:5000)
// Same origin, so no CORS and no request ever leaves the machine.

export const OFFLINE = import.meta.env?.VITE_OFFLINE === 'true';

export const LOCAL_ENDPOINTS = {
  llm: '/llm/v1/chat/completions',
  stt: '/stt/inference',
  tts: '/tts',
};

// Stand-in user so the app's per-user localStorage keys and feature gates work
// without the online login. Never sent anywhere.
export const OFFLINE_USER = {
  id: 'offline',
  name: 'Offline',
  email: 'offline@localhost',
  subscriptionTier: 'enterprise',
};
