import type { Memo, Segment } from '../types';

/**
 * The container to record in. Safari gives you mp4, Chromium webm, and neither
 * accepts the other's preference — so ask rather than assume.
 */
export function pickMimeType(): string {
  const candidates = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

/** Is recording possible at all here? See [[secure-context-apis]]. */
export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

export const totalDuration = (memo: Memo): number =>
  memo.segments.reduce((sum, s) => sum + s.duration, 0);

/** Seconds of audio before segment `i` starts. */
export function offsetOf(segments: Segment[], i: number): number {
  let out = 0;
  for (let n = 0; n < i && n < segments.length; n++) out += segments[n].duration;
  return out;
}

/** Which segment a global time lands in, and how far into it. */
export function locate(
  segments: Segment[],
  time: number,
): { index: number; offset: number } {
  let remaining = Math.max(0, time);
  for (let i = 0; i < segments.length; i++) {
    if (remaining < segments[i].duration || i === segments.length - 1) {
      return { index: i, offset: Math.min(remaining, segments[i].duration) };
    }
    remaining -= segments[i].duration;
  }
  return { index: 0, offset: 0 };
}

/** Every segment's peaks, end to end, as one waveform. */
export const allPeaks = (memo: Memo): number[] =>
  memo.segments.flatMap((s) => s.peaks);

/**
 * Squash a peak list down to `count` bars by taking the loudest sample in each
 * bucket — averaging would flatten transients into mush, and it's the peaks
 * that make a waveform readable.
 */
export function downsample(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return new Array(count).fill(0);
  if (peaks.length <= count) {
    // Stretch a short recording across the full width rather than leaving a
    // stub of bars hanging at the left.
    return Array.from(
      { length: count },
      (_, i) => peaks[Math.floor((i / count) * peaks.length)] ?? 0,
    );
  }
  const out: number[] = [];
  const size = peaks.length / count;
  for (let i = 0; i < count; i++) {
    let max = 0;
    for (let n = Math.floor(i * size); n < Math.floor((i + 1) * size); n++) {
      if (peaks[n] > max) max = peaks[n];
    }
    out.push(max);
  }
  return out;
}

/** m:ss, or h:mm:ss once it runs past an hour. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
