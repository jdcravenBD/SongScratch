import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Memo } from '../types';
import { allPeaks, formatDuration, totalDuration } from '../lib/audio';
import { usePlayer } from '../hooks/usePlayer';
import Waveform from './Waveform';
import {
  Back10Icon,
  Forward10Icon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
} from './icons';

const REVEAL = 78;
const SLOP = 8;
const COMMIT = 0.42;
const PILL_GAP = 14;
const ICON_AT = 40;

interface Props {
  memo: Memo;
  expanded: boolean;
  /** True while a recording is in progress anywhere on the screen. */
  busy: boolean;
  forceClosed: boolean;
  onExpand: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onResume: (id: string) => void;
  onReveal: (id: string | null) => void;
}

/**
 * One recording: its name and length, opening to a waveform you can scrub and
 * a transport. Only the header takes the swipe, so dragging across the
 * waveform scrubs instead of sliding the row away.
 */
export default function MemoRow({
  memo,
  expanded,
  busy,
  forceClosed,
  onExpand,
  onDelete,
  onRename,
  onResume,
  onReveal,
}: Props) {
  const host = useRef<HTMLLIElement>(null);
  const fg = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const rawX = useRef(0);
  const base = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const pid = useRef<number | null>(null);
  const moved = useRef(false);

  const [open, setOpen] = useState(false);
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
    if (forceClosed && open) {
      setOpen(false);
      slide(0, true);
    }
  }, [forceClosed, open]);

  useEffect(() => {
    if (renaming) nameInput.current?.select();
  }, [renaming]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pid.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    base.current = open ? -REVEAL : 0;
    axis.current = 'none';
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (axis.current === 'none') {
      if (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) {
        moved.current = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          axis.current = 'x';
          try {
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
      const x = Math.min(0, base.current + dx); // this row only opens leftward
      rawX.current = x;
      const limit = REVEAL + 60;
      slide(Math.abs(x) > limit ? -(limit + (Math.abs(x) - limit) * 0.25) : x, false);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    const swiped = axis.current === 'x';
    axis.current = 'none';

    if (!swiped) {
      if (moved.current || renaming) return;
      if (open) close();
      else onExpand(expanded ? null : memo.id);
      return;
    }

    const width = fg.current?.offsetWidth ?? 320;
    if (rawX.current < -width * COMMIT) {
      slide(-width, true);
      window.setTimeout(() => onDelete(memo.id), 200);
    } else if (rawX.current < -REVEAL * 0.55) {
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
    <li className={`memo${expanded ? ' is-open' : ''}`} ref={host}>
      <button
        className="memo__delete"
        type="button"
        aria-label={`Delete ${memo.name}`}
        onClick={() => onDelete(memo.id)}
      >
        <TrashIcon />
      </button>

      <div className="memo__fg" ref={fg}>
        <div
          className="memo__head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {renaming ? (
            <input
              ref={nameInput}
              className="memo__rename"
              defaultValue={memo.name}
              onBlur={commitRename}
              onKeyDown={onNameKey}
              aria-label="Recording name"
            />
          ) : (
            <span
              className="memo__name"
              onDoubleClick={() => expanded && setRenaming(true)}
            >
              {memo.name}
            </span>
          )}
          <span className="memo__meta">{formatDuration(duration)}</span>
        </div>

        {expanded && (
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

            <div className="memo__actions">
              <button
                className="linkbtn"
                type="button"
                disabled={busy}
                onClick={() => onResume(memo.id)}
              >
                <MicIcon size={15} />
                <span>Add to Recording</span>
              </button>
              <button className="linkbtn" type="button" onClick={() => setRenaming(true)}>
                Rename
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
