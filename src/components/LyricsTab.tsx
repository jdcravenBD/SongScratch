import { useEffect, useRef } from 'react';
import type { MouseEvent, RefObject } from 'react';
import type { Song } from '../types';
import { defaultDoc } from '../lib/lyrics';

interface Props {
  song: Song;
  editing: boolean;
  /** The document element, owned above so the format bar can reach it too. */
  docRef: RefObject<HTMLDivElement | null>;
  onRequestEdit: () => void;
  onInput: (html: string) => void;
  /** Focus left the page — iOS's own keyboard "Done" among other ways out. */
  onLeave: () => void;
}

/**
 * The song sheet: title, tuning, description, then each section with its chords
 * and lines — one rich-text document rather than a set of fields, so any part
 * of it can be formatted and the whole thing reads as a page.
 *
 * React deliberately never renders its contents. The document is written into
 * the DOM once and then belongs to the browser's editing machinery; re-rendering
 * children under a caret would destroy the selection and the undo stack on
 * every keystroke.
 */
export default function LyricsTab({
  song,
  editing,
  docRef,
  onRequestEdit,
  onInput,
  onLeave,
}: Props) {
  /** Where the user clicked, held until the element is actually editable. */
  const pendingCaret = useRef<{ x: number; y: number } | null>(null);
  const loadedFor = useRef<string | null>(null);
  /**
   * When this page appeared. The tap that opened the song finishes *after* the
   * editor has rendered underneath the finger, so its click lands here and
   * would start editing straight away — the song would open with the keyboard
   * already up. Anything arriving before the screen has settled isn't a
   * deliberate tap on the lyrics.
   */
  const shownAt = useRef(performance.now());

  // Load the document once per song.
  useEffect(() => {
    const el = docRef.current;
    if (!el || loadedFor.current === song.id) return;
    el.innerHTML = song.lyrics?.trim() ? song.lyrics : defaultDoc(song);
    loadedFor.current = song.id;
  }, [song, docRef]);

  // Entering edit mode: take focus and drop the caret where it was asked for.
  useEffect(() => {
    if (!editing) return;
    const el = docRef.current;
    if (!el) return;

    // Formatting commands should write CSS rather than <font> tags.
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* not supported everywhere; the commands still work */
    }

    el.focus({ preventScroll: true });
    const at = pendingCaret.current;
    pendingCaret.current = null;

    const sel = window.getSelection();
    if (!sel) return;
    const range = at ? caretRangeAt(at.x, at.y) : null;
    if (range) {
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (sel.rangeCount === 0) {
      // Tapped Edit rather than the page: start at the end of the document.
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      sel.addRange(end);
    }
  }, [editing, docRef]);

  const handleClick = (e: MouseEvent) => {
    if (editing) return;
    if (performance.now() - shownAt.current < 400) return; // see shownAt
    // Remember the point now; the element can only take a caret once it's
    // editable, which is a state change away.
    pendingCaret.current = { x: e.clientX, y: e.clientY };
    onRequestEdit();
  };

  return (
    <div
      ref={docRef}
      className={`ly${editing ? ' is-editing' : ''}`}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={false}
      role={editing ? 'textbox' : undefined}
      aria-multiline={editing || undefined}
      aria-label="Lyrics"
      onClick={handleClick}
      onInput={(e) => onInput(e.currentTarget.innerHTML)}
      // Toolbar presses suppress mousedown, so they never blur this — a blur
      // really does mean the user has left, including via the keyboard's own
      // Done button on iOS. Treat it as finishing.
      onBlur={() => editing && onLeave()}
    />
  );
}

/**
 * The caret position under a point. Two names for the same thing: Firefox
 * implements the standard `caretPositionFromPoint`, WebKit and Blink shipped
 * `caretRangeFromPoint` first and kept it.
 */
function caretRangeAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  if (typeof doc.caretRangeFromPoint === 'function') {
    return doc.caretRangeFromPoint(x, y);
  }
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}
