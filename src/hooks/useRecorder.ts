import { useCallback, useEffect, useRef, useState } from 'react';
import type { Segment } from '../types';
import { canRecord, pickMimeType } from '../lib/audio';

/** Loudness samples per second kept for the waveform. */
const PEAKS_PER_SEC = 20;

export interface Recorder {
  supported: boolean;
  recording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Segment | null>;
  /** Live peaks and start time, read by the meter through refs so that drawing
   *  them never re-renders the list behind it. */
  peaksRef: React.RefObject<number[]>;
  startedAtRef: React.RefObject<number>;
}

/**
 * Microphone capture.
 *
 * Two things are measured while recording rather than read back afterwards:
 *
 * - **Duration.** MediaRecorder's own containers routinely report a duration of
 *   Infinity until they have been fully seeked, because the header is written
 *   before the length is known. Timing the take is simply reliable.
 * - **The waveform.** Sampling loudness as it arrives costs nothing; decoding
 *   the finished file later to draw the same picture would mean holding whole
 *   recordings in memory on a phone.
 */
export function useRecorder(): Recorder {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplerRef = useRef(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const peaksRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const mimeRef = useRef('');

  /** Drop the microphone the moment it stops being needed. */
  const teardown = useCallback(() => {
    window.clearInterval(samplerRef.current);
    samplerRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    if (!canRecord()) {
      setError('Recording needs a secure connection (https).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Analyser purely for the waveform; it never touches what is recorded.
      const context = new AudioContext();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const mimeType = pickMimeType();
      mimeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      chunksRef.current = [];
      peaksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const buffer = new Uint8Array(analyser.fftSize);
      samplerRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(buffer);
        // RMS around the 128 midpoint, scaled so speech sits high in the bar.
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        peaksRef.current.push(Math.min(1, rms * 2.2));
      }, 1000 / PEAKS_PER_SEC);

      startedAtRef.current = performance.now();
      recorder.start();
      setRecording(true);
    } catch (e) {
      teardown();
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access was denied.'
          : name === 'NotFoundError'
            ? 'No microphone was found.'
            : 'Could not start recording.',
      );
    }
  }, [teardown]);

  const stop = useCallback(async (): Promise<Segment | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      teardown();
      setRecording(false);
      return null;
    }

    const duration = (performance.now() - startedAtRef.current) / 1000;
    const peaks = peaksRef.current.slice();

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' }));
      recorder.stop();
    });

    teardown();
    setRecording(false);
    // A tap that starts and ends in the same instant isn't a recording.
    if (duration < 0.35 || blob.size === 0) return null;
    return { blob, duration, peaks };
  }, [teardown]);

  return {
    supported: canRecord(),
    recording,
    error,
    start,
    stop,
    peaksRef,
    startedAtRef,
  };
}
