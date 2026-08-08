import { useCallback } from 'react';
import type { ChordSections } from '../hooks/useChordSections';
import { useReorder } from '../hooks/useReorder';
import SectionRow from './SectionRow';
import { PlusIcon } from './icons';

/**
 * The chord progression: a stack of named sections, in playing order.
 */
export function ChordsList({ chords }: { chords: ChordSections }) {
  const { sections } = chords;

  const commit = useCallback(
    (from: number, to: number) => void chords.reorder(from, to),
    [chords],
  );
  const prepare = useCallback(() => {
    chords.setExpandedId(null);
    chords.setRevealedId(null);
  }, [chords]);

  const { listRef, begin, dragIndex, dy, liftFor } = useReorder(commit, prepare);
  const count = sections.length;

  return (
    <>
      <div className="hero">
        <h1 className="hero__title">Chords</h1>
        <p className="hero__count">
          {count} {count === 1 ? 'Section' : 'Sections'}
        </p>
      </div>

      {count === 0 ? (
        <div className="empty">
          <p className="empty__title">No Sections</p>
          <p className="empty__hint">
            Add a section for each part of the song — verse, chorus, bridge.
          </p>
        </div>
      ) : (
        <ul className="sects" ref={listRef}>
          {sections.map((section, i) => (
            <SectionRow
              key={section.id}
              section={section}
              index={i}
              expanded={chords.expandedId === section.id}
              forceClosed={chords.revealedId !== null && chords.revealedId !== section.id}
              lift={i === dragIndex ? dy : liftFor(i)}
              dragging={i === dragIndex}
              onExpand={chords.setExpandedId}
              onRename={(id, name) => void chords.rename(id, name)}
              onDelete={(id) => void chords.remove(id)}
              onReveal={chords.setRevealedId}
              onAddChord={chords.startAdd}
              onHoldChord={(sectionId, chord, at) =>
                chords.hold({ sectionId, chord, at })
              }
              onGrip={begin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** Sits in the editor's bottom bar above the tabs. */
export function ChordsDock({ chords }: { chords: ChordSections }) {
  return (
    <div className="rec">
      <button className="chip chip--wide" type="button" onClick={() => void chords.add()}>
        <PlusIcon size={17} />
        <span>New Section</span>
      </button>
    </div>
  );
}
