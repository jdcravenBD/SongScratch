import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { downsample } from '../lib/audio';

/** Bars drawn across the width. Enough to read, few enough to stay cheap. */
const BARS = 88;

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
  const [dragging, setDragging] = useState(false);

  const bars = useMemo(() => downsample(peaks, BARS), [peaks]);
  const played = Math.round(Math.max(0, Math.min(1, progress)) * BARS);

  const fractionAt = (clientX: number) => {
    const box = host.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!onScrub) return;
    e.stopPropagation(); // don't let the row treat this as a swipe
    setDragging(true);
    // Seek first: capturing can throw if the pointer is already gone, and the
    // seek is the part that must not be lost to it.
    onScrub(fractionAt(e.clientX));
    try {
      host.current?.setPointerCapture(e.pointerId);
    } catch {
      /* nothing to capture */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging || !onScrub) return;
    e.preventDefault();
    onScrub(fractionAt(e.clientX));
  };

  const end = (e: ReactPointerEvent) => {
    if (!dragging) return;
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
