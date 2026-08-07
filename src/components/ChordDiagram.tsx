import type { ChordShape } from '../types';

/** Frets drawn in the grid. Four spans is what a hand covers. */
const FRETS = 4;
const STRINGS = 6;

/* Geometry, in the SVG's own units. */
const W = 62;
const PAD_X = 8;
const TOP = 16; // room above the nut for the open/muted marks
const BOT = 6;
const H = 92;

/**
 * A chord as a fretboard grid: strings vertical low-to-high, frets horizontal,
 * a dot per stopped string and o / x above the nut for the rest.
 *
 * Drawn from the stored shape rather than looked up from the name, so a voicing
 * with no agreed name still shows something — which matters for a scratchpad,
 * where half of what gets written down is a shape someone found rather than a
 * chord they could name.
 */
export default function ChordDiagram({ shape }: { shape: ChordShape }) {
  const { frets, baseFret } = shape;
  const gridW = W - PAD_X * 2;
  const gridH = H - TOP - BOT;
  const stringGap = gridW / (STRINGS - 1);
  const fretGap = gridH / FRETS;
  const open = baseFret <= 1;

  const x = (s: number) => PAD_X + s * stringGap;
  const y = (f: number) => TOP + f * fretGap;

  return (
    <svg
      className="diagram"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Chord fingering"
    >
      {/* Nut: solid when the shape sits at the top of the neck. */}
      <line
        x1={PAD_X}
        y1={TOP}
        x2={W - PAD_X}
        y2={TOP}
        stroke="currentColor"
        strokeWidth={open ? 3 : 1}
        strokeLinecap="round"
        opacity={open ? 0.9 : 0.35}
      />

      {Array.from({ length: FRETS }, (_, i) => (
        <line
          key={`f${i}`}
          x1={PAD_X}
          y1={y(i + 1)}
          x2={W - PAD_X}
          y2={y(i + 1)}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.35}
        />
      ))}

      {Array.from({ length: STRINGS }, (_, s) => (
        <line
          key={`s${s}`}
          x1={x(s)}
          y1={TOP}
          x2={x(s)}
          y2={y(FRETS)}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.35}
        />
      ))}

      {/* Where the shape starts, when it isn't at the nut. */}
      {!open && (
        <text className="diagram__base" x={2} y={y(0.8)} fontSize={9}>
          {baseFret}
        </text>
      )}

      {frets.map((fret, s) => {
        if (fret < 0) {
          const cx = x(s);
          return (
            <g key={s} stroke="currentColor" strokeWidth={1.4} opacity={0.55}>
              <line x1={cx - 3} y1={TOP - 11} x2={cx + 3} y2={TOP - 5} />
              <line x1={cx + 3} y1={TOP - 11} x2={cx - 3} y2={TOP - 5} />
            </g>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={s}
              cx={x(s)}
              cy={TOP - 8}
              r={3}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
              opacity={0.55}
            />
          );
        }
        // Dots sit between fret lines, not on them.
        return (
          <circle key={s} cx={x(s)} cy={y(fret - 0.5)} r={4.2} fill="currentColor" />
        );
      })}
    </svg>
  );
}
