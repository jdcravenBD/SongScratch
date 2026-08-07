import type { ChordShape } from '../types';

/** Frets drawn in the grid. Four spans is what a hand covers. */
const FRETS = 4;
const STRINGS = 6;

/* Geometry, in the SVG's own units. */
const W = 74;
/*
 * Equal on both sides. The fret number lives in the left margin, but the margin
 * is matched on the right so the grid stays centred in the box — otherwise the
 * name underneath, which centres on the box, sits off to one side of the
 * strings it belongs to.
 */
const PAD_L = 15;
const PAD_R = 15;
const TOP = 16; // room above the nut for the open/muted marks
const BOT = 6;
const H = 92;

/**
 * A chord as a fretboard grid: strings vertical low-to-high, frets horizontal,
 * a dot per stopped string and o / x above the nut for the rest.
 *
 * The window is worked out from the shape itself rather than trusted from the
 * record. A grip up at the ninth fret has nothing in the first four, so a
 * diagram pinned to the nut would draw an empty grid — it starts at the lowest
 * stopped fret instead, and says which one that is.
 */
export default function ChordDiagram({ shape }: { shape: ChordShape }) {
  const { frets } = shape;

  const stopped = frets.filter((f) => f > 0);
  const lowest = stopped.length ? Math.min(...stopped) : 1;
  const highest = stopped.length ? Math.max(...stopped) : 1;
  // Stay at the nut while the shape fits there; otherwise slide up to it.
  const base = highest <= FRETS ? 1 : lowest;
  const atNut = base === 1;

  const gridW = W - PAD_L - PAD_R;
  const gridH = H - TOP - BOT;
  const stringGap = gridW / (STRINGS - 1);
  const fretGap = gridH / FRETS;

  const x = (s: number) => PAD_L + s * stringGap;
  const y = (f: number) => TOP + f * fretGap;

  return (
    <svg
      className="diagram"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Chord fingering"
    >
      {/* Nut: solid only when the shape really is at the top of the neck. */}
      <line
        x1={PAD_L}
        y1={TOP}
        x2={W - PAD_R}
        y2={TOP}
        stroke="currentColor"
        strokeWidth={atNut ? 3 : 1}
        strokeLinecap="round"
        opacity={atNut ? 0.9 : 0.35}
      />

      {Array.from({ length: FRETS }, (_, i) => (
        <line
          key={`f${i}`}
          x1={PAD_L}
          y1={y(i + 1)}
          x2={W - PAD_R}
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

      {/* Where the window starts. Always shown, so a shape is never ambiguous
          about how far up the neck it belongs. */}
      <text
        className="diagram__base"
        x={PAD_L - 5}
        y={y(0.62)}
        fontSize={9.5}
        textAnchor="end"
      >
        {base}
      </text>

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
        // Placed against the window, not the neck, and dropped if it falls
        // outside — which can only happen on a spread wider than a hand.
        const row = fret - base + 1;
        if (row < 1 || row > FRETS) return null;
        return (
          <circle key={s} cx={x(s)} cy={y(row - 0.5)} r={4.2} fill="currentColor" />
        );
      })}
    </svg>
  );
}
