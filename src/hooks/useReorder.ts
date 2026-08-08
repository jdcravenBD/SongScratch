import { useCallback, useEffect, useRef, useState } from 'react';

interface Drag {
  index: number;
  startY: number;
  /** Row boxes measured when the drag began; positions compare against these. */
  rects: { top: number; height: number }[];
}

export interface Reorder {
  /** Put this on the <ul> whose children are the rows. */
  listRef: React.RefObject<HTMLUListElement | null>;
  /**
   * Start a drag. Called by the row only once the finger has actually moved,
   * so a tap on the grip stays a tap; `startY` is where the press began, not
   * where it had reached by then.
   */
  begin: (index: number, startY: number) => void;
  /** Index being dragged, or -1. */
  dragIndex: number;
  /** How far the dragged row has travelled. */
  dy: number;
  /** How far a row that isn't being dragged should step aside. */
  liftFor: (index: number) => number;
  /**
   * True for a moment after a drop. Put it on the list as a class that turns
   * the rows' transitions off — see the note in `finish`.
   */
  settling: boolean;
}

/**
 * How long transitions stay off after a drop: long enough to cover the write
 * to the store and the re-render that brings the new order back.
 */
const SETTLE_MS = 260;

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
  /** The same number as `target`, readable outside a render. */
  const targetRef = useRef(-1);
  const [dy, setDy] = useState(0);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const begin = useCallback(
    (index: number, startY: number) => {
      prepare?.();
      /*
       * Two frames, not one. `prepare` collapses whatever was open, but that is
       * React state — one frame later the DOM may still show the old height, and
       * measuring then gives the dragged row the height of an *expanded* row.
       * Every other row would then step aside by that much, tearing large gaps
       * through the list. The second frame is after the collapse has landed.
       */
      requestAnimationFrame(() => {
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
          targetRef.current = index;
          setTarget(index);
          setDy(0);
        });
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

      /*
       * How many places it has moved, straight from the distance travelled.
       *
       * Comparing the dragged row against each neighbour's *original* midpoint
       * looked right going one way and wrong coming back: the rows had already
       * stepped aside, so on the return leg they swapped again the moment the
       * finger crossed a line that no longer described where anything was. A
       * row height per place, rounded, is symmetric — the same half-row of
       * travel in either direction — and the rows are uniform here because the
       * drag collapses anything open before it starts.
       */
      const step = state.rects[state.index].height || 1;
      const moved = Math.round(offset / step);
      const to = Math.max(0, Math.min(state.rects.length - 1, state.index + moved));
      targetRef.current = to;
      setTarget(to);
    };

    const finish = () => {
      const state = drag.current;
      drag.current = null;
      /*
       * Transitions off for a moment. Letting go clears every offset at once,
       * and the rows would animate from where the drag had put them back to
       * where they started — the dragged one flying home just before the new
       * order arrives and puts it where the finger left it. It should simply
       * be where it was dropped, so the tidying-up is not animated at all.
       */
      setSettling(true);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setSettling(false), SETTLE_MS);
      setDragIndex(-1);
      setDy(0);
      /*
       * Committed from a ref, not from inside a state updater. An updater has
       * to be pure — React is free to run it more than once, and in
       * development it does, which called this twice and applied the move
       * twice. The list then flicked through an order nobody had asked for
       * before settling.
       */
      const to = targetRef.current;
      setTarget(-1);
      if (state && to !== state.index) onCommit(state.index, to);
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

  return { listRef, begin, dragIndex, dy, liftFor, settling };
}
