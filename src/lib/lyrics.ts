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
 * Only the title has one. A sheet labelling its own empty lines "Tuning",
 * "Description", "Chords" reads as a form to fill in; blank, it reads as paper.
 * The lyric block gets something better than a label — see `ghostLine`.
 */
const HINT: Partial<Record<BlockKind, string>> = {
  title: 'Title',
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
 * A line of an older song, sitting where the first lyric goes until something
 * is written over it.
 *
 * All of them are traditional or long out of copyright — these ship inside the
 * app and go to the App Store with it, which no modern lyric could.
 */
const GHOSTS = [
  'There is a house in New Orleans',
  'I am a poor wayfaring stranger',
  'Oh Shenandoah, I long to hear you',
  'Are you going to Scarborough Fair',
  'The water is wide, I cannot get over',
  'In the pines, where the sun never shines',
  'Hang down your head, Tom Dooley',
  'I am a man of constant sorrow',
  'Frankie and Johnny were lovers',
  'Down in the valley, valley so low',
  'Love, oh love, oh careless love',
  'I went down to St. James Infirmary',
  'Amazing grace, how sweet the sound',
  'Swing low, sweet chariot',
  'Alas, my love, you do me wrong',
  'I come from Alabama with a banjo on my knee',
  'In Scarlet Town where I was born',
  'Oh, the cuckoo, she is a pretty bird',
  'John Henry was a little baby boy',
  'Shady Grove, my little love',
];

/**
 * Which line a song gets. Drawn from its id rather than at random, so a song
 * keeps the same one every time it is opened — a placeholder that changed
 * underneath you would read as the app losing your words.
 */
export function ghostLine(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return GHOSTS[hash % GHOSTS.length];
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
    block('lyrics', '', ghostLine(song.id)),
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
