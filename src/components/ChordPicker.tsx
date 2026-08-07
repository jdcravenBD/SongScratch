import { useMemo, useState } from 'react';
import type { Chord, ChordShape } from '../types';
import { detectChord } from '../lib/chordName';
import { newId } from '../lib/id';
import ScrollArea from './ScrollArea';
import Fretboard from './Fretboard';
import { BackIcon, EllipsisIcon, SearchIcon } from './icons';

/** Everything open, nothing held. */
const EMPTY: ChordShape = { frets: [0, 0, 0, 0, 0, 0], baseFret: 1 };
const ALL_MUTED: ChordShape = { frets: [-1, -1, -1, -1, -1, -1], baseFret: 1 };

interface Props {
  onCancel: () => void;
  onConfirm: (chord: Chord) => void;
}

/**
 * Where a chord gets chosen — by finding it on the neck, or by searching for it
 * once search lands in the field above the buttons.
 *
 * The name lives in the title bar rather than down by the actions: it is what
 * the whole screen is about, and it belongs where a screen says what it is.
 */
export default function ChordPicker({ onCancel, onConfirm }: Props) {
  const [shape, setShape] = useState<ChordShape>(EMPTY);
  const [menuOpen, setMenuOpen] = useState(false);

  const detected = useMemo(() => detectChord(shape.frets), [shape]);
  const silent = detected.name === null;

  return (
    <div className="screen picker">
      <header className="picker__top">
        <button className="iconbtn" type="button" aria-label="Back" onClick={onCancel}>
          <BackIcon />
        </button>

        <h2 className="picker__title">{detected.name ?? '—'}</h2>

        <button
          className="iconbtn"
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen(true)}
        >
          <EllipsisIcon />
        </button>
      </header>

      <ScrollArea>
        <Fretboard shape={shape} onChange={setShape} />
      </ScrollArea>

      <div className="picker__dock">
        {/* Search lands here next; the room is reserved so nothing has to move
            when it does. */}
        <div className="search search--placeholder" aria-hidden="true">
          <SearchIcon className="search__icon" />
          <span className="search__ghost">Search chords</span>
        </div>

        <div className="picker__actions">
          <button className="chip" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chip chip--solid"
            type="button"
            disabled={silent}
            onClick={() => onConfirm({ id: newId(), name: detected.name ?? '', shape })}
          >
            Confirm
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="menu" role="dialog" aria-label="Fretboard actions">
          <button
            className="menu__scrim"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="menu__panel menu__panel--picker">
            <button
              className="menu__item"
              type="button"
              onClick={() => {
                setShape(EMPTY);
                setMenuOpen(false);
              }}
            >
              <span>Clear Shape</span>
            </button>
            <button
              className="menu__item"
              type="button"
              onClick={() => {
                setShape(ALL_MUTED);
                setMenuOpen(false);
              }}
            >
              <span>Mute All Strings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
