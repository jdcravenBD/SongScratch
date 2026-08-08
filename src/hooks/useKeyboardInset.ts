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

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
