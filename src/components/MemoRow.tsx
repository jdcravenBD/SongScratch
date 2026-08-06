import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Memo } from '../types';
import { allPeaks, formatDuration, totalDuration } from '../lib/audio';
import { formatWhen } from '../lib/format';
import { usePlayer } from '../hooks/usePlayer';
import Waveform from './Waveform';
import {
  Back10Icon,
  Forward10Icon,
  PauseIcon,
  PinIcon,
  PlayIcon,
  PlusIcon,
  SelectDot,
  TrashIcon,
} from './icons';

const REVEAL = 78;
const SLOP = 8;
const LONG_MS = 450;
const COMMIT = 0.42;
const PILL_GAP = 14;
const ICON_AT = 40;

interface Props {
  memo: Memo;
  expanded: boolean;
  /** True while a recording is in progress anywhere on the screen. */
  busy: boolean;
  selectMode: boolean;
  selected: boolean;
  forceClosed: boolean;
  onExpand: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onTogglePin: (id: string) => void;
  onResume: (id: string) => void;
  onLongPress: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onReveal: (id: string | null) => void;
}

/**
 * One recording: its name, when it was made and how long it runs, opening to a
 * waveform you can scrub and a transport.
 *
 * Only the header takes the swipe, and the pointer is captured on that same
 * element — capturing on the wrapper instead retargets every later event to the
 * wrapper, so the header's own handlers stop firing and the row sticks halfway
 * open. Same gesture vocabulary as the song list: right to pin, left to delete,
 * hold to start selecting.
 */
