import type { ChordShape } from '../types';

/** The whole neck. */
const FRETS = 24;
const STRINGS = 6;
/** Frets carrying a single inlay; the octaves get a pair. */
const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const DOUBLE_INLAYS = new Set([12, 24]);
/** Standard tuning, low to high. The top E is written small, as it is on paper. */
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

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
 *
 * The nut and the open/muted marks stay pinned to the top as the neck scrolls
 * under them — up at the twelfth fret you still need to see which strings are
 * ringing and which are silenced.
 */
export default function Fretboard({ shape, onChange }: Props) {
  const { frets } = shape;

  const press = (string: number, fret: number) => {
    const next = [...frets];
    // Tapping the fret already held releases the string.
    next[string] = next[string] === fret ? 0 : fret;
    onChange({ ...shape, frets: next, baseFret: 1 });
  };

  /**
   * The control above the nut, which is the whole column — letter and mark
   * together.
   *
   * It lifts a finger before it mutes: with something held on that string the
   * first tap releases it, and only a string already ringing open goes on to be
   * muted. Muting straight from a fretted note would throw away the position
   * and silence the string in one go, which is never what a single tap means.
   */
  const nutTap = (string: number) => {
    const next = [...frets];
    next[string] = next[string] > 0 ? 0 : next[string] === -1 ? 0 : -1;
    onChange({ ...shape, frets: next, baseFret: 1 });
  };

  return (
    <div className="fb">
      <div className="fb__sticky">
        {/* Letter and mark are one target per string, so either can be hit. */}
        <div className="fb__board fb__head">
          {Array.from({ length: STRINGS }, (_, s) => {
            const muted = frets[s] === -1;
            const held = frets[s] > 0;
            return (
              <button
                key={s}
                className={`fb__open${muted ? ' is-muted' : ''}`}
                type="button"
                aria-label={
                  held
                    ? `Clear string ${STRINGS - s}`
                    : `${muted ? 'Unmute' : 'Mute'} string ${STRINGS - s}`
                }
                aria-pressed={muted}
                onClick={() => nutTap(s)}
              >
                <span className="fb__label">{STRING_NAMES[s]}</span>
                <span className="fb__mark">{muted ? '✕' : held ? '' : '○'}</span>
              </button>
            );
          })}
        </div>
        <div className="fb__board fb__nut" aria-hidden="true" />
      </div>

      <div className="fb__neck">
        {Array.from({ length: FRETS }, (_, i) => {
          const fret = i + 1;
          const double = DOUBLE_INLAYS.has(fret);
          return (
            <div className="fb__row" key={fret}>
              {/* Sits in the margin beside the board, so the strings stay
                  centred on the screen whatever width the numbers need. */}
              <span className="fb__gutter">{fret}</span>

              <div className="fb__board fb__cells">
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
                      <span
                        className="fb__string"
                        style={{ width: `${3.2 - s * 0.38}px` }}
                      />
                      {double && (s === 1 || s === 4) && <span className="fb__inlay" />}
                      {!double && INLAYS.has(fret) && s === 2 && (
                        <span className="fb__inlay fb__inlay--mid" />
                      )}
                      {held && <span className="fb__dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
