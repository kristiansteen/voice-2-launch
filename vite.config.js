import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const OFFLINE = process.env.VITE_OFFLINE === 'true';

// Offline build only: swap the Google Fonts imports in index.css for the
// self-hosted copies in public/fonts, so the app makes no external requests.
// The online build is untouched.
const LOCAL_FONTS = `
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 300 900; font-display: swap; src: url('/fonts/inter-latin.woff2') format('woff2'); }
@font-face { font-family: 'Birthstone'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/birthstone-400.woff2') format('woff2'); }
`;

function offlineFonts() {
  return {
    name: 'ailean-offline-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/index.css')) return null;
      return LOCAL_FONTS + code.replace(/^@import url\('https:\/\/fonts\.googleapis\.com[^\n]*\n?/gm, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), ...(OFFLINE ? [offlineFonts()] : [])],
  optimizeDeps: {
    include: ['bpmn-js'],
  },
  define: {
    global: 'globalThis',
  },
  assetsInclude: ['**/*.bpmn'],
});
