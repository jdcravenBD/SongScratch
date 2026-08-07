import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ChordSection } from '../types';
import ChordDiagram from './ChordDiagram';
import { GripIcon, PlusIcon, TrashIcon } from './icons';

const REVEAL = 78;
const SLOP = 8;
const COMMIT = 0.42;
const PILL_GAP = 14;
const ICON_AT = 40;

interface Props {
  section: ChordSection;
  index: number;
  expanded: boolean;
  forceClosed: boolean;
  /** Non-zero while a reorder is in flight, in px. */
  lift: number;
  dragging: boolean;
  onExpand: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReveal: (id: string | null) => void;
  onAddChord: (sectionId: string) => void;
  onGrip: (index: number, e: ReactPointerEvent) => void;
}

/**
 * One section of the progression: its name, and when open, the chords in it.
 *
 * Same gestures as the song and memo lists — swipe left to delete, tap to open,
 * tap the name of an open one to rename it. Reordering is deliberately *not* on
 * a long press: the grip on the left is the only thing that starts a drag, so
 * pressing anywhere else stays free for scrolling.
 */
export default function SectionRow({
  section,
  index,
  expanded,
  forceClosed,
  lift,
  dragging,
  onExpand,
  onRename,
  onDelete,
  onReveal,
  onAddChord,
  onGrip,
}: Props) {
  const host = useRef<HTMLLIElement>(null);
  const fg = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const start = useRef({ x: 0, y: 0 });
  const rawX = useRef(0);
  const base = useRef(0);
  const axis = useRef<'none' | 'x' | 'y'>('none');
  const pid = useRef<number | null>(null);
  const moved = useRef(false);

  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const slide = (x: number, animate: boolean) => {
    const el = fg.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2,0.9,0.3,1)' : 'none';
    el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;
    const li = host.current;
    if (!li) return;
    const pill = Math.max(0, Math.abs(x) - PILL_GAP);
    li.dataset.swipe = x < 0 ? 'delete' : 'none';
    li.style.setProperty('--reveal', `${pill}px`);
    li.style.setProperty('--reveal-ms', animate ? '0.32s' : '0s');
    li.style.setProperty('--icon-op', pill >= ICON_AT ? '1' : '0');
  };

  const close = (notify = true) => {
    setOpen(false);
    slide(0, true);
    if (notify) onReveal(null);
  };

  useEffect(() => {
    if (forceClosed && open) {
      setOpen(false);
      slide(0, true);
    }
  }, [forceClosed, open]);

  useEffect(() => {
    if (renaming) nameInput.current?.select();
  }, [renaming]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (renaming) return;
    pid.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    base.current = open ? -REVEAL : 0;
    axis.current = 'none';
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === 'none') {
      if (Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) {
        moved.current = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          axis.current = 'x';
          try {
            // Captured on the element that owns these handlers, or capture
            // retargets the rest of the gesture away from them.
            head.current?.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
        } else {
          axis.current = 'y';
          pid.current = null; // let the list scroll
        }
      }
    }

    if (axis.current === 'x') {
      e.preventDefault();
      const x = Math.min(0, base.current + dx); // opens leftward only
      rawX.current = x;
      const limit = REVEAL + 60;
      slide(Math.abs(x) > limit ? -(limit + (Math.abs(x) - limit) * 0.25) : x, false);
    }
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    const swiped = axis.current === 'x';
    axis.current = 'none';

    if (!swiped) {
      if (moved.current || renaming) return;
      if (open) close();
      else onExpand(expanded ? null : section.id);
      return;
    }

    const width = fg.current?.offsetWidth ?? 320;
    if (rawX.current < -width * COMMIT) {
      slide(-width, true);
      window.setTimeout(() => onDelete(section.id), 200);
    } else if (rawX.current < -REVEAL * 0.55) {
      setOpen(true);
      slide(-REVEAL, true);
      onReveal(section.id);
    } else {
      close();
    }
  };

  const commitRename = () => {
    const value = nameInput.current?.value.trim();
    setRenaming(false);
    if (value && value !== section.name) onRename(section.id, value);
  };

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenaming(false);
  };

  const count = section.chords.length;

  return (
    <li
      className={`sect${expanded ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`}
      ref={host}
      style={lift ? { transform: `translate3d(0,${lift}px,0)` } : undefined}
    >
      <button
        className="sect__action"
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label={`Delete ${section.name}`}
        onClick={() => onDelete(section.id)}
      >
        <TrashIcon />
      </button>

      <div className="sect__fg" ref={fg}>
        <div
          className="sect__head"
          ref={head}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* The only thing that starts a reorder, so the rest of the row is
              still free to scroll and to swipe. */}
          <span
            className="sect__grip"
            aria-label="Reorder section"
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              e.stopPropagation();
              onGrip(index, e);
            }}
          >
            <GripIcon />
          </span>

          <span className="sect__text">
            {renaming ? (
              <input
                ref={nameInput}
                className="sect__rename"
                defaultValue={section.name}
                onBlur={commitRename}
                onKeyDown={onNameKey}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Section name"
              />
            ) : (
              <span
                className={`sect__name${expanded ? ' is-editable' : ''}`}
                /* The header acts on pointerup, which lands before any click
                   and would collapse the row first — so the name has to
                   swallow the pointer events, not just the click. */
                onPointerDown={(e) => {
                  if (expanded) e.stopPropagation();
                }}
                onPointerUp={(e) => {
                  if (!expanded) return;
                  e.stopPropagation();
                  setRenaming(true);
                }}
              >
                {section.name}
              </span>
            )}
            <span className="sect__meta">
              {count === 0 ? 'No chords' : `${count} ${count === 1 ? 'chord' : 'chords'}`}
            </span>
          </span>
        </div>

        {expanded && (
          <div className="sect__body">
            {/* The add button is the next slot in the progression, shaped and
                sized like the fingerings it sits beside, so the row reads as
                one continuous run with an empty place at the end. */}
            <div className="chords">
              {section.chords.map((chord) => (
                <div className="chord" key={chord.id}>
                  <ChordDiagram shape={chord.shape} />
                  <span className="chord__name">{chord.name}</span>
                </div>
              ))}

              <button
                className="chord chord--add"
                type="button"
                aria-label="Add chord"
                onClick={() => onAddChord(section.id)}
              >
                <span className="chord__slot">
                  <PlusIcon size={22} />
                </span>
                <span className="chord__name">Add</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
