import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';

interface Props {
  children: ReactNode;
  /**
   * Called with the scroll offset on every scroll, plus once on mount. Fired
   * outside React state on purpose — the caller drives the collapsing header
   * straight through a ref, so scrolling never re-renders the list.
   */
  onScroll?: (top: number) => void;
}

/**
 * The list's scroll container:
 *  - a mouse can click-drag it up and down like a finger, with inertia;
 *  - the OS scrollbar is replaced by a thin handle that snaps visible the
 *    instant you scroll and fades out a second after you stop.
 *
 * The blur-and-fade edges are not here — they belong to the nav bar and the
 * dock, which sit over this and already have to blur what passes beneath them.
 */
export default function ScrollArea({ children, onScroll }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hideTimer = useRef(0);

  useDragScroll(viewport);

  useEffect(() => {
    const vp = viewport.current;
    const handle = bar.current;
    if (!vp || !handle) return;

    /** Size and place the handle. Returns false when there's nothing to scroll. */
    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = vp;
      const max = scrollHeight - clientHeight;
      if (max <= 1) {
        handle.style.opacity = '0';
        return false;
      }
      const h = Math.max(32, (clientHeight / scrollHeight) * clientHeight);
      const travel = clientHeight - h;
      handle.style.height = `${h}px`;
      handle.style.transform = `translateY(${clamp(0, travel, (scrollTop / max) * travel)}px)`;
      return true;
    };

    const show = () => {
      handle.style.transition = 'none'; // appear instantly …
      handle.style.opacity = '1';
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        handle.style.transition = 'opacity 0.55s ease'; // … but leave gently
        handle.style.opacity = '0';
      }, 1000);
    };

    const handleScroll = () => {
      onScroll?.(vp.scrollTop);
      if (measure()) show();
    };

    vp.addEventListener('scroll', handleScroll, { passive: true });

    // Content grows and shrinks as songs are added, deleted or filtered.
    const ro = new ResizeObserver(() => measure());
    ro.observe(vp);
    if (content.current) ro.observe(content.current);

    measure();
    onScroll?.(vp.scrollTop);

    return () => {
      vp.removeEventListener('scroll', handleScroll);
      ro.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, [onScroll]);

  return (
    <div className="scroll">
      <div className="scroll__viewport" ref={viewport}>
        <div className="scroll__content" ref={content}>
          {children}
        </div>
      </div>
      <div className="scroll__bar" ref={bar} aria-hidden="true" />
    </div>
  );
}

const clamp = (lo: number, hi: number, v: number) => (v < lo ? lo : v > hi ? hi : v);
