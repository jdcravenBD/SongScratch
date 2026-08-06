import { useEffect, useRef } from 'react';
import type { VoiceMemos } from '../hooks/useVoiceMemos';
import { formatDuration } from '../lib/audio';
import MemoRow from './MemoRow';

/** Bars in the live meter — a moving window of the last few seconds. */
const LIVE_BARS = 46;

/**
 * The list of a song's recordings. The record control is a separate export:
 * it belongs in the editor's bottom bar, not in the scrolling list.
 */
export function VoiceList({ voice }: { voice: VoiceMemos }) {
  const { memos, recorder } = voice;

  if (recorder.error) {
    return (
      <div className="empty">
        <p className="empty__title">Can’t Record</p>
        <p className="empty__hint">{recorder.error}</p>
      </div>
    );
  }

  if (memos.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No Recordings</p>
        <p className="empty__hint">
          {recorder.supported
            ? 'Tap the record button to capture an idea.'
            : 'Recording needs a secure connection (https).'}
        </p>
      </div>
    );
  }

  return (
    <ul className="memos">
      {memos.map((memo) => (
        <MemoRow
          key={memo.id}
          memo={memo}
          expanded={voice.expandedId === memo.id}
          busy={recorder.recording}
          forceClosed={voice.revealedId !== null && voice.revealedId !== memo.id}
          onExpand={voice.setExpandedId}
          onDelete={(id) => void voice.remove(id)}
          onRename={(id, name) => void voice.rename(id, name)}
          onResume={voice.startResume}
          onReveal={voice.setRevealedId}
        />
      ))}
    </ul>
  );
}

/**
 * The record button, and while recording, the elapsed time and a live meter.
 * Sits in the editor's bottom bar above the tabs.
 */
export function VoiceDock({ voice }: { voice: VoiceMemos }) {
  const { recorder } = voice;
  const target = voice.memos.find((m) => m.id === voice.appendingTo);

  return (
    <div className="rec">
      {recorder.recording ? (
        <RecordingMeter peaksRef={recorder.peaksRef} startedAtRef={recorder.startedAtRef} />
      ) : (
        <p className="rec__hint">
          {recorder.supported ? 'Record' : 'Recording needs https'}
        </p>
      )}

      {recorder.recording && target && (
        <p className="rec__target">Adding to “{target.name}”</p>
      )}

      <button
        className={`rec__btn${recorder.recording ? ' is-recording' : ''}`}
        type="button"
        disabled={!recorder.supported}
        aria-label={recorder.recording ? 'Stop recording' : 'Start recording'}
        onClick={() => (recorder.recording ? void voice.finish() : voice.startNew())}
      >
        <span className="rec__glyph" />
      </button>
    </div>
  );
}

/**
 * Elapsed time and input level while recording.
 *
 * Driven straight from the recorder's refs on an animation frame — putting a
 * 20-per-second level into React state would re-render the whole list behind
 * it for the sake of a few bars.
 */
function RecordingMeter({
  peaksRef,
  startedAtRef,
}: {
  peaksRef: React.RefObject<number[]>;
  startedAtRef: React.RefObject<number>;
}) {
  const timeRef = useRef<HTMLParagraphElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const bars = Array.from(barsRef.current?.children ?? []) as HTMLElement[];

    const tick = () => {
      const elapsed = (performance.now() - (startedAtRef.current ?? 0)) / 1000;
      if (timeRef.current) timeRef.current.textContent = formatDuration(elapsed);

      const peaks = peaksRef.current ?? [];
      const window = peaks.slice(-LIVE_BARS);
      for (let i = 0; i < bars.length; i++) {
        // Newest on the right, so the trace runs the way it was recorded.
        const peak = window[i - (LIVE_BARS - window.length)] ?? 0;
        bars[i].style.height = `${Math.max(6, peak * 100)}%`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [peaksRef, startedAtRef]);

  return (
    <>
      <div className="rec__meter" ref={barsRef} aria-hidden="true">
        {Array.from({ length: LIVE_BARS }, (_, i) => (
          <span key={i} className="rec__bar" />
        ))}
      </div>
      <p className="rec__time" ref={timeRef}>
        0:00
      </p>
    </>
  );
}
