import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Chord, ChordSection } from '../types';
import type { ChordAnchor } from '../hooks/useChordSections';
import { useSwipeGuard } from '../hooks/useSwipeGuard';
import ChordDiagram from './ChordDiagram';
import { PlusIcon } from './icons';

const LONG_MS = 450;
/** Movement that cancels a hold, and movement that starts a drag. */
const SLOP = 8;
const DRAG_FROM = 4;
/** How long transitions stay off after a drop — see `release`. */
const SETTLE_MS = 260;

interface Props {
  section: ChordSection;
  /** True while this section's chords are being arranged. */
  arranging: boolean;
  /** Tapped: what can be done with this one chord, and where it sits. */
  onTapChord: (sectionId: string, chord: Chord, at: ChordAnchor) => void;
  /** Held: the whole rail comes loose. */
  onArrange: (sectionId: string) => void;
  onAddChord: (sectionId: string) => void;
  onReorder: (sectionId: string, from: number, to: number) => void;
  onDone: () => void;
}

/**
 * The fingerings in one section, and the two things you can do to them.
 *
 * A tap opens what can be done with that chord. **Holding** one sets the whole
 * rail jiggling and hands the same press straight on to a drag, so picking a
 * chord up and moving it is one gesture rather than a menu trip; a press
 * anywhere off the rail puts them down again.
 *
 * The reordering is worked out from **measured positions**, not from arithmetic
 * on an index: chords wrap onto as many lines as they need, so "one place left"
 * can mean the end of the line above. Every tile is measured when the drag
 * starts, and each one is then simply told to sit in the slot its new index
 * owns — which handles the wrap without knowing anything about it.
 */
