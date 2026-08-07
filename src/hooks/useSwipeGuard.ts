import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Stops the list scrolling underneath a swipe that has already committed
 * sideways.
 *
 * Rows carry `touch-action: pan-y` so a finger can scroll the list from
 * anywhere on them. The cost is that the browser stays willing to scroll for
 * the whole gesture, so a quick flick upward part-way through a swipe-to-delete
 * would set the page moving under the row. `touch-action` can't be changed
 * once a gesture is under way, but a non-passive `touchmove` that calls
 * preventDefault still takes the scroll away — which is what this does, and
 * only while the swipe owns the gesture.
 */
export function useSwipeGuard(
  ref: RefObject<HTMLElement | null>,
  swiping: () => boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (swiping() && e.cancelable) e.preventDefault();
    };
    // Must be non-passive, or preventDefault is ignored on touchmove.
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, [ref, swiping]);
}
