import { useMemo, useRef, useState } from 'react';
import type { Chord, ChordShape } from '../types';
import { detectChord } from '../lib/chordName';
import { searchChords } from '../lib/chordLibrary';
import { newId } from '../lib/id';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import ScrollArea from './ScrollArea';
import Fretboard from './Fretboard';
import ChordDiagram from './ChordDiagram';
import { BackIcon, CloseIcon, EllipsisIcon, SearchIcon } from './icons';

/** Everything open, nothing held. */
const EMPTY: ChordShape = { frets: [0, 0, 0, 0, 0, 0], baseFret: 1 };
const ALL_MUTED: ChordShape = { frets: [-1, -1, -1, -1, -1, -1], baseFret: 1 };

interface Props {
  /** The chord being changed, or null when a new one is being added. */
  initial?: Chord | null;
  /** True while this screen is sliding away to the right. */
  leaving?: boolean;
  onCancel: () => void;
  onConfirm: (chord: Chord) => void;
}

/**
 * Where a chord gets chosen — either by finding it on the neck, or by naming
 * it and picking from what comes back.
 *
 * Search doesn't confirm anything by itself: choosing a result loads it onto
 * the fretboard, so every chord leaves by the same door and can be looked at,
 * altered, or played against before it is kept.
 */
export default function ChordPicker({ initial, leaving, onCancel, onConfirm }: Props) {
  // An existing chord opens on its own fingering, so editing starts from what
  // is already there rather than from a bare neck.
  const [shape, setShape] = useState<ChordShape>(initial?.shape ?? EMPTY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const field = useRef<HTMLInputElement>(null);

  const keyboardInset = useKeyboardInset();

  const detected = useMemo(() => detectChord(shape.frets), [shape]);
  const results = useMemo(() => searchChords(query), [query]);
  const silent = detected.name === null;
  const searching = query.trim().length > 0;

  return (
    /* --kb lifts the dock and shortens the list by however much of the screen
       the keyboard is covering — searching is the one thing here that opens
       one, and results underneath it can't be reached. */
    <div
      className={`screen picker${leaving ? ' is-leaving' : ''}`}
      style={{ '--kb': `${keyboardInset}px` } as React.CSSProperties}
    >
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
        {searching ? (
          results.length === 0 ? (
            <div className="empty">
              <p className="empty__title">No Chords</p>
              <p className="empty__hint">Nothing matches “{query.trim()}”.</p>
            </div>
          ) : (
            <div className="results">
              {results.map((chord, i) => (
                <button
                  className="chord"
                  type="button"
                  key={`${chord.name}-${i}`}
                  onClick={() => {
                    setShape(chord.shape);
                    setQuery('');
                    field.current?.blur();
                  }}
                >
                  <ChordDiagram shape={chord.shape} />
                  <span className="chord__name">{chord.name}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <Fretboard shape={shape} onChange={setShape} />
        )}
      </ScrollArea>

      <div className="picker__dock">
        <label className="search">
          <SearchIcon className="search__icon" />
          <input
            ref={field}
            className="search__input"
            type="text"
            placeholder="Search chords"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="search__clear"
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery('');
                field.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          )}
        </label>

        <div className="picker__actions">
          <button className="chip" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chip chip--solid"
            type="button"
            disabled={silent}
            /* Keeps its id when it is an edit, so it goes back where it was
               instead of arriving at the end as a new chord. */
            onClick={() =>
              onConfirm({ id: initial?.id ?? newId(), name: detected.name ?? '', shape })
            }
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
