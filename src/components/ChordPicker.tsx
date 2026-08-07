import { useMemo, useState } from 'react';
import type { Chord, ChordShape } from '../types';
import { detectChord } from '../lib/chordName';
import { newId } from '../lib/id';
import ScrollArea from './ScrollArea';
import Fretboard from './Fretboard';
import { SearchIcon } from './icons';

/** Everything open, nothing held. */
const EMPTY: ChordShape = { frets: [0, 0, 0, 0, 0, 0], baseFret: 1 };

interface Props {
  onCancel: () => void;
  onConfirm: (chord: Chord) => void;
}

/**
 * Where a chord gets chosen. The reverse finder is the first of the three ways
 * in — search and the note wheel join it above and below, which is why the top
 * of the screen is already given over to a search slot.
 */
export default function ChordPicker({ onCancel, onConfirm }: Props) {
  const [shape, setShape] = useState<ChordShape>(EMPTY);

  const detected = useMemo(() => detectChord(shape.frets), [shape]);
  const silent = detected.name === null;

  return (
    <div className="screen picker">
      <header className="picker__top">
        {/* Search lands here next; the room is reserved so the fretboard
            doesn't have to move when it does. */}
        <div className="search search--placeholder" aria-hidden="true">
          <SearchIcon className="search__icon" />
          <span className="search__ghost">Search chords</span>
        </div>
      </header>

      <ScrollArea>
        <Fretboard shape={shape} onChange={setShape} />
      </ScrollArea>

      <div className="picker__actions">
        <button className="chip" type="button" onClick={onCancel}>
          Cancel
        </button>

        <p className={`picker__name${detected.known ? '' : ' is-unnamed'}`}>
          {detected.name ?? '—'}
        </p>

        <button
          className="chip chip--solid"
          type="button"
          disabled={silent}
          onClick={() =>
            onConfirm({ id: newId(), name: detected.name ?? '', shape })
          }
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
