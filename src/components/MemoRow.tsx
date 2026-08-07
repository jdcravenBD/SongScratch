import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Memo } from '../types';
import { allPeaks, formatDuration, totalDuration } from '../lib/audio';
import { formatWhen } from '../lib/format';
import { caretIndexAtX, fontOf } from '../lib/caret';
import { useSwipeGuard } from '../hooks/useSwipeGuard';
import { usePlayer } from '../hooks/usePlayer';
import Waveform from './Waveform';
import {
  Back10Icon,
  Forward10Icon,
  GripIcon,
  PauseIcon,
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
  index: number;
  /** Offset while a reorder is in flight, in px. */
  lift: number;
  dragging: boolean;
  expanded: boolean;
  /** True while a recording is in progress anywhere on the screen. */
  busy: boolean;
  selectMode: boolean;
  selected: boolean;
  forceClosed: boolean;
  onExpand: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onResume: (id: string) => void;
  onLongPress: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onReveal: (id: string | null) => void;
  /** Starts a reorder. Given where the press began, not where it is now. */
  onGrip: (index: number, startY: number) => void;
}

/**
 * One recording: its name, when it was made and how long it runs, opening to a
 * waveform you can scrub and a transport.
 *
 * The swipe lives on the whole row so an open memo can be thrown away from
 * anywhere in it, and the pointer is captured on that same element — capture
 * retargets every later event, so capturing anywhere else would stop these
 * handlers firing and leave the row stuck halfway open. Taps only open and
 * close from the header, leaving the controls in the body to themselves.
 */
export default function MemoRow({
  memo,
  index,
  lift,
  dragging,
  expanded,
  busy,
  selectMode,
  selected,
  forceClosed,
  onExpand,
  onDelete,
  onRename,
  onResume,
  onLongPress,
  onToggleSelect,
  onReveal,
  onGrip,
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
  /** A press on the grip: a tap toggles the row, a drag reorders it. */
  const gripPress = useRef({ y: 0, id: -1, armed: false });
  /** Where in the name the finger landed, so the caret can start there. */
  const caretAt = useRef<number | null>(null);

  // While a sideways swipe owns the gesture, the list must not scroll.
  useSwipeGuard(fg, () => axis.current === 'x');

  const [open, setOpen] = useState(false);
  /** A swipe just happened; swallow the click it would otherwise fire. */
  const swiped = useRef(false);
  /** The press began on the header, so a tap on it means open/close. */
  const fromHead = useRef(false);
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
    li.dataset.swipe = x < 0 ? 'delete' : 'none';
    li.style.setProperty('--reveal', `${pill}px`);
    li.style.setProperty('--reveal-ms', animate ? '0.32s' : '0s');
    li.style.setProperty('--icon-op', pill >= ICON_AT ? '1' : '0');
  };

  const close = (notify = true) => {
    setOpen(false);
    slide(0, true);
    if (notify) onReveal(null);
  };

  useEffect(() => {
    if ((forceClosed || selectMode) && open) {
      setOpen(false);
      slide(0, true);
    }
  }, [forceClosed, selectMode, open]);

  // Start where the finger landed rather than selecting the lot.
  useEffect(() => {
    const input = nameInput.current;
    if (!renaming || !input) return;
    const at = caretAt.current ?? input.value.length;
    caretAt.current = null;
    input.setSelectionRange(at, at);
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
    base.current = open ? -REVEAL : 0;
    axis.current = 'none';
    moved.current = false;
    longFired.current = false;
    fromHead.current = !!(e.target as HTMLElement).closest?.('.memo__head');

    if (!selectMode && fromHead.current) {
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
            fg.current?.setPointerCapture(e.pointerId);
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
      const x = Math.min(0, base.current + dx); // opens leftward only
      rawX.current = x;
      const limit = REVEAL + 60;
      slide(Math.abs(x) > limit ? -(limit + (Math.abs(x) - limit) * 0.25) : x, false);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    clearLong();
    const didSwipe = axis.current === 'x';
    axis.current = 'none';
    // A drag that ends on a button must not also press it.
    if (didSwipe) swiped.current = true;

    if (!didSwipe) {
      if (longFired.current || moved.current || renaming) return;
      // Presses inside the open body belong to the controls there.
      if (!fromHead.current) return;
      if (selectMode) onToggleSelect(memo.id);
      else if (open) close();
      else onExpand(expanded ? null : memo.id);
      return;
    }

    const width = fg.current?.offsetWidth ?? 320;
    const x = rawX.current;

    if (x < -width * COMMIT) {
      slide(-width, true);
      window.setTimeout(() => onDelete(memo.id), 200);
    } else if (x < -REVEAL * 0.55) {
      setOpen(true);
      slide(-REVEAL, true);
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
    <li
      className={`memo${expanded ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`}
      ref={host}
      style={lift ? { transform: `translate3d(0,${lift}px,0)` } : undefined}
    >
      <button
        className="memo__action memo__action--delete"
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label={`Delete ${memo.name}`}
        onClick={() => onDelete(memo.id)}
      >
        <TrashIcon />
      </button>

      {/* The gesture lives on the whole row, not just its header, so an open
          memo can be swiped away from anywhere in it — including from on top of
          a transport button. The waveform keeps its own pointers, since a drag
          across it means scrubbing. */}
      <div
        className="memo__fg"
        ref={fg}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="memo__head" ref={head}>
          {/* The only thing that starts a reorder, so the rest of the row is
              still free to scroll, swipe and open. */}
          <span
            className="grip"
            aria-label="Reorder recording"
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              e.stopPropagation();
              gripPress.current = { y: e.clientY, id: e.pointerId, armed: true };
            }}
            onPointerMove={(e) => {
              const press = gripPress.current;
              if (!press.armed || press.id !== e.pointerId) return;
              // Only a real drag reorders; a still finger is still a tap.
              if (Math.abs(e.clientY - press.y) > 6) {
                press.armed = false;
                onGrip(index, press.y);
              }
            }}
            onPointerUp={(e) => {
              const press = gripPress.current;
              if (!press.armed || press.id !== e.pointerId) return;
              press.armed = false;
              onExpand(expanded ? null : memo.id);
            }}
          >
            <GripIcon />
          </span>

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
                  const el = e.currentTarget;
                  const x = e.clientX - el.getBoundingClientRect().left;
                  caretAt.current = caretIndexAtX(memo.name, fontOf(el), x);
                  setRenaming(true);
                }}
              >
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
                className="transport__btn transport__btn--edge transport__btn--danger"
                type="button"
                aria-label="Delete recording"
                onClick={() => onDelete(memo.id)}
              >
                <TrashIcon size={22} />
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
