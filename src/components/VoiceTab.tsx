import { useCallback, useEffect, useRef } from 'react';
import type { VoiceMemos } from '../hooks/useVoiceMemos';
import { useReorder } from '../hooks/useReorder';
import { formatDuration } from '../lib/audio';
import MemoRow from './MemoRow';
import { TrashIcon } from './icons';

/** Bars in the live meter — a moving window of the last few seconds. */
const LIVE_BARS = 46;

/**
 * The list of a song's recordings. The record control is a separate export:
 * it belongs in the editor's bottom bar, not in the scrolling list.
 */
export function VoiceList({ voice }: { voice: VoiceMemos }) {
  const { memos, recorder } = voice;
  const count = memos.length;

  const commit = useCallback(
    (from: number, to: number) => void voice.reorder(from, to),
    [voice],
  );
  const prepare = useCallback(() => {
    voice.setExpandedId(null);
    voice.setRevealedId(null);
  }, [voice]);
  const { listRef, begin, dragIndex, dy, liftFor } = useReorder(commit, prepare);

  return (
    <>
      <div className="hero">
        <h1 className="hero__title">
          {voice.selectMode
            ? voice.selected.size
              ? `${voice.selected.size} Selected`
              : 'Select Memos'
            : 'Recordings'}
        </h1>
        <p className="hero__count">
          {count} {count === 1 ? 'Memo' : 'Memos'}
        </p>
      </div>

      {/* A recording that failed must not take the existing ones off screen
          with it, so this sits above the list rather than replacing it. */}
      {recorder.error && <p className="notice">{recorder.error}</p>}

      {count === 0 ? (
        <div className="empty">
          <p className="empty__title">No Recordings</p>
          <p className="empty__hint">
            {recorder.supported
              ? 'Tap the record button to capture an idea.'
              : 'Recording needs a secure connection (https).'}
          </p>
        </div>
      ) : (
        <ul className="memos" ref={listRef}>
          {memos.map((memo, i) => (
            <MemoRow
              key={memo.id}
              memo={memo}
              index={i}
              lift={i === dragIndex ? dy : liftFor(i)}
              dragging={i === dragIndex}
              expanded={voice.expandedId === memo.id}
              busy={recorder.recording}
              selectMode={voice.selectMode}
              selected={voice.selected.has(memo.id)}
              forceClosed={voice.revealedId !== null && voice.revealedId !== memo.id}
              onExpand={voice.setExpandedId}
              onDelete={(id) => void voice.remove(id)}
              onRename={(id, name) => void voice.rename(id, name)}
              onResume={voice.startResume}
              onLongPress={voice.enterSelect}
              onToggleSelect={voice.toggleSelect}
              onReveal={voice.setRevealedId}
              onGrip={begin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The record button, and while recording, the elapsed time and a live meter.
 * Sits in the editor's bottom bar above the tabs — or gives way to the
 * selection actions while several memos are picked.
 */
export function VoiceDock({ voice }: { voice: VoiceMemos }) {
  const { recorder } = voice;
  const target = voice.memos.find((m) => m.id === voice.appendingTo);

  if (voice.selectMode) {
    const ids = [...voice.selected];
    const n = ids.length;
    return (
      <div className="rec rec--select">
        <div className="toolbar">
          <button
            className="tool tool--danger"
            type="button"
            disabled={!n}
            onClick={async () => {
              await voice.removeMany(ids);
              voice.exitSelect();
            }}
          >
            <TrashIcon />
            <span>Delete</span>
          </button>
          <button className="tool" type="button" onClick={voice.exitSelect}>
            <span className="tool__done">Done</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rec">
      {recorder.recording ? (
        <RecordingMeter peaksRef={recorder.peaksRef} startedAtRef={recorder.startedAtRef} />
      ) : (
        !recorder.supported && <p className="rec__hint">Recording needs https</p>
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
