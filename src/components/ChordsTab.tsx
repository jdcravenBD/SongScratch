import { useCallback } from 'react';
import type { ChordSections } from '../hooks/useChordSections';
import { useReorder } from '../hooks/useReorder';
import SectionRow from './SectionRow';
import { PlusIcon, TrashIcon } from './icons';

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
        <h1 className="hero__title">
          {chords.selectMode
            ? chords.selected.size
              ? `${chords.selected.size} Selected`
              : 'Select Sections'
            : 'Chords'}
        </h1>
        <p className="hero__count">
          {count} {count === 1 ? 'Section' : 'Sections'}
        </p>
      </div>

      {count === 0 ? (
        <div className="empty">
          <p className="empty__title">No Sections</p>
          <p className="empty__hint">
            Add a section for each part of the song (ie. verse, bridge, chorus)
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
              selectMode={chords.selectMode}
              selected={chords.selected.has(section.id)}
              onToggleSelect={chords.toggleSelect}
              onLongPress={chords.enterSelect}
              onExpand={chords.setExpandedId}
              onRename={(id, name) => void chords.rename(id, name)}
              onDelete={(id) => void chords.remove(id)}
              onReveal={chords.setRevealedId}
              onAddChord={chords.startAdd}
              onTapChord={(sectionId, chord, at) =>
                chords.hold({ sectionId, chord, at })
              }
              onArrange={chords.setArranging}
              arranging={chords.arranging === section.id}
              onReorderChords={(id, from, to) => void chords.reorderChords(id, from, to)}
              onDoneArranging={() => chords.setArranging(null)}
              onGrip={begin}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Sits in the editor's bottom bar above the tabs — or gives way to the
 * selection actions while several sections are picked, as the voice tab does.
 */
export function ChordsDock({ chords }: { chords: ChordSections }) {
  if (chords.selectMode) {
    const ids = [...chords.selected];
    return (
      <div className="rec rec--select">
        <div className="toolbar">
          <button
            className="tool tool--danger"
            type="button"
            disabled={!ids.length}
            onClick={async () => {
              await chords.removeMany(ids);
              chords.exitSelect();
            }}
          >
            <TrashIcon />
            <span>Delete</span>
          </button>
          <button className="tool" type="button" onClick={chords.exitSelect}>
            <span className="tool__done">Done</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rec">
      <button className="chip chip--wide" type="button" onClick={() => void chords.add()}>
        <PlusIcon size={17} />
        <span>New Section</span>
      </button>
    </div>
  );
}
