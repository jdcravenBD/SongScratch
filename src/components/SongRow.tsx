import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Song } from '../types';
import { formatWhen } from '../lib/format';
import { ChordIcon, LyricsIcon, PinIcon, SelectDot, TrashIcon, VoiceIcon } from './icons';

/** How far a row slides to park its action open. */
const REVEAL = 78;
/** Movement past which a press is a drag rather than a tap or a hold. */
const SLOP = 8;
/** Hold this long without moving to enter multi-select. */
const LONG_MS = 450;
/** Fraction of the row's width that turns a swipe into a committed action. */
const COMMIT = 0.42;

interface Props {
  song: Song;
  index: number;
  selectMode: boolean;
  selected: boolean;
  /** True when a different row is the open one, so this one snaps shut. */
  forceClosed: boolean;
  onOpen: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onLongPress: (id: string) => void;
  onReveal: (id: string | null) => void;
}

/**
 * One song in the list.
 *
 * Gestures run on Pointer Events so a mouse behaves like a finger without a
 * second code path: swipe left for Delete, right for Pin (carry either past
 * ~40% of the row to commit it outright), press and hold to start selecting,
 * tap to open. A vertical drag is handed straight back to the list so the
 * scroll underneath still works.
 */
export default function SongRow({
  song,
  index,
  selectMode,
  selected,
  forceClosed,
  onOpen,
  onToggleSelect,
  onDelete,
  onTogglePin,
  onLongPress,
  onReveal,
}: Props) {
  const fg = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const base = useRef(0);
  /**
   * How far the finger has actually travelled. Kept apart from the drawn
   * offset: the row resists once it's dragged well past its parked position,
   * and testing that damped number against the commit threshold would mean a
   * full swipe could never reach it.
   */
  const rawX = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const pid = useRef<number | null>(null);
  const longTimer = useRef(0);
  const longFired = useRef(false);
  const moved = useRef(false);

  const [open, setOpen] = useState<'none' | 'pin' | 'delete'>('none');
  const [pressing, setPressing] = useState(false);

  const slide = (x: number, animate: boolean) => {
    const el = fg.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2,0.9,0.3,1)' : 'none';
    el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;
  };

  const close = (notify = true) => {
    setOpen('none');
    slide(0, true);
    if (notify) onReveal(null);
  };

  // Snap shut when another row opens, or when select mode starts.
  useEffect(() => {
    if ((forceClosed || selectMode) && open !== 'none') {
      setOpen('none');
      slide(0, true);
    }
  }, [forceClosed, selectMode, open]);

  const clearLong = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = 0;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pid.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    base.current = open === 'delete' ? -REVEAL : open === 'pin' ? REVEAL : 0;
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
            /* pointer already gone — nothing to capture */
          }
        } else {
          // Vertical, or any drag while selecting: let the list scroll.
          axis.current = 'y';
          setPressing(false);
          pid.current = null;
        }
      }
    }

    if (axis.current === 'x') {
      e.preventDefault();
      const x = base.current + ddx;
      rawX.current = x;
      // Resist past the parked position so the row feels tethered. Visual only.
      const limit = REVEAL + 60;
      slide(
        Math.abs(x) > limit ? Math.sign(x) * (limit + (Math.abs(x) - limit) * 0.25) : x,
        false,
      );
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    clearLong();
    setPressing(false);
    const swiped = axis.current === 'x';
    axis.current = 'none';

    if (!swiped) {
      if (longFired.current || moved.current) return;
      if (selectMode) onToggleSelect(song.id);
      else if (open !== 'none') close();
      else onOpen(song.id);
      return;
    }

    const width = fg.current?.offsetWidth ?? 320;
    const x = rawX.current;

    if (x < -width * COMMIT) {
      slide(-width, true); // carried far enough left — delete outright
      window.setTimeout(() => onDelete(song.id), 200);
    } else if (x > width * COMMIT) {
      onTogglePin(song.id); // carried far enough right — pin outright
      close();
    } else if (x < -REVEAL * 0.55) {
      setOpen('delete');
      slide(-REVEAL, true);
      onReveal(song.id);
    } else if (x > REVEAL * 0.55) {
      setOpen('pin');
      slide(REVEAL, true);
      onReveal(song.id);
    } else {
      close();
    }
  };

  const onPointerCancel = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    clearLong();
    setPressing(false);
    axis.current = 'none';
    close();
  };

  const tags = [
    song.chordCount ? <ChordIcon key="c" /> : null,
    song.sectionCount ? <LyricsIcon key="l" /> : null,
    song.voiceCount ? <VoiceIcon key="v" /> : null,
  ].filter(Boolean);

  return (
    <li
      className="row"
      // Cheap staggered entrance; capped so a long list never crawls in.
      style={{ animationDelay: `${Math.min(index, 12) * 22}ms` }}
    >
      <button
        className="row__action row__action--pin"
        type="button"
        tabIndex={open === 'pin' ? 0 : -1}
        aria-label={song.pinned ? `Unpin ${song.title || 'song'}` : `Pin ${song.title || 'song'}`}
        onClick={() => {
          onTogglePin(song.id);
          close();
        }}
      >
        <PinIcon />
      </button>

      <button
        className="row__action row__action--delete"
        type="button"
        tabIndex={open === 'delete' ? 0 : -1}
        aria-label={`Delete ${song.title || 'song'}`}
        onClick={() => onDelete(song.id)}
      >
        <TrashIcon />
      </button>

      <div
        ref={fg}
        className={`row__fg${pressing ? ' is-pressing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <span className={`row__check${selectMode ? ' is-shown' : ''}`}>
          <SelectDot on={selected} />
        </span>

        <span className="row__body">
          <span className="row__title">
            {song.pinned && <PinIcon size={12} className="row__pin" />}
            {song.title || 'New Song'}
          </span>
          <span className="row__meta">
            <span className="row__date">{formatWhen(song.updatedAt)}</span>
            <span className="row__preview">
              {song.description?.trim() || 'No additional text'}
            </span>
          </span>
        </span>

        {tags.length > 0 && <span className="row__tags">{tags}</span>}
      </div>
    </li>
  );
}
