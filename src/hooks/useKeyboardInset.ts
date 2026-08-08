import { useEffect, useState } from 'react';

/**
 * How much of the window the on-screen keyboard is covering, in px.
 *
 * iOS doesn't resize the window when the keyboard opens — it shrinks the
 * *visual* viewport and leaves the layout viewport alone, so `100vh` and
 * `position: fixed` both keep pointing at ground that is now behind the
 * keyboard. Comparing the two is the only way to find out how much is hidden,
 * which is what lets the format bar sit directly on top of the keyboard.
 *
 * Returns 0 on desktop, where there is no keyboard to avoid.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Undo Safari's shove. To reveal a field near the bottom it scrolls the
      // *page* up by roughly the keyboard's height — and since this app is one
      // fixed screen rather than a document, that carries the top bar and the
      // first rows clean off the top of the display. Nothing here is ever meant
      // to scroll, so any offset at all is the browser's doing and safe to put
      // back; the layout below moves out of the keyboard's way instead.
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);

      // offsetTop matters too: the page can be scrolled within the visual
      // viewport, and without it the inset drifts as that happens.
      const hidden = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(hidden > 1 ? hidden : 0);
    };

    /**
     * Every frame for a moment after focus changes, rather than only when the
     * viewport events happen to fire.
     *
     * Two reasons. The keyboard slides in over a few hundred milliseconds and
     * iOS does not reliably announce when it lands, so a single reading can
     * stick at whatever the animation had reached. And correcting the shove on
     * a viewport event is a frame or more too late — the page is *painted*
     * lifted and then dropped back, which is the flight this is meant to
     * prevent rather than tidy up after. Checking every frame means it never
     * gets more than one frame off the mark.
     */
    let raf = 0;
    let until = 0;
    const step = () => {
      update();
      raf = performance.now() < until ? requestAnimationFrame(step) : 0;
    };
    const settle = () => {
      until = performance.now() + 700;
      if (!raf) raf = requestAnimationFrame(step);
    };

    vv.addEventListener('resize', settle);
    vv.addEventListener('scroll', update);
    window.addEventListener('focusin', settle);
    window.addEventListener('focusout', settle);
    update();
    return () => {
      vv.removeEventListener('resize', settle);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('focusin', settle);
      window.removeEventListener('focusout', settle);
      cancelAnimationFrame(raf);
    };
  }, []);

  return inset;
}
