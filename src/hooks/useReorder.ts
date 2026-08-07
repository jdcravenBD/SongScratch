import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

interface Drag {
  index: number;
  startY: number;
  /** Row boxes measured when the drag began; positions compare against these. */
  rects: { top: number; height: number }[];
}

export interface Reorder {
  /** Put this on the <ul> whose children are the rows. */
  listRef: React.RefObject<HTMLUListElement | null>;
  /** Call from the grip's pointerdown. */
  begin: (index: number, e: ReactPointerEvent) => void;
  /** Index being dragged, or -1. */
  dragIndex: number;
  /** How far the dragged row has travelled. */
  dy: number;
  /** How far a row that isn't being dragged should step aside. */
  liftFor: (index: number) => number;
}

/**
 * Drag-to-reorder for a list of rows.
 *
 * Every row is measured once as the drag begins and the whole gesture works
 * from those numbers — reading positions back mid-drag means reading a layout
 * this very gesture is busy changing, and the rows end up fighting the finger.
 *
 * It listens on the window rather than capturing the pointer, because a reorder
 * routinely travels outside the row it started on, and window listeners can't
 * be retargeted out from under it.
 */
export function useReorder(
  onCommit: (from: number, to: number) => void,
  /** Run before measuring — collapse anything open so the rows are uniform. */
  prepare?: () => void,
): Reorder {
  const listRef = useRef<HTMLUListElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const [target, setTarget] = useState(-1);
  const [dy, setDy] = useState(0);

  const begin = useCallback(
    (index: number, e: ReactPointerEvent) => {
      const startY = e.clientY;
      prepare?.();
      // Measured next frame, so anything the prepare step closed has actually
      // gone before the rows are sized.
      requestAnimationFrame(() => {
        const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
        drag.current = {
          index,
          startY,
          rects: rows.map((r) => {
            const box = r.getBoundingClientRect();
            return { top: box.top, height: box.height };
          }),
        };
        setDragIndex(index);
        setTarget(index);
        setDy(0);
      });
    },
    [prepare],
  );

  useEffect(() => {
    if (dragIndex < 0) return;

    const onMove = (e: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      e.preventDefault();
      const offset = e.clientY - state.startY;
      setDy(offset);

      const self = state.rects[state.index];
      const centre = self.top + self.height / 2 + offset;
      let next = state.index;
      state.rects.forEach((rect, i) => {
        if (i === state.index) return;
        const mid = rect.top + rect.height / 2;
        if (i > state.index && centre > mid) next = Math.max(next, i);
        if (i < state.index && centre < mid) next = Math.min(next, i);
      });
      setTarget(next);
    };

    const finish = () => {
      const state = drag.current;
      drag.current = null;
      setDragIndex(-1);
      setDy(0);
      if (state) {
        setTarget((to) => {
          if (to !== state.index) onCommit(state.index, to);
          return -1;
        });
      }
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [dragIndex, onCommit]);

  const liftFor = useCallback(
    (i: number) => {
      const state = drag.current;
      if (dragIndex < 0 || !state || i === dragIndex) return 0;
      const h = state.rects[dragIndex]?.height ?? 0;
      if (dragIndex < i && i <= target) return -h;
      if (dragIndex > i && i >= target) return h;
      return 0;
    },
    [dragIndex, target],
  );

  return { listRef, begin, dragIndex, dy, liftFor };
}
