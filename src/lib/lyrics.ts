import type { Song } from '../types';

/**
 * The lyric tab is one rich-text document rather than a set of fields, because
 * the user writes straight into it and formats any part of it. Its structure
 * lives in these block classes, which carry the type hierarchy the song sheet
 * is specified in: title, tuning, description, then per section a heading, the
 * chords for it, and the lines under those.
 */
export const BLOCK = {
  title: 'ly-title',
  tuning: 'ly-tuning',
  desc: 'ly-desc',
  section: 'ly-section',
  chords: 'ly-chords',
  lyrics: 'ly-lyrics',
} as const;

export type BlockKind = keyof typeof BLOCK;

/** Tag each block is built from — headings stay headings for accessibility. */
const TAG: Record<BlockKind, string> = {
  title: 'h1',
  tuning: 'p',
  desc: 'p',
  section: 'h2',
  chords: 'p',
  lyrics: 'p',
};

/**
 * Placeholder shown by CSS while a block is empty.
 *
 * Only the two the page starts with. A sheet labelling every empty line
 * "Tuning", "Description", "Chords" reads as a form to fill in; blank, it
 * reads as paper.
 */
const HINT: Partial<Record<BlockKind, string>> = {
  title: 'Title',
  lyrics: 'Lyrics…',
};

const escape = (s: string) =>
  s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

/** Same, plus the quote — this one goes inside an attribute. */
const escapeAttr = (s: string) => escape(s).replace(/"/g, '&quot;');

export function block(kind: BlockKind, text = '', hint = HINT[kind]): string {
  const ph = hint ? ` data-ph="${escapeAttr(hint)}"` : '';
  return `<${TAG[kind]} class="${BLOCK[kind]}"${ph}>${escape(text)}</${TAG[kind]}>`;
}

export function tagFor(kind: BlockKind): string {
  return TAG[kind];
}

export function classFor(kind: BlockKind): string {
  return BLOCK[kind];
}

/**
 * The empty song sheet: one line to write on.
 *
 * Nothing else is written in — not a section heading (a song that opens by
 * telling you it has a verse has already made a decision for you) and not the
 * empty tuning and description blocks it used to carry, which showed as blank
 * lines above the lyric with nothing to say they were there. The gap under the
 * title is now margin, which cannot be typed into by accident. The title isn't
 * here either; it belongs to the song record and is edited on its own.
 */
export function blankDoc(): string {
  return block('lyrics');
}

/**
 * The document a song starts life with: whatever the list already knows about
 * it, and a line to write over. Only what has something in it — see blankDoc.
 */
export function defaultDoc(song: Song): string {
  return [
    song.tuning ? block('tuning', song.tuning) : '',
    song.description ? block('desc', song.description) : '',
    block('lyrics'),
  ].join('');
}

/**
 * Drops the title out of a document written before it was moved out of the
 * page. It lives on the song record now and is edited in its own field, so
 * leaving it here would show it twice.
 */
export function stripTitle(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(`.${BLOCK.title}`).forEach((el) => el.remove());
  return doc.body.innerHTML;
}

/** True when the page has no words in it — only empty blocks, or nothing. */
export function isBlankDoc(el: HTMLElement): boolean {
  return (el.textContent ?? '').trim() === '';
}

/**
 * Marks the blocks with nothing in them, so their placeholder shows.
 *
 * `:empty` can't do this: emptying a block in a contenteditable leaves a `<br>`
 * behind, which is a child, so the block stops matching the moment the user
 * deletes the last character — exactly when the placeholder is wanted back.
 */
export function markBlanks(root: HTMLElement): void {
  for (const child of Array.from(root.children)) {
    child.classList.toggle('is-blank', (child.textContent ?? '').trim() === '');
  }
}

/**
 * Retypes the block the caret is sitting in — the size control's whole job,
 * since in this document a size *is* a role (a Section is 22px because it's a
 * section). Rebuilds the element so the tag changes with the class, then puts
 * the caret back, because replacing a node drops the selection with it.
 */
export function setBlockKind(root: HTMLElement, kind: BlockKind): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // Climb from the caret to whichever direct child of the document it's inside.
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node && node.parentNode !== root) node = node.parentNode;
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

  const old = node as HTMLElement;
  const next = document.createElement(TAG[kind]);
  next.className = BLOCK[kind];
  const hint = HINT[kind];
  if (hint) next.setAttribute('data-ph', hint);
  while (old.firstChild) next.appendChild(old.firstChild);
  root.replaceChild(next, old);

  const range = document.createRange();
  range.selectNodeContents(next);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export interface LyricMeta {
  tuning: string;
  description: string;
  sectionCount: number;
}

/**
 * Reads back the handful of things the song list draws, so a row stays true to
 * its document without the list ever having to parse one. The title is not
 * among them — it is its own field now, and is never written from here.
 */
export function extractMeta(html: string): LyricMeta {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (sel: string) => doc.querySelector(sel)?.textContent?.trim() ?? '';
  return {
    tuning: text(`.${BLOCK.tuning}`),
    description: text(`.${BLOCK.desc}`),
    sectionCount: doc.querySelectorAll(`.${BLOCK.section}`).length,
  };
}
