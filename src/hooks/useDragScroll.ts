import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Lets a mouse click-and-drag the scroll container up and down like a finger on
 * a touch screen, with a little inertia on release. Gated to `pointerType ===
 * 'mouse'`: touch already scrolls natively (and does it better), and we don't
 * want to fight it.
 *
 * Horizontal drags are left alone so a row's swipe-to-delete still works — this
 * only claims the gesture once it's clearly vertical.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    // Off while text is being edited: there a drag has to mean "select", and
    // hijacking it for scrolling would make selection impossible.
    if (!el || !enabled) return;

    let active = false;
    let decided = false;
    let startX = 0;
    let startY = 0;
    let startTop = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0; // px per ms
    let raf = 0;
    let pid: number | null = null;

    const stopInertia = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      active = true;
      decided = false;
      startX = e.clientX;
      startY = e.clientY;
      startTop = el.scrollTop;
      lastY = e.clientY;
      lastT = e.timeStamp;
      vel = 0;
      pid = e.pointerId;
      stopInertia();
    };

    const onMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== pid) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;

      if (!decided) {
        if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
          decided = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* fine */
          }
        } else if (Math.abs(dx) > 8) {
          active = false; // horizontal — leave it to the row's swipe
          return;
        } else {
          return;
        }
      }

      e.preventDefault();
      el.scrollTop = startTop - dy;

      const dt = e.timeStamp - lastT;
      if (dt > 0) vel = (e.clientY - lastY) / dt;
      lastY = e.clientY;
      lastT = e.timeStamp;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const wasDragging = decided;
      active = false;
      decided = false;
      pid = null;
      if (!wasDragging) return;

      let v = vel * 16; // ~px per frame
      stopInertia();
      if (Math.abs(v) <= 1) return;
      const step = () => {
        v *= 0.94;
        if (Math.abs(v) < 0.5) {
          raf = 0;
          return;
        }
        el.scrollTop -= v;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      stopInertia();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [ref, enabled]);
}
