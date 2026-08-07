import type { ChordShape } from '../types';

/** How far up the neck you can reach. Roughly eight are on screen at once. */
const FRETS = 15;
const STRINGS = 6;
/** Frets that carry an inlay; 12 gets a pair. */
const INLAYS = new Set([3, 5, 7, 9, 15]);

interface Props {
  shape: ChordShape;
  onChange: (shape: ChordShape) => void;
}

/**
 * The neck stood on end: nut at the top, strings running down it, low E on the
 * left as if the guitar were facing you.
 *
 * Tap a position to stop that string there, tap it again to let it ring open.
 * Tapping a string where it meets the nut mutes it instead. A string can only
 * be held at one place at a time, so choosing a new fret replaces the old one
 * rather than adding to it.
 */
export default function Fretboard({ shape, onChange }: Props) {
  const { frets } = shape;

  const press = (string: number, fret: number) => {
    const next = [...frets];
    // Tapping the fret already held releases the string.
    next[string] = next[string] === fret ? 0 : fret;
    onChange({ ...shape, frets: next, baseFret: 1 });
  };

  const toggleMute = (string: number) => {
    const next = [...frets];
    next[string] = next[string] === -1 ? 0 : -1;
    onChange({ ...shape, frets: next, baseFret: 1 });
  };

  return (
    <div className="fb">
      {/* Above the nut: open or muted, and the control that switches them. */}
      <div className="fb__head">
        <span className="fb__gutter" aria-hidden="true" />
        {Array.from({ length: STRINGS }, (_, s) => {
          const muted = frets[s] === -1;
          const open = frets[s] === 0;
          return (
            <button
              key={s}
              className={`fb__open${muted ? ' is-muted' : ''}`}
              type="button"
              aria-label={`${muted ? 'Unmute' : 'Mute'} string ${STRINGS - s}`}
              aria-pressed={muted}
              onClick={() => toggleMute(s)}
            >
              {muted ? '✕' : open ? '○' : ''}
            </button>
          );
        })}
      </div>

      <div className="fb__nut" aria-hidden="true" />

      <div className="fb__neck">
        {Array.from({ length: FRETS }, (_, i) => {
          const fret = i + 1;
          return (
            <div className="fb__row" key={fret}>
              <span className="fb__gutter">{fret}</span>

              {Array.from({ length: STRINGS }, (_, s) => {
                const muted = frets[s] === -1;
                const held = frets[s] === fret;
                return (
                  <button
                    key={s}
                    className={`fb__cell${muted ? ' is-muted' : ''}`}
                    type="button"
                    aria-label={`String ${STRINGS - s}, fret ${fret}`}
                    aria-pressed={held}
                    onClick={() => press(s, fret)}
                  >
                    {/* The string itself, thicker toward the bass side. */}
                    <span className="fb__string" style={{ width: `${3.2 - s * 0.38}px` }} />
                    {fret === 12 ? (
                      <>
                        {s === 1 && <span className="fb__inlay" />}
                        {s === 4 && <span className="fb__inlay" />}
                      </>
                    ) : (
                      INLAYS.has(fret) && s === 2 && <span className="fb__inlay fb__inlay--mid" />
                    )}
                    {held && <span className="fb__dot" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
