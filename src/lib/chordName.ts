/**
 * Naming a shape by what it sounds, which is the whole point of a reverse
 * finder: you find the grip first and want to know what you just played.
 */

/** Standard tuning, low to high, as MIDI numbers. */
export const TUNING = [40, 45, 50, 55, 59, 64];

/**
 * Spellings guitarists actually use — flats where the sharp name would look
 * wrong on a chart (Bb, not A#).
 */
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Chord qualities, in the order they should win ties: the plainer reading of an
 * ambiguous set of notes is nearly always the one meant.
 */
const FORMULAS: Array<[string, number[]]> = [
  ['', [0, 4, 7]],
  ['m', [0, 3, 7]],
  ['5', [0, 7]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['m7', [0, 3, 7, 10]],
  ['sus4', [0, 5, 7]],
  ['sus2', [0, 2, 7]],
  ['6', [0, 4, 7, 9]],
  ['m6', [0, 3, 7, 9]],
  ['dim', [0, 3, 6]],
  ['m7b5', [0, 3, 6, 10]],
  ['dim7', [0, 3, 6, 9]],
  ['aug', [0, 4, 8]],
  ['add9', [0, 2, 4, 7]],
  ['9', [0, 2, 4, 7, 10]],
  ['maj9', [0, 2, 4, 7, 11]],
  ['m9', [0, 2, 3, 7, 10]],
];

export const noteName = (pitchClass: number): string => NAMES[((pitchClass % 12) + 12) % 12];

/** Sounding MIDI notes for a shape; muted strings (-1) drop out. */
export function soundingNotes(frets: number[]): number[] {
  return frets
    .map((fret, string) => (fret < 0 ? null : TUNING[string] + fret))
    .filter((n): n is number => n !== null);
}

export interface Detected {
  /** What to call it, e.g. "Am7" or "C/G". Null only when nothing is sounding. */
  name: string | null;
  /** True when every note fits the quality exactly, with none left over. */
  exact: boolean;
}

/**
 * Works out what a shape is called.
 *
 * There is always an answer as long as something is sounding: every root is
 * tried against every quality and the closest fit wins, rather than holding out
 * for a perfect match and giving up. That matters for a reverse finder, where
 * half of what gets played is a grip someone found rather than a textbook
 * voicing — being told the nearest chord is far more use than being told
 * nothing.
 *
 * The costs below are what make the answer musical rather than merely
 * arithmetic: a note that doesn't belong to the chord at all is the worst thing
 * that can happen, missing the root is nearly as bad, and a missing fifth
 * hardly counts — guitarists drop fifths constantly.
 *
 * This only decides what the shape is *called*. The frets the user chose are
 * kept exactly as played.
 */
export function detectChord(frets: number[]): Detected {
  const midi = soundingNotes(frets);
  if (midi.length === 0) return { name: null, exact: false };

  const bass = Math.min(...midi) % 12;
  const pcs = [...new Set(midi.map((n) => n % 12))].sort((a, b) => a - b);

  if (pcs.length === 1) return { name: noteName(pcs[0]), exact: true };

  // Seeded rather than left null: there is always a closest fit, so the loop
  // below can only improve on this.
  let best = { score: Infinity, root: 0, suffix: '', exact: false };

  for (let root = 0; root < 12; root++) {
    FORMULAS.forEach(([suffix, intervals], rank) => {
      const tones = intervals.map((iv) => (root + iv) % 12);
      const set = new Set(tones);

      // Notes being played that this chord has no place for.
      const extra = pcs.filter((pc) => !set.has(pc)).length;

      // Chord tones that aren't being played, weighted by how much they matter.
      const missing = tones
        .filter((t) => !pcs.includes(t))
        .reduce((sum, tone) => {
          const interval = (tone - root + 12) % 12;
          if (interval === 7) return sum + 0.4; // fifth: barely missed
          if (interval === 0) return sum + 3; // root: badly missed
          return sum + 1.6; // third, seventh, colour
        }, 0);

      const score =
        extra * 3 +
        missing +
        rank * 0.02 + // ties go to the plainer quality
        (root === bass ? 0 : 0.8); // and to the chord sat on its own root

      if (score < best.score) {
        best = { score, root, suffix, exact: extra === 0 && missing === 0 };
      }
    });
  }

  const { root, suffix, exact } = best;
  const slash = root !== bass ? `/${noteName(bass)}` : '';
  return { name: `${noteName(root)}${suffix}${slash}`, exact };
}
