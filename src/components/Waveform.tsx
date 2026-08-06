import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { downsample } from '../lib/audio';

/** Bars drawn across the width. Enough to read, few enough to stay cheap. */
const BARS = 88;
/** Movement before a press counts as a scrub rather than the start of a scroll. */
const SLOP = 8;

interface Props {
  peaks: number[];
  /** 0–1 through the recording. */
  progress: number;
  /** Called while dragging and on release, with a fraction of the duration. */
  onScrub?: (fraction: number) => void;
  onScrubEnd?: (fraction: number) => void;
}

/**
 * The recording drawn as bars, which is also how you scrub it.
 *
 * Played bars are lit and the rest are dim, so position is legible without a
 * separate progress track — the waveform is the scrubber, the way Voice Memos
 * does it. Dragging seeks continuously; there is no separate handle to catch.
 */
export default function Waveform({ peaks, progress, onScrub, onScrubEnd }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);

  const bars = useMemo(() => downsample(peaks, BARS), [peaks]);
  const played = Math.round(Math.max(0, Math.min(1, progress)) * BARS);

  const fractionAt = (clientX: number) => {
    const box = host.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  };

  /**
   * A press here does nothing on its own. Scrubbing only begins once the finger
   * has clearly moved sideways — otherwise a thumb that happens to land on the
   * waveform could not scroll the list past it, and every attempt to scroll
   * would jump the playhead instead.
   */
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!onScrub) return;
    start.current = { x: e.clientX, y: e.clientY };
    pid.current = e.pointerId;
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!onScrub || pid.current !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!dragging) {
      if (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) moved.current = true;
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
        pid.current = null; // vertical — hand it back to the list
        return;
      }
      if (Math.abs(dx) <= SLOP) return;
      setDragging(true);
      e.stopPropagation(); // now it's ours, not the row's swipe
      try {
        host.current?.setPointerCapture(e.pointerId);
      } catch {
        /* nothing to capture */
      }
    }

    e.preventDefault();
    onScrub(fractionAt(e.clientX));
  };

  const end = (e: ReactPointerEvent) => {
    const wasDragging = dragging;
    // A tap is a press that never travelled. A drag that bowed out vertically
    // belongs to the list's scroll and must not seek on the way up.
    const wasTap = !wasDragging && !moved.current && pid.current === e.pointerId;
    pid.current = null;
    moved.current = false;

    if (wasTap) {
      onScrub?.(fractionAt(e.clientX));
      return;
    }
    if (!wasDragging) return;
    setDragging(false);
    onScrubEnd?.(fractionAt(e.clientX));
  };

  return (
    <div
      ref={host}
      className={`wave${dragging ? ' is-scrubbing' : ''}`}
      role="slider"
      aria-label="Scrub"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {bars.map((peak, i) => (
        <span
          key={i}
          className={`wave__bar${i < played ? ' is-played' : ''}`}
          // A floor so silence still reads as a recording rather than a gap.
          style={{ height: `${Math.max(8, peak * 100)}%` }}
        />
      ))}
    </div>
  );
}
