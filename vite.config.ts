import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

/**
 * Writes the built, content-hashed asset filenames into the service worker's
 * precache list. The worker can't name them itself, so without this the app
 * only survives going offline from the *second* visit onward. Source maps are
 * left out on purpose.
 */
function precacheServiceWorker(): Plugin {
  return {
    name: 'precache-sw',
    apply: 'build',
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const outDir = resolve('dist');
        const swPath = join(outDir, 'sw.js');

        const walk = (dir: string, base = ''): string[] =>
          readdirSync(dir).flatMap((entry) => {
            const full = join(dir, entry);
            const rel = base ? posix.join(base, entry) : entry;
            return statSync(full).isDirectory() ? walk(full, rel) : [rel];
          });

        let assets: string[];
        try {
          assets = walk(outDir).filter(
            (f) =>
              (f.startsWith('assets/') || f.startsWith('icons/')) && !f.endsWith('.map'),
          );
        } catch {
          return; // no dist to annotate
        }

        const list = assets.map((f) => `  './${f}',`).join('\n');
        const sw = readFileSync(swPath, 'utf8');
        writeFileSync(swPath, sw.replace('  /* BUILD_ASSETS */', list), 'utf8');
        this.info(`precached ${assets.length} assets into sw.js`);
      },
    },
  };
}

/**
 * `npm run dev`   -> http://localhost:5173. localhost is a secure context, so
 *                    the microphone (voice memos) works with no certificate.
 * `npm run phone` -> builds, then serves the built app over HTTPS on your LAN.
 *                    This is the one to point an iPhone at: getUserMedia and
 *                    MediaRecorder only run over HTTPS or localhost.
 * `npm run host`  -> dev server over HTTPS on your LAN. Fine for a quick check,
 *                    but dev mode ships every source file as its own request,
 *                    which Safari can stall on over a self-signed cert. For
 *                    anything real, push to main and let Pages publish it with
 *                    a proper certificate, reachable off your network.
 */
export default defineConfig(({ mode }) => ({
  // Relative asset paths: required for Capacitor's WebView, and lets the built
  // site be served from a GitHub Pages subdirectory without rebuilding.
  base: './',

  plugins: [react(), precacheServiceWorker(), ...(mode === 'https' ? [basicSsl()] : [])],

  server: {
    port: 5173,
    strictPort: false,
  },

  preview: {
    port: 4173,
    strictPort: false,
  },

  build: {
    target: ['es2020', 'safari14', 'chrome87', 'firefox78'],
    sourcemap: true,
    assetsInlineLimit: 4096,
  },
}));
