import type { ChordShape } from '../types';
import { noteName } from './chordName';

/**
 * Chords you can look up by name.
 *
 * Two sources, deliberately. The open chords are written out because those are
 * the grips people actually reach for and no rule would produce exactly them.
 * Everything else is generated from the two movable forms — an E shape rooted
 * on the sixth string and an A shape on the fifth — slid up the neck, which is
 * how a guitarist gets any chord in any key anyway. Between them every root has
 * at least two voicings.
 */

export interface LibraryChord {
  name: string;
  shape: ChordShape;
  /** Roughly where on the neck it sits, used only to order results. */
  position: number;
}

/** Open-position grips, written as played. */
const OPEN: Array<[string, number[]]> = [
  ['C', [-1, 3, 2, 0, 1, 0]],
  ['Cmaj7', [-1, 3, 2, 0, 0, 0]],
  ['C7', [-1, 3, 2, 3, 1, 0]],
  ['A', [-1, 0, 2, 2, 2, 0]],
  ['Am', [-1, 0, 2, 2, 1, 0]],
  ['A7', [-1, 0, 2, 0, 2, 0]],
  ['Am7', [-1, 0, 2, 0, 1, 0]],
  ['Amaj7', [-1, 0, 2, 1, 2, 0]],
  ['Asus4', [-1, 0, 2, 2, 3, 0]],
  ['G', [3, 2, 0, 0, 0, 3]],
  ['G7', [3, 2, 0, 0, 0, 1]],
  ['Gmaj7', [3, 2, 0, 0, 0, 2]],
  ['E', [0, 2, 2, 1, 0, 0]],
  ['Em', [0, 2, 2, 0, 0, 0]],
  ['E7', [0, 2, 0, 1, 0, 0]],
  ['Em7', [0, 2, 0, 0, 0, 0]],
  ['Emaj7', [0, 2, 1, 1, 0, 0]],
  ['Esus4', [0, 2, 2, 2, 0, 0]],
  ['D', [-1, -1, 0, 2, 3, 2]],
  ['Dm', [-1, -1, 0, 2, 3, 1]],
  ['D7', [-1, -1, 0, 2, 1, 2]],
  ['Dm7', [-1, -1, 0, 2, 1, 1]],
  ['Dmaj7', [-1, -1, 0, 2, 2, 2]],
  ['Dsus4', [-1, -1, 0, 2, 3, 3]],
  ['Dsus2', [-1, -1, 0, 2, 3, 0]],
  ['F', [1, 3, 3, 2, 1, 1]],
  ['Fmaj7', [-1, -1, 3, 2, 1, 0]],
  ['B7', [-1, 2, 1, 2, 0, 2]],
  ['Bm', [-1, 2, 4, 4, 3, 2]],
  ['G5', [3, 5, 5, -1, -1, -1]],
  ['A5', [5, 7, 7, -1, -1, -1]],
];

/**
 * Movable forms, written at the nut. Sliding one up by n frets raises it n
 * semitones, so one template covers all twelve keys.
 */
const MOVABLE: Array<{ suffix: string; frets: number[]; openRoot: number }> = [
  // E shape — root on the sixth string, open root E.
  { suffix: '', frets: [0, 2, 2, 1, 0, 0], openRoot: 4 },
  { suffix: 'm', frets: [0, 2, 2, 0, 0, 0], openRoot: 4 },
  { suffix: '7', frets: [0, 2, 0, 1, 0, 0], openRoot: 4 },
  { suffix: 'm7', frets: [0, 2, 0, 0, 0, 0], openRoot: 4 },
  { suffix: 'maj7', frets: [0, 2, 1, 1, 0, 0], openRoot: 4 },
  { suffix: 'sus4', frets: [0, 2, 2, 2, 0, 0], openRoot: 4 },
  { suffix: '6', frets: [0, 2, 2, 1, 2, 0], openRoot: 4 },
  { suffix: 'm6', frets: [0, 2, 2, 0, 2, 0], openRoot: 4 },
  { suffix: '5', frets: [0, 2, 2, -1, -1, -1], openRoot: 4 },
  // A shape — root on the fifth string, open root A.
  { suffix: '', frets: [-1, 0, 2, 2, 2, 0], openRoot: 9 },
  { suffix: 'm', frets: [-1, 0, 2, 2, 1, 0], openRoot: 9 },
  { suffix: '7', frets: [-1, 0, 2, 0, 2, 0], openRoot: 9 },
  { suffix: 'm7', frets: [-1, 0, 2, 0, 1, 0], openRoot: 9 },
  { suffix: 'maj7', frets: [-1, 0, 2, 1, 2, 0], openRoot: 9 },
  { suffix: 'sus4', frets: [-1, 0, 2, 2, 3, 0], openRoot: 9 },
  { suffix: '6', frets: [-1, 0, 2, 2, 2, 2], openRoot: 9 },
  { suffix: 'm6', frets: [-1, 0, 2, 2, 1, 2], openRoot: 9 },
  { suffix: '5', frets: [-1, 0, 2, -1, -1, -1], openRoot: 9 },
];

function build(): LibraryChord[] {
  const out: LibraryChord[] = OPEN.map(([name, frets]) => ({
    name,
    shape: { frets, baseFret: 1 },
    position: Math.max(0, ...frets.filter((f) => f > 0)),
  }));

  for (const form of MOVABLE) {
    for (let root = 0; root < 12; root++) {
      const barre = (root - form.openRoot + 12) % 12;
      // At zero this is the open form, which the list above already has.
      if (barre === 0) continue;
      const frets = form.frets.map((f) => (f < 0 ? -1 : f + barre));
      out.push({
        name: `${noteName(root)}${form.suffix}`,
        shape: { frets, baseFret: 1 },
        position: barre,
      });
    }
  }
  return out;
}

const LIBRARY = build();

/**
 * Squashes a query or a chord name to the form both get compared in: no case,
 * no spaces, one spelling per pitch, and the words people type instead of the
 * symbols.
 */
function normalise(text: string): string {
  let out = text.toLowerCase().replace(/\s+/g, '');
  out = out
    .replace(/minor/g, 'm')
    .replace(/major/g, 'maj')
    .replace(/dominant/g, '')
    .replace(/sharp/g, '#')
    .replace(/flat/g, 'b');
  // One name per pitch, so a# finds Bb and gb finds F#.
  out = out
    .replace(/^a#/, 'bb')
    .replace(/^d#/, 'eb')
    .replace(/^g#/, 'ab')
    .replace(/^db/, 'c#')
    .replace(/^gb/, 'f#')
    .replace(/^cb/, 'b')
    .replace(/^fb/, 'e')
    .replace(/^e#/, 'f')
    .replace(/^b#/, 'c');
  return out;
}

/**
 * Chords matching what has been typed. Names that begin with the query come
 * first — typing "am" wants Am long before it wants Cmaj7 — then the ones that
 * merely contain it, and lower positions before higher within each.
 */
export function searchChords(query: string, limit = 24): LibraryChord[] {
  const q = normalise(query);
  if (!q) return [];

  const scored: Array<{ chord: LibraryChord; rank: number }> = [];
  for (const chord of LIBRARY) {
    const name = normalise(chord.name);
    if (name === q) scored.push({ chord, rank: 0 });
    else if (name.startsWith(q)) scored.push({ chord, rank: 1 });
    else if (name.includes(q)) scored.push({ chord, rank: 2 });
  }

  return scored
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.chord.name.length - b.chord.name.length ||
        a.chord.position - b.chord.position,
    )
    .slice(0, limit)
    .map((s) => s.chord);
}
