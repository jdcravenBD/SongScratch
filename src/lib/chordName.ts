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
  /** What to call it, e.g. "Am7" or "C/G". Null when nothing is sounding. */
  name: string | null;
  /** True when it matched a known quality rather than being listed as notes. */
  known: boolean;
}

/**
 * Works out what a shape is called.
 *
 * Tries every root against every quality and keeps the best fit, preferring the
 * chord whose root is in the bass and, failing that, the simpler quality. A
 * voicing missing its fifth is matched too — guitarists drop the fifth
 * constantly, and refusing to name those would make the finder useless on
 * exactly the shapes people reach for.
 *
 * Anything it can't name comes back as its note names, because a shape you
 * found and can't name is still worth writing down.
 */
export function detectChord(frets: number[]): Detected {
  const midi = soundingNotes(frets);
  if (midi.length === 0) return { name: null, known: false };

  const bass = Math.min(...midi) % 12;
  const pcs = [...new Set(midi.map((n) => n % 12))].sort((a, b) => a - b);

  if (pcs.length === 1) return { name: noteName(pcs[0]), known: true };

  let best: { score: number; root: number; suffix: string } | null = null;

  for (let root = 0; root < 12; root++) {
    FORMULAS.forEach(([suffix, intervals], rank) => {
      const full = intervals.map((iv) => (root + iv) % 12);
      // …and the same chord with its fifth left out.
      const noFifth = intervals.filter((iv) => iv !== 7).map((iv) => (root + iv) % 12);

      for (const [candidate, penalty] of [
        [full, 0],
        [noFifth, 30],
      ] as Array<[number[], number]>) {
        if (intervals.length < 4 && penalty > 0) continue; // triads keep their fifth
        const set = new Set(candidate);
        if (set.size !== pcs.length) continue;
        if (!pcs.every((pc) => set.has(pc))) continue;

        const score = (root === bass ? 0 : 60) + penalty + rank;
        if (!best || score < best.score) best = { score, root, suffix };
      }
    });
  }

  if (best) {
    const { root, suffix } = best as { score: number; root: number; suffix: string };
    const slash = root !== bass ? `/${noteName(bass)}` : '';
    return { name: `${noteName(root)}${suffix}${slash}`, known: true };
  }

  return { name: pcs.map(noteName).join(' '), known: false };
}
