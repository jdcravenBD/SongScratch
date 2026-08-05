import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Song } from '../types';
import { formatWhen } from '../lib/format';
import { SelectDot, TrashIcon } from './icons';

/** Width of the delete affordance revealed on a left-swipe. */
const REVEAL = 84;
/** Movement past which a press is treated as a drag, not a tap or hold. */
const SLOP = 8;
/** Hold this long without moving to enter multi-select. */
const LONG_MS = 500;

interface Props {
  song: Song;
  selectMode: boolean;
  selected: boolean;
  /** True when another row is the open one, so this one should snap shut. */
  forceClosed: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
  onReveal: (id: string | null) => void;
}

export default function SongRow({
  song,
  selectMode,
  selected,
  forceClosed,
  onOpen,
  onToggleSelect,
  onDelete,
  onLongPress,
  onReveal,
}: Props) {
  const fg = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const base = useRef(0); // translate at gesture start (0 or -REVEAL)
  const dx = useRef(0); // live translate
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const pid = useRef<number | null>(null);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [pressing, setPressing] = useState(false);

  const translate = (x: number, animate: boolean) => {
    const el = fg.current;
    if (!el) return;
    el.style.transition = animate
      ? 'transform 0.24s cubic-bezier(0.22,0.61,0.36,1)'
      : 'none';
    el.style.transform = `translateX(${x}px)`;
    dx.current = x;
  };

  // Close when another row opens, or when select mode turns on.
  useEffect(() => {
    if ((forceClosed || selectMode) && revealed) {
      setRevealed(false);
      translate(0, true);
    }
  }, [forceClosed, selectMode, revealed]);

  const clearLong = () => {
    if (longTimer.current != null) {
      clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pid.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    base.current = revealed ? -REVEAL : 0;
    axis.current = 'none';
    moved.current = false;
    longFired.current = false;
    setPressing(true);

    if (!selectMode) {
      longTimer.current = window.setTimeout(() => {
        if (axis.current !== 'x' && !moved.current) {
          longFired.current = true;
          setPressing(false);
          onLongPress(song.id);
        }
      }, LONG_MS);
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;

    if (axis.current === 'none') {
      if (Math.abs(ddx) > SLOP || Math.abs(ddy) > SLOP) {
        moved.current = true;
        clearLong();
        if (Math.abs(ddx) > Math.abs(ddy) && !selectMode) {
          axis.current = 'x';
          setPressing(false);
          try {
            fg.current?.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already released, or a synthetic event — fine */
          }
        } else {
          // Vertical (a scroll) or a move in select mode: bow out and let the
          // list scroll natively.
          axis.current = 'y';
          setPressing(false);
          pid.current = null;
        }
      }
    }

    if (axis.current === 'x') {
      e.preventDefault();
      let x = base.current + ddx;
      if (x > 0) x *= 0.3; // rubber-band past closed
      const floor = -REVEAL - 48;
      if (x < floor) x = floor + (x - floor) * 0.3;
      translate(x, false);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    clearLong();
    setPressing(false);
    const wasX = axis.current === 'x';
    axis.current = 'none';

    if (!wasX) {
      // A tap: ignore if it was really a hold or a scroll.
      if (!longFired.current && !moved.current) {
        if (selectMode) onToggleSelect(song.id);
        else if (revealed) {
          setRevealed(false);
          translate(0, true);
          onReveal(null);
        } else {
          onOpen(song.id);
        }
      }
      return;
    }

    const rowW = fg.current?.offsetWidth ?? 320;
    if (-dx.current > rowW * 0.5) {
      translate(-rowW, true); // full swipe → delete
      window.setTimeout(() => onDelete(song.id), 190);
    } else if (-dx.current > REVEAL * 0.5) {
      setRevealed(true);
      translate(-REVEAL, true);
      onReveal(song.id);
    } else {
      setRevealed(false);
      translate(0, true);
      onReveal(null);
    }
  };

  const onPointerCancel = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    clearLong();
    setPressing(false);
    axis.current = 'none';
    setRevealed(false);
    translate(0, true);
    onReveal(null);
  };

  return (
    <li className="row">
      <button
        className="row__delete"
        type="button"
        aria-label={`Delete ${song.title || 'song'}`}
        onClick={() => onDelete(song.id)}
      >
        <TrashIcon />
      </button>

      <div
        ref={fg}
        className={`row__fg${pressing ? ' is-pressing' : ''}${
          selectMode ? ' is-selecting' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {selectMode && (
          <span className={`row__check${selected ? ' is-on' : ''}`}>
            <SelectDot on={selected} />
          </span>
        )}
        <span className="row__text">
          <span className="row__title">{song.title || 'New Song'}</span>
          <span className="row__meta">
            <span className="row__date">{formatWhen(song.updatedAt)}</span>
            <span className="row__preview">
              {song.description?.trim() || 'No additional text'}
            </span>
          </span>
        </span>
      </div>
    </li>
  );
}
