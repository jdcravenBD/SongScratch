import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';

/**
 * A scroll container with:
 *  - mouse drag-to-scroll (see useDragScroll),
 *  - a thin, handle-only scrollbar that snaps visible the instant you scroll
 *    and fades out ~1s after you stop,
 *  - top and bottom edges that blur and fade to black, shown only on the side
 *    there's more content to reveal.
 */
export default function ScrollArea({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fadeTop = useRef<HTMLDivElement>(null);
  const fadeBottom = useRef<HTMLDivElement>(null);
  const hideTimer = useRef(0);

  useDragScroll(viewport);

  useEffect(() => {
    const vp = viewport.current;
    const b = bar.current;
    const ft = fadeTop.current;
    const fb = fadeBottom.current;
    if (!vp || !b) return;

    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = vp;
      const max = scrollHeight - clientHeight;
      const scrollable = max > 1;

      if (ft) ft.style.opacity = scrollable ? String(Math.min(1, scrollTop / 24)) : '0';
      if (fb) fb.style.opacity = scrollable ? String(Math.min(1, (max - scrollTop) / 24)) : '0';

      if (!scrollable) {
        b.style.opacity = '0';
        return false;
      }
      const h = Math.max(28, (clientHeight / scrollHeight) * clientHeight);
      const maxTop = clientHeight - h;
      const t = scrollTop / max;
      b.style.height = `${h}px`;
      b.style.transform = `translateY(${Math.max(0, Math.min(maxTop, t * maxTop))}px)`;
      return true;
    };

    const onScroll = () => {
      if (!measure()) return;
      b.style.transition = 'none'; // snap visible
      b.style.opacity = '1';
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        b.style.transition = 'opacity 0.6s ease';
        b.style.opacity = '0';
      }, 1000);
    };

    vp.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(vp);
    if (content.current) ro.observe(content.current);
    measure();

    return () => {
      vp.removeEventListener('scroll', onScroll);
      ro.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div className="scroll">
      <div className="scroll__viewport" ref={viewport}>
        <div className="scroll__content" ref={content}>
          {children}
        </div>
      </div>
      <div className="scroll__fade scroll__fade--top" ref={fadeTop} aria-hidden="true" />
      <div
        className="scroll__fade scroll__fade--bottom"
        ref={fadeBottom}
        aria-hidden="true"
      />
      <div className="scroll__bar" ref={bar} aria-hidden="true" />
    </div>
  );
}