export default function SectionChords({
  section,
  arranging,
  onTapChord,
  onArrange,
  onAddChord,
  onReorder,
  onDone,
}: Props) {
  const rail = useRef<HTMLDivElement>(null);
  /** A press that comes loose for arranging if it stays still long enough. */
  const hold = useRef({ x: 0, y: 0, id: -1, timer: 0 });
  /** Which chord that press is on, so a tap can put its menu against it. */
  const anchor = useRef<{ el: HTMLElement; chord: Chord } | null>(null);
  const settle = useRef(0);

  useEffect(() => () => window.clearTimeout(settle.current), []);
  const drag = useRef<{
    id: number;
    from: number;
    to: number;
    rects: DOMRect[];
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  /*
   * A hold turns into a drag part-way through a gesture the browser has
   * already agreed to scroll — and `touch-action` can't be changed once one is
   * under way. Taking the scroll back by hand is the only way from here.
   */
  useSwipeGuard(rail, () => drag.current !== null);

  /** A press anywhere but on these chords is the way out. */
  useEffect(() => {
    if (!arranging) return;
    const leave = (e: PointerEvent) => {
      if (!rail.current?.contains(e.target as Node)) onDone();
    };
    document.addEventListener('pointerdown', leave, true);
    return () => document.removeEventListener('pointerdown', leave, true);
  }, [arranging, onDone]);

  // Nothing is left half-dragged if the mode ends mid-gesture.
  useEffect(() => {
    if (!arranging) release();
  }, [arranging]);

  const tiles = () =>
    Array.from(rail.current?.querySelectorAll<HTMLElement>('.chord--held') ?? []);

  const endHold = () => {
    if (hold.current.timer) {
      window.clearTimeout(hold.current.timer);
      hold.current.timer = 0;
    }
  };

  /**
   * Puts every tile back where the DOM says it belongs.
   *
   * With the transition off, deliberately. Clearing the offsets would otherwise
   * animate each tile from where the drag had put it back to where it started,
   * a moment before the new order arrives and moves it again — a chord should
   * simply be where it was dropped. Restored on a timer that comfortably
   * outlasts the write to the store.
   */
  const release = () => {
    for (const el of tiles()) {
      el.style.transition = 'none';
      el.style.transform = '';
      el.style.zIndex = '';
      el.classList.remove('is-lifted');
    }
    drag.current = null;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      for (const el of tiles()) el.style.transition = '';
    }, SETTLE_MS);
  };

  /** Draws the run as it stands mid-drag: one tile under the finger, the rest
      sitting in the slots the new order gives them. */
  const paint = (dx: number, dy: number) => {
    const d = drag.current;
    if (!d) return;
    const order = withMoved(d.rects.length, d.from, d.to);
    tiles().forEach((el, i) => {
      if (i === d.from) {
        // Position only — the lift's size is on the inside, with the jiggle.
        el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        return;
      }
      const now = d.rects[i];
      const slot = d.rects[order.indexOf(i)];
      el.style.transform = `translate3d(${slot.left - now.left}px,${slot.top - now.top}px,0)`;
    });
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_FROM && Math.abs(dy) < DRAG_FROM) return;
      d.moved = true;
      const lifted = tiles()[d.from];
      lifted?.classList.add('is-lifted');
      if (lifted) lifted.style.zIndex = '5';
    }

    // The slot whose middle the chord is closest to. Distance, not axis, is
    // what makes this work across a line break.
    const held = d.rects[d.from];
    const x = held.left + held.width / 2 + dx;
    const y = held.top + held.height / 2 + dy;
    let best = d.from;
    let nearest = Infinity;
    d.rects.forEach((r, i) => {
      const gap = (r.left + r.width / 2 - x) ** 2 + (r.top + r.height / 2 - y) ** 2;
      if (gap < nearest) {
        nearest = gap;
        best = i;
      }
    });
    d.to = best;
    paint(dx, dy);
  };

  const onUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const { from, to, moved } = d;
    release();
    // The re-render puts the chords in their new order, so the tiles are back
    // to plain untransformed elements by the time it lands.
    if (moved && to !== from) onReorder(section.id, from, to);
  };

  /** Picks a chord up. Used by both ways in — already loose, or just held. */
  const beginDrag = (id: number, index: number, x: number, y: number) => {
    drag.current = {
      id,
      from: index,
      to: index,
      rects: tiles().map((el) => el.getBoundingClientRect()),
      startX: x,
      startY: y,
      moved: false,
    };
    // On the window: a capture elsewhere would otherwise take these away.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onDown = (e: ReactPointerEvent, chord: Chord, index: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (arranging) {
      beginDrag(e.pointerId, index, e.clientX, e.clientY);
      return;
    }

    // Held now: currentTarget only means anything during the dispatch itself.
    const el = e.currentTarget as HTMLElement;
    const { pointerId, clientX, clientY } = e;
    endHold();
    hold.current = {
      x: clientX,
      y: clientY,
      id: pointerId,
      timer: window.setTimeout(() => {
        hold.current.timer = 0;
        onArrange(section.id);
        // The same press carries straight on into moving that chord — the
        // finger is already down on it, and asking for a second one to start
        // the drag would be a gesture nobody makes.
        beginDrag(pointerId, index, clientX, clientY);
      }, LONG_MS),
    };
    // Where the menu would grow from, measured while the element is to hand.
    anchor.current = { el, chord };
  };

  const onHoldMove = (e: ReactPointerEvent) => {
    const press = hold.current;
    if (press.id !== e.pointerId || !press.timer) return;
    // A finger on its way somewhere — scrolling the list, most likely.
    if (Math.abs(e.clientX - press.x) > SLOP || Math.abs(e.clientY - press.y) > SLOP) {
      endHold();
    }
  };

  /** Let go before the hold landed, and without going anywhere: a tap. */
  const onTap = (e: ReactPointerEvent) => {
    const press = hold.current;
    const at = anchor.current;
    if (press.id !== e.pointerId || !press.timer || !at) return;
    endHold();
    anchor.current = null;
    const box = at.el.getBoundingClientRect();
    // Against the screen, which is what the menu is positioned inside.
    const screen = at.el.closest('.screen')?.getBoundingClientRect();
    onTapChord(section.id, at.chord, {
      x: box.left + box.width / 2 - (screen?.left ?? 0),
      top: box.top - (screen?.top ?? 0),
      bottom: box.bottom - (screen?.top ?? 0),
    });
  };

  return (
    <div className={`chords${arranging ? ' is-arranging' : ''}`} ref={rail}>
      {section.chords.map((chord, i) => (
        <div
          className="chord chord--held"
          key={chord.id}
          onPointerDown={(e) => onDown(e, chord, i)}
          onPointerMove={onHoldMove}
          onPointerUp={onTap}
          onPointerCancel={endHold}
        >
          {/* The jiggle lives on the inside so the outside is free to be moved:
              an animation beats an inline transform, and one element cannot
              wear both. */}
          <span className="chord__inner">
            <ChordDiagram shape={chord.shape} />
            <span className="chord__name">{chord.name}</span>
          </span>
        </div>
      ))}

      {/* The add button is the next slot in the progression, shaped and sized
          like the fingerings it sits beside, so the row reads as one continuous
          run with an empty place at the end. */}
      <button
        className="chord chord--add"
        type="button"
        aria-label="Add chord"
        onClick={() => onAddChord(section.id)}
      >
        <span className="chord__slot">
          <PlusIcon size={22} />
        </span>
        <span className="chord__name">Add</span>
      </button>
    </div>
  );
}

/** The indices 0…n-1 with `from` lifted out and put back down at `to`. */
function withMoved(n: number, from: number, to: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return order;
}
