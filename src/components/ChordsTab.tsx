import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ChordSections } from '../hooks/useChordSections';
import SectionRow from './SectionRow';
import { PlusIcon } from './icons';

interface Drag {
  index: number;
  startY: number;
  /** Row boxes measured when the drag began; positions are compared to these. */
  rects: { top: number; height: number }[];
}

/**
 * The chord progression: a stack of named sections, in playing order.
 *
 * Reordering measures every row once when the drag starts and then works from
 * those numbers. Reading positions back mid-drag would mean reading a layout
 * this very gesture is busy changing, and the rows would fight the finger.
 */
export function ChordsList({ chords }: { chords: ChordSections }) {
  const { sections } = chords;
  const drag = useRef<Drag | null>(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const [target, setTarget] = useState(-1);
  const [dy, setDy] = useState(0);

  const listRef = useRef<HTMLUListElement>(null);

  const begin = useCallback(
    (index: number, e: ReactPointerEvent) => {
      const startY = e.clientY;
      // Close anything open first: a drag over rows of different heights can't
      // be reasoned about simply, and the measurement below has to happen after
      // the layout has settled.
      chords.setExpandedId(null);
      chords.setRevealedId(null);

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
    [chords],
  );

  // Listening on the window rather than capturing the pointer: a reorder can
  // travel well outside the row it started on, and window listeners can't be
  // retargeted out from under the gesture.
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
          if (to !== state.index) void chords.reorder(state.index, to);
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
  }, [dragIndex, chords]);

  /** How far a row that isn't being dragged should step aside. */
  const liftFor = (i: number) => {
    const state = drag.current;
    if (dragIndex < 0 || !state || i === dragIndex) return 0;
    const h = state.rects[dragIndex]?.height ?? 0;
    if (dragIndex < i && i <= target) return -h;
    if (dragIndex > i && i >= target) return h;
    return 0;
  };

  const count = sections.length;

  return (
    <>
      <div className="hero">
        <h1 className="hero__title">Chords</h1>
        <p className="hero__count">
          {count} {count === 1 ? 'Section' : 'Sections'}
        </p>
      </div>

      {count === 0 ? (
        <div className="empty">
          <p className="empty__title">No Sections</p>
          <p className="empty__hint">
            Add a section for each part of the song — verse, chorus, bridge.
          </p>
        </div>
      ) : (
        <ul className="sects" ref={listRef}>
          {sections.map((section, i) => (
            <SectionRow
              key={section.id}
              section={section}
              index={i}
              expanded={chords.expandedId === section.id}
              forceClosed={chords.revealedId !== null && chords.revealedId !== section.id}
              lift={i === dragIndex ? dy : liftFor(i)}
              dragging={i === dragIndex}
              onExpand={chords.setExpandedId}
              onRename={(id, name) => void chords.rename(id, name)}
              onDelete={(id) => void chords.remove(id)}
              onReveal={chords.setRevealedId}
              onAddChord={chords.startAdd}
              onGrip={begin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** Sits in the editor's bottom bar above the tabs. */
export function ChordsDock({ chords }: { chords: ChordSections }) {
  return (
    <div className="rec">
      <button className="chip chip--wide" type="button" onClick={() => void chords.add()}>
        <PlusIcon size={17} />
        <span>New Section</span>
      </button>
    </div>
  );
}
