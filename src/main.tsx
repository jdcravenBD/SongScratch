import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Inter, self-hosted — the closest open substitute for iOS's SF Pro, used on
// platforms (e.g. Windows) that don't ship it. Real iPhones fall through to
// -apple-system (SF) first. Bundled, so it still works offline.
import '@fontsource-variable/inter';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

/**
 * The height the app should actually be.
 *
 * Neither `100%` nor `100dvh` can be trusted on iOS: the first resolves against
 * the viewport with Safari's toolbars showing, and `dvh` has its own idea of the
 * viewport that leaves a strip of dead black under the interface once the app is
 * on the home screen. `window.innerHeight` is the visible area, measured rather
 * than inferred.
 *
 * Deliberately not tied to the keyboard: iOS shrinks only the *visual* viewport
 * when it opens, leaving innerHeight alone, so the layout stays put and the
 * format bar rides up on its own (see useKeyboardInset).
 */
const setAppHeight = () => {
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
};
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support. Skipped in dev so the service worker never serves a stale
// module graph over the top of Vite's HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a bonus, not a requirement */
    });
  });
}
