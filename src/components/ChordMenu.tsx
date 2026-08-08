import { useLayoutEffect, useRef } from 'react';
import type { HeldChord } from '../hooks/useChordSections';
import { ComposeIcon, TrashIcon } from './icons';

/** Clear of the chord, and of the screen's own edges. */
const GAP = 8;
const EDGE = 12;

interface Props {
  held: HeldChord;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * What can be done with one chord, opened by holding it.
 *
 * The same panel the ellipsis opens, but grown out of the fingering that was
 * held rather than from a corner — so it reads as belonging to that chord and
 * not to the screen. It is placed under the chord where there is room and above
 * it where there isn't, measured before the first paint so it never jumps.
 */
export default function ChordMenu({ held, onEdit, onDelete, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const screen = root.current;
    const box = panel.current;
    if (!screen || !box) return;

    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const left = Math.max(EDGE, Math.min(screen.clientWidth - w - EDGE, held.at.x - w / 2));
    const under = held.at.bottom + GAP;
    const fits = under + h <= screen.clientHeight - EDGE;
    const top = fits ? under : Math.max(EDGE, held.at.top - h - GAP);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    // Out of the chord itself, whichever side it ended up on.
    box.style.transformOrigin = `${held.at.x - left}px ${fits ? '0' : '100%'}`;
  }, [held]);

  return (
    <div className="menu" role="dialog" aria-label={`${held.chord.name} actions`} ref={root}>
      <button className="menu__scrim" type="button" aria-label="Close menu" onClick={onClose} />

      <div className="menu__panel menu__panel--chord" ref={panel}>
        <button className="menu__item" type="button" onClick={onEdit}>
          <ComposeIcon />
          <span>Edit</span>
        </button>
        {/* No "Rearrange" here: holding a chord goes straight into it, which
            is one gesture instead of a trip through this menu. */}
        <button className="menu__item menu__item--danger" type="button" onClick={onDelete}>
          <TrashIcon />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
