import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';

/** True inside the iOS/Android shell, false in a browser or the desktop frame. */
export const isNative = Capacitor.isNativePlatform();

/**
 * The handful of things the native shell has to be told, once, at startup.
 *
 * Everything here is a no-op on the web, so it can be called unconditionally —
 * the checks live in this file rather than at the call site.
 */
export function setUpNativeShell(): void {
  if (!isNative) return;

  // Safari's own bar above the keyboard — the "Done" and arrow strip that sat
  // on top of ours while testing in the browser. No web API can hide it; this
  // is the only way, and the reason the app is wrapped at all rather than left
  // as a home-screen PWA.
  Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {
    /* not fatal: the app works with the bar, it just looks doubled */
  });

  // White glyphs, to match a page that is always black.
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {
    /* ditto */
  });
}
