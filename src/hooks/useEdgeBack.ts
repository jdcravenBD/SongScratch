import { useEffect, useRef, useState } from 'react';

/** How far in from the left edge a press has to land to count as an edge grab. */
const EDGE = 26;
/** Sideways travel before the gesture is ours rather than the list's. */
const SLOP = 10;
/** Past this fraction of the screen, letting go goes back. */
const COMMIT = 0.32;
/** …or a flick faster than this, however short. */
const FLICK = 0.45; // px per ms
/** How far the screen behind sits back. Matches the list-aside keyframes. */
const UNDER = 28; // %

/**
 * iOS's swipe-from-the-left-edge to go back, done by hand.
 *
 * There *is* a real one — `WKWebView.allowsBackForwardNavigationGestures`, the
 * same gesture Safari uses. It is no good to us: it walks the **web view's
 * history**, and this app's screens are React state, not pages. Turning it on
 * against a single document does nothing at all, and making the screens real
 * history entries only trades that for a gesture whose interactive preview is
 * a snapshot of the page you are already looking at.
 *
 * (Nor is it free in a native app. UIKit's version comes from putting screens
 * in a navigation controller; it is inherited, not switched on.)
 *
 * So the screen takes the gesture itself — a press within `EDGE` of the left
 * side that travels right drags the whole screen with the finger, and letting
 * go past a third of the way across (or with a flick) leaves.
 *
 * Only used where a rightward swipe means nothing else. Song rows swipe right
 * to pin, so the list deliberately doesn't have this; the editor and the chord
 * picker, whose rows only swipe left, do.
 *
 * Returns the ref to put on the screen. It hands back a **callback ref**, not a
 * plain one: a screen that waits for its record before it draws anything real
 * fills a `useRef` after the effect that wanted it has already run, and the
 * gesture would then be attached to nothing for the life of the screen.
 */
export function useEdgeBack(
  onBack: () => void,
  enabled = true,
  /**
   * A selector for the screen sitting behind this one, if it has somewhere to
   * be. It is drawn home in step with the finger rather than waiting for the
   * release — half-covered and stationary, it reads as lagging behind.
   */
  under?: string,
) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  /*
   * Held in a ref rather than in the dependencies. A parent hands this in as a
   * fresh closure on every render, and re-running the effect tears the gesture
   * down mid-drag — the cleanup wipes the transform, so the screen snaps back
   * under the finger and the swipe dies. Only the element and `enabled` may do
   * that now.
   */
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  });

  useEffect(() => {
    if (!el || !enabled) return;

    let id: number | null = null;
    let owns = false;
    /** A swipe just happened; eat the click it would otherwise fire. */
    let swallow = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let speed = 0;

    /** The screen behind, moved with this one. Found when the drag commits to
        being one, since it may not have existed when the effect ran. */
    let companion: HTMLElement | null = null;

    const move = (x: number, animate: boolean) => {
      const ease = 'transform 0.26s cubic-bezier(0.2,0.9,0.3,1)';
      el.style.transition = animate ? ease : 'none';
      el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;

      if (!companion) return;
      // Fully back by the time this screen is fully gone.
      const progress = Math.min(1, Math.max(0, x / (el.offsetWidth || 390)));
      companion.style.transition = animate ? ease : 'none';
      companion.style.transform = `translateX(${(-UNDER * (1 - progress)).toFixed(2)}%)`;
    };

    /** Hands the screen behind back to whatever CSS was holding it. */
    const releaseCompanion = () => {
      if (!companion) return;
      companion.style.transition = '';
      companion.style.transform = '';
      companion.classList.remove('is-tracking');
      companion = null;
    };

    const release = () => {
      id = null;
      owns = false;
      el.style.willChange = '';
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const box = el.getBoundingClientRect();
      // Against the screen's own left edge, not the window's — on desktop this
      // whole app sits inside a phone-shaped frame partway across the page.
      if (e.clientX - box.left > EDGE) return;
      id = e.pointerId;
      owns = false;
      startX = lastX = e.clientX;
      startY = e.clientY;
      lastT = e.timeStamp;
      speed = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!owns) {
        // A finger heading down the screen is scrolling, not leaving.
        if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
          release();
          return;
        }
        if (dx < SLOP) return;
        owns = true;
        el.style.willChange = 'transform';
        companion = under ? document.querySelector<HTMLElement>(under) : null;
        // Its own animation would otherwise sit on top of what we set here.
        companion?.classList.add('is-tracking');
      }

      /*
       * Speed over a real interval, not between whichever two moves happened to
       * arrive together. A pair a fraction of a millisecond apart — two samples
       * in one frame on a fast panel, or coalesced events — divides a few
       * pixels by almost nothing and reports a flick that never happened, which
       * sends the screen away under a finger that was barely moving. The mark
       * only advances when it is old enough to divide by.
       */
      const dt = e.timeStamp - lastT;
      if (dt >= 8) {
        speed = (e.clientX - lastX) / dt;
        lastX = e.clientX;
        lastT = e.timeStamp;
      }

      // Rightward only, and stiffening as it goes so the screen never detaches
      // from the finger entirely.
      move(Math.max(0, dx), false);
    };

    const onUp = (e: PointerEvent) => {
      if (id !== e.pointerId) return;
      const dx = e.clientX - startX;
      const went = owns;
      release();
      if (!went) return;
      // A drag that ends on the page must not also be a tap on it — landing on
      // the lyrics would otherwise open the keyboard on the way out.
      swallow = true;

      const width = el.offsetWidth || 390;
      if (dx > width * COMMIT || (dx > 40 && speed > FLICK)) {
        move(width, true);
        window.setTimeout(() => back.current(), 200);
      } else {
        move(0, true);
      }
      // Long enough for the settle above to finish; the screen behind is at
      // one end or the other by then, and CSS can have it back.
      window.setTimeout(releaseCompanion, 300);
    };

    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // The list under the finger must not scroll while the screen is being
    // dragged — same reason as useSwipeGuard, and the same fix.
    const block = (e: TouchEvent) => {
      if (owns && e.cancelable) e.preventDefault();
    };

    el.addEventListener('pointerdown', onDown);
    // On the window, because a row may capture the pointer part-way through and
    // capture retargets every event after it.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('touchmove', block, { passive: false });
    el.addEventListener('click', onClick, true);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('touchmove', block);
      el.removeEventListener('click', onClick, true);
      releaseCompanion();
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    };
  }, [el, enabled]);

  return setEl;
}