export default function MemoRow({
  memo,
  expanded,
  busy,
  selectMode,
  selected,
  forceClosed,
  onExpand,
  onDelete,
  onRename,
  onTogglePin,
  onResume,
  onLongPress,
  onToggleSelect,
  onReveal,
}: Props) {
  const host = useRef<HTMLLIElement>(null);
  const fg = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const start = useRef({ x: 0, y: 0 });
  const rawX = useRef(0);
  const base = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const pid = useRef<number | null>(null);
  const longTimer = useRef(0);
  const longFired = useRef(false);
  const moved = useRef(false);

  const [open, setOpen] = useState<'none' | 'pin' | 'delete'>('none');
  const [renaming, setRenaming] = useState(false);

  // The player only exists for the open row; every memo holding object URLs
  // for its audio would mean the whole list in memory at once.
  const player = usePlayer(expanded ? memo : null);
  const duration = totalDuration(memo);
  const peaks = allPeaks(memo);

  const slide = (x: number, animate: boolean) => {
    const el = fg.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2,0.9,0.3,1)' : 'none';
    el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;
    const li = host.current;
    if (!li) return;
    const pill = Math.max(0, Math.abs(x) - PILL_GAP);
    li.dataset.swipe = x > 0 ? 'pin' : x < 0 ? 'delete' : 'none';
    li.style.setProperty('--reveal', `${pill}px`);
    li.style.setProperty('--reveal-ms', animate ? '0.32s' : '0s');
    li.style.setProperty('--icon-op', pill >= ICON_AT ? '1' : '0');
  };

  const close = (notify = true) => {
    setOpen('none');
    slide(0, true);
    if (notify) onReveal(null);
  };

  useEffect(() => {
    if ((forceClosed || selectMode) && open !== 'none') {
      setOpen('none');
      slide(0, true);
    }
  }, [forceClosed, selectMode, open]);

  useEffect(() => {
    if (renaming) nameInput.current?.select();
  }, [renaming]);

  const clearLong = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current);
      longTimer.current = 0;
    }
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (renaming) return;
    pid.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    base.current = open === 'delete' ? -REVEAL : open === 'pin' ? REVEAL : 0;
    axis.current = 'none';
    moved.current = false;
    longFired.current = false;

    if (!selectMode) {
      longTimer.current = window.setTimeout(() => {
        if (axis.current !== 'x' && !moved.current) {
          longFired.current = true;
          onLongPress(memo.id);
        }
      }, LONG_MS);
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === 'none') {
      if (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) {
        moved.current = true;
        clearLong();
        if (Math.abs(dx) > Math.abs(dy) && !selectMode) {
          axis.current = 'x';
          try {
            // Captured on the element that owns these handlers, or they stop
            // firing the moment capture moves the target elsewhere.
            head.current?.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
        } else {
          axis.current = 'y';
          pid.current = null; // let the list scroll
        }
      }
    }

    if (axis.current === 'x') {
      e.preventDefault();
      const x = base.current + dx;
      rawX.current = x;
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
    const swiped = axis.current === 'x';
    axis.current = 'none';

    if (!swiped) {
      if (longFired.current || moved.current || renaming) return;
      if (selectMode) onToggleSelect(memo.id);
      else if (open !== 'none') close();
      else onExpand(expanded ? null : memo.id);
      return;
    }

    const width = fg.current?.offsetWidth ?? 320;
    const x = rawX.current;

    if (x < -width * COMMIT) {
      slide(-width, true);
      window.setTimeout(() => onDelete(memo.id), 200);
    } else if (x > width * COMMIT) {
      onTogglePin(memo.id);
      close();
    } else if (x < -REVEAL * 0.55) {
      setOpen('delete');
      slide(-REVEAL, true);
      onReveal(memo.id);
    } else if (x > REVEAL * 0.55) {
      setOpen('pin');
      slide(REVEAL, true);
      onReveal(memo.id);
    } else {
      close();
    }
  };

  const commitRename = () => {
    const value = nameInput.current?.value.trim();
    setRenaming(false);
    if (value && value !== memo.name) onRename(memo.id, value);
  };

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(false);
  };

  return (
    <li className={`memo${expanded ? ' is-open' : ''}`} ref={host}>
      <button
        className="memo__action memo__action--pin"
        type="button"
        tabIndex={open === 'pin' ? 0 : -1}
        aria-label={memo.pinned ? `Unpin ${memo.name}` : `Pin ${memo.name}`}
        onClick={() => {
          onTogglePin(memo.id);
          close();
        }}
      >
        <PinIcon />
      </button>

      <button
        className="memo__action memo__action--delete"
        type="button"
        tabIndex={open === 'delete' ? 0 : -1}
        aria-label={`Delete ${memo.name}`}
        onClick={() => onDelete(memo.id)}
      >
        <TrashIcon />
      </button>

      <div className="memo__fg" ref={fg}>
        <div
          className="memo__head"
          ref={head}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className={`memo__check${selectMode ? ' is-shown' : ''}`}>
            <SelectDot on={selected} />
          </span>

          <span className="memo__text">
            {renaming ? (
              <input
                ref={nameInput}
                className="memo__rename"
                defaultValue={memo.name}
                onBlur={commitRename}
                onKeyDown={onNameKey}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Recording name"
              />
            ) : (
              <span
                className={`memo__name${expanded && !selectMode ? ' is-editable' : ''}`}
                /*
                 * Tapping the name of an open memo renames it; closed, the tap
                 * belongs to the row and opens it instead.
                 *
                 * The pointer events have to be swallowed here, not just the
                 * click. The header acts on pointerup, which lands first and
                 * collapses the row — by the time a click arrived there was
                 * nothing open left to rename.
                 */
                onPointerDown={(e) => {
                  if (expanded && !selectMode) e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  if (!expanded || selectMode) return;
                  e.stopPropagation();
                  setRenaming(true);
                }}
              >
                {memo.pinned && <PinIcon size={12} className="memo__pin" />}
                {memo.name}
              </span>
            )}
            <span className="memo__meta">
              <span>{formatWhen(memo.createdAt)}</span>
              <span className="memo__length">{formatDuration(duration)}</span>
            </span>
          </span>
        </div>

        {expanded && !selectMode && (
          <div className="memo__body">
            <Waveform
              peaks={peaks}
              progress={duration ? player.time / duration : 0}
              onScrub={(f) => player.seek(f * duration)}
            />

            <div className="memo__times">
              <span>{formatDuration(player.time)}</span>
              <span>-{formatDuration(Math.max(0, duration - player.time))}</span>
            </div>

            <div className="transport">
              <button
                className="transport__btn transport__btn--edge"
                type="button"
                aria-label={memo.pinned ? 'Unpin recording' : 'Pin recording'}
                aria-pressed={!!memo.pinned}
                onClick={() => onTogglePin(memo.id)}
              >
                <PinIcon size={22} />
              </button>

              <div className="transport__center">
                <button
                  className="transport__btn"
                  type="button"
                  aria-label="Back 10 seconds"
                  onClick={() => player.skip(-10)}
                >
                  <Back10Icon />
                </button>
                <button
                  className="transport__btn transport__btn--play"
                  type="button"
                  aria-label={player.playing ? 'Pause' : 'Play'}
                  onClick={player.toggle}
                >
                  {player.playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  className="transport__btn"
                  type="button"
                  aria-label="Forward 10 seconds"
                  onClick={() => player.skip(10)}
                >
                  <Forward10Icon />
                </button>
              </div>

              <button
                className="transport__btn transport__btn--edge"
                type="button"
                disabled={busy}
                aria-label="Add to recording"
                onClick={() => onResume(memo.id)}
              >
                <PlusIcon size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
