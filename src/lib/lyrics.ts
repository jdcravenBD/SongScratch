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

/** Placeholder shown by CSS while a block is empty. */
const HINT: Record<BlockKind, string> = {
  title: 'Title',
  tuning: 'Tuning',
  desc: 'Description',
  section: 'Section',
  chords: 'Chords',
  lyrics: 'Lyrics',
};

const escape = (s: string) =>
  s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

export function block(kind: BlockKind, text = ''): string {
  return `<${TAG[kind]} class="${BLOCK[kind]}" data-ph="${HINT[kind]}">${escape(text)}</${TAG[kind]}>`;
}

export function tagFor(kind: BlockKind): string {
  return TAG[kind];
}

export function classFor(kind: BlockKind): string {
  return BLOCK[kind];
}

/**
 * The document a song starts life with: whatever the list already knows about
 * it, and one empty verse to write into.
 */
export function defaultDoc(song: Song): string {
  return [
    block('title', song.title),
    block('tuning', song.tuning ?? ''),
    block('desc', song.description ?? ''),
    block('section', 'Verse'),
    block('chords'),
    block('lyrics'),
  ].join('');
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
  next.setAttribute('data-ph', HINT[kind]);
  while (old.firstChild) next.appendChild(old.firstChild);
  root.replaceChild(next, old);

  const range = document.createRange();
  range.selectNodeContents(next);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export interface LyricMeta {
  title: string;
  tuning: string;
  description: string;
  sectionCount: number;
}

/**
 * Reads back the handful of things the song list draws, so a row stays true to
 * its document without the list ever having to parse one.
 */
export function extractMeta(html: string): LyricMeta {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (sel: string) => doc.querySelector(sel)?.textContent?.trim() ?? '';
  return {
    title: text(`.${BLOCK.title}`),
    tuning: text(`.${BLOCK.tuning}`),
    description: text(`.${BLOCK.desc}`),
    sectionCount: doc.querySelectorAll(`.${BLOCK.section}`).length,
  };
}
