import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Inter, self-hosted — the closest open substitute for iOS's SF Pro, used on
// platforms (e.g. Windows) that don't ship it. Real iPhones fall through to
// -apple-system (SF) first. Bundled, so it still works offline.
import '@fontsource-variable/inter';
import './styles/app.css';
import { isNative, setUpNativeShell } from './lib/native';

setUpNativeShell();

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');


createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * Offline support, for the web build only.
 *
 * Skipped in dev so the worker never serves a stale module graph over the top
 * of Vite's HMR — and skipped in the native shell, where the assets are already
 * on the device and a precache buys nothing. Worse than nothing, in fact: a
 * worker holding the previous bundle inside the WebView would go on serving it
 * after an App Store update, and undoing that would need another release.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  });
}
