import { useCallback, useEffect, useRef, useState } from 'react';
import type { Memo } from '../types';
import { locate, offsetOf, totalDuration } from '../lib/audio';

export interface Player {
  playing: boolean;
  /** Seconds into the memo as a whole, not into the current take. */
  time: number;
  duration: number;
  toggle: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
}

/**
 * Plays a memo as one continuous recording.
 *
 * The memo is really several takes (see Segment), so this keeps one audio
 * element and moves it between them, translating between "seconds into this
 * take" and "seconds into the memo" at every boundary. Nothing above this hook
 * needs to know a memo was recorded in more than one sitting.
 */
export function usePlayer(memo: Memo | null): Player {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const segRef = useRef(0);
  const rafRef = useRef(0);
  /** Bumped on every load so a slow one can't finish over a newer one. */
  const tokenRef = useRef(0);

  const segments = memo?.segments ?? [];
  const duration = memo ? totalDuration(memo) : 0;

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';
  }

  // One object URL per take, rebuilt whenever the memo changes.
  useEffect(() => {
    urlsRef.current.forEach(URL.revokeObjectURL);
    urlsRef.current = segments.map((s) => URL.createObjectURL(s.blob));
    segRef.current = 0;
    setTime(0);
    setPlaying(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
    return () => {
      urlsRef.current.forEach(URL.revokeObjectURL);
      urlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo]);

  /** Point the element at a take and place the head inside it. */
  const load = useCallback(async (index: number, offset: number, play: boolean) => {
    const audio = audioRef.current;
    const url = urlsRef.current[index];
    if (!audio || !url) return;

    const token = ++tokenRef.current;
    if (segRef.current !== index || !audio.src.endsWith(url.split('/').pop() ?? '')) {
      audio.src = url;
      await new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener('loadedmetadata', done);
          resolve();
        };
        audio.addEventListener('loadedmetadata', done);
        audio.load();
      });
      if (token !== tokenRef.current) return; // superseded
    }
    segRef.current = index;
    try {
      audio.currentTime = offset;
    } catch {
      /* some containers refuse a seek until they are further loaded */
    }
    if (play) await audio.play().catch(() => setPlaying(false));
  }, []);

  // While playing, report the head position from the element itself.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setTime(offsetOf(segments, segRef.current) + audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, segments]);

  // Roll straight into the next take, or stop at the end.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const next = segRef.current + 1;
      if (next < segments.length) {
        void load(next, 0, true);
      } else {
        setPlaying(false);
        setTime(duration);
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [segments, duration, load]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const seek = useCallback(
    (to: number) => {
      if (!segments.length) return;
      const clamped = Math.max(0, Math.min(duration, to));
      const { index, offset } = locate(segments, clamped);
      setTime(clamped);
      void load(index, offset, playing);
    },
    [segments, duration, playing, load],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !segments.length) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    // Starting again from the end plays it back from the top.
    const from = time >= duration - 0.05 ? 0 : time;
    const { index, offset } = locate(segments, from);
    setPlaying(true);
    void load(index, offset, true);
  }, [playing, segments, time, duration, load]);

  const skip = useCallback((delta: number) => seek(time + delta), [seek, time]);

  return { playing, time, duration, toggle, seek, skip };
}
