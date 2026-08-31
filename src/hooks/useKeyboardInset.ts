import { useEffect, useState } from 'react';

/** Where the last keyboard height seen on this device is remembered. */
const REMEMBERED = 'ss-kb-height';
/** How long a guessed height is allowed to stand before measurement wins. */
const PRIME_MS = 700;
/**
 * What to assume before this device has ever shown its keyboard. Roughly an
 * iPhone's with the accessory bar; being a little out costs a small settle when
 * the real number lands, where having no guess at all costs the whole flight.
 */
const DEFAULT_GUESS = 336;

/**
 * How much of the window the on-screen keyboard is covering, in px.
 *
 * iOS doesn't resize the window when the keyboard opens — it shrinks the
 * *visual* viewport and leaves the layout viewport alone, so `100vh` and
 * `position: fixed` both keep pointing at ground that is now behind the
 * keyboard. Comparing the two is the only way to find out how much is hidden,
 * which is what lets a dock sit directly on top of the keyboard.
 *
 * The number is also **guessed ahead of time**. Safari scrolls the whole page
 * to reveal a field the keyboard is about to cover, and correcting that after
 * the fact is a frame too late however tightly it is watched — the page is
 * painted lifted and then dropped back, which is the flight this is meant to
 * prevent. So a press on a text field applies the height this device used last
 * time *before* focus lands: the field is already clear of the keyboard by the
 * time the browser looks, and it has no reason to scroll anything. Measurement
 * takes over the moment it has something real to say, and the guess expires by
 * itself if no keyboard turns up (a hardware one, say).
 *
 * Returns 0 on desktop, where there is no keyboard to avoid.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let guess = Number(localStorage.getItem(REMEMBERED)) || DEFAULT_GUESS;
    let guessUntil = 0;
    let raf = 0;
    let until = 0;

    const update = () => {
      // Put back Safari's shove, for the cases the guess didn't head off. Any
      // offset at all is the browser's doing: nothing here is meant to scroll.
      if (window.scrollY !== 0 || vv.offsetTop !== 0) window.scrollTo(0, 0);

      const hidden = window.innerHeight - (vv.height + vv.offsetTop);
      if (hidden > 1) {
        // Real, and worth remembering for the next time this field is tapped.
        if (Math.abs(hidden - guess) > 2) {
          guess = hidden;
          try {
            localStorage.setItem(REMEMBERED, String(Math.round(hidden)));
          } catch {
            /* private mode; the guess just won't outlive the session */
          }
        }
        guessUntil = 0;
        setInset(hidden);
        return;
      }
      // Nothing measured yet: hold the guess briefly, then admit there is no
      // keyboard rather than leaving the screen short forever.
      setInset(performance.now() < guessUntil ? guess : 0);
    };

    /** Watch every frame for a moment — the keyboard slides in over a few
        hundred ms and iOS doesn't reliably announce when it lands. */
    const settle = () => {
      until = performance.now() + PRIME_MS;
      if (!raf) {
        const step = () => {
          update();
          raf = performance.now() < until ? requestAnimationFrame(step) : 0;
        };
        raf = requestAnimationFrame(step);
      }
    };

    /** A finger going down on something that takes text, before focus moves. */
    const prime = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const el = e.target as HTMLElement | null;
      if (!el) return;
      /*
       * `closest` only walks upwards, and the search field is an <input> inside
       * a <label>. Land on the magnifier or on the pill's padding and the label
       * still moves focus to the field — but the press itself was on neither
       * the input nor an ancestor of it, so this bailed and the page flew.
       * Which half of the pill your thumb hit decided whether it happened: the
       * "only sometimes" of it.
       */
      const takesText =
        el.closest('input, textarea, [contenteditable="true"]') ??
        el.closest('label')?.querySelector('input, textarea');
      if (!takesText) return;
      guessUntil = performance.now() + PRIME_MS;
      setInset(guess);
      settle();
    };

    vv.addEventListener('resize', settle);
    vv.addEventListener('scroll', update);
    document.addEventListener('pointerdown', prime, true);
    window.addEventListener('focusin', settle);
    window.addEventListener('focusout', settle);
    update();
    return () => {
      vv.removeEventListener('resize', settle);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('pointerdown', prime, true);
      window.removeEventListener('focusin', settle);
      window.removeEventListener('focusout', settle);
      cancelAnimationFrame(raf);
    };
  }, []);

  return inset;
}
