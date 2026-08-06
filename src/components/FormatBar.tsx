import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { BlockKind } from '../lib/lyrics';
import { CheckIcon, ColorIcon, HighlightIcon } from './icons';

/** Text colours, kept few and legible against black. */
const COLORS: Array<[string, string]> = [
  ['White', '#ffffff'],
  ['Grey', '#9a9aa1'],
  ['Red', '#ff453a'],
  ['Amber', '#ffd60a'],
  ['Green', '#30d158'],
  ['Blue', '#0a84ff'],
  ['Purple', '#bf5af0'],
];

/**
 * Highlights are translucent so white text stays readable on top of them —
 * an opaque marker colour on a black page would bury the words it marks.
 */
const HIGHLIGHTS: Array<[string, string]> = [
  ['None', 'transparent'],
  ['Amber', 'rgba(255, 214, 10, 0.30)'],
  ['Green', 'rgba(48, 209, 88, 0.28)'],
  ['Blue', 'rgba(10, 132, 255, 0.32)'],
  ['Purple', 'rgba(191, 90, 240, 0.30)'],
  ['Red', 'rgba(255, 69, 58, 0.28)'],
];

/** The document's sizes, which here are also its roles. */
const SIZES: Array<[BlockKind, string]> = [
  ['title', 'Title'],
  ['section', 'Section'],
  ['chords', 'Chords'],
  ['lyrics', 'Lyrics'],
];

type Panel = 'size' | 'style' | 'highlight' | 'color' | null;

interface Props {
  /** How much of the screen the on-screen keyboard is covering. */
  keyboardInset: number;
  onBlockKind: (kind: BlockKind) => void;
  onDone: () => void;
}

/**
 * The editing toolbar: one long pill that sits directly on top of the keyboard.
 *
 * Every control here has to run without the editable ever losing focus —
 * `document.execCommand` works on the current selection, and a button that
 * takes focus destroys that selection before it can be read. Suppressing
 * mousedown (rather than handling click) is what keeps the caret where it was.
 */
export default function FormatBar({ keyboardInset, onBlockKind, onDone }: Props) {
  const [panel, setPanel] = useState<Panel>(null);

  const keep = (e: MouseEvent) => e.preventDefault();

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
  };

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div
      className="fmt"
      style={{ '--kb': `${keyboardInset}px` } as React.CSSProperties}
      onMouseDown={keep}
    >
      {panel && (
        <div className="fmt__panel">
          {panel === 'size' &&
            SIZES.map(([kind, label]) => (
              <button
                key={kind}
                className={`fmt__opt fmt__opt--${kind}`}
                type="button"
                onClick={() => {
                  onBlockKind(kind);
                  setPanel(null);
                }}
              >
                {label}
              </button>
            ))}

          {panel === 'style' && (
            <div className="fmt__styles">
              <StyleBtn label="B" title="Bold" onClick={() => exec('bold')} />
              <StyleBtn label="I" title="Italic" onClick={() => exec('italic')} />
              <StyleBtn label="U" title="Underline" onClick={() => exec('underline')} />
              <StyleBtn label="S" title="Strikethrough" onClick={() => exec('strikeThrough')} />
            </div>
          )}

          {panel === 'highlight' && (
            <div className="fmt__swatches">
              {HIGHLIGHTS.map(([label, value]) => (
                <button
                  key={label}
                  className={`swatch${value === 'transparent' ? ' swatch--none' : ''}`}
                  type="button"
                  title={label}
                  aria-label={label}
                  style={{ background: value }}
                  onClick={() => {
                    exec('hiliteColor', value);
                    setPanel(null);
                  }}
                />
              ))}
            </div>
          )}

          {panel === 'color' && (
            <div className="fmt__swatches">
              {COLORS.map(([label, value]) => (
                <button
                  key={label}
                  className="swatch"
                  type="button"
                  title={label}
                  aria-label={label}
                  style={{ background: value }}
                  onClick={() => {
                    exec('foreColor', value);
                    setPanel(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fmt__bar">
        <Tool active={panel === 'size'} label="Text size" onClick={() => toggle('size')}>
          <span className="fmt__glyph">Aa</span>
        </Tool>
        <Tool active={panel === 'style'} label="Formatting" onClick={() => toggle('style')}>
          <span className="fmt__glyph fmt__glyph--bold">B</span>
        </Tool>
        <Tool active={panel === 'highlight'} label="Highlight" onClick={() => toggle('highlight')}>
          <HighlightIcon />
        </Tool>
        <Tool active={panel === 'color'} label="Text colour" onClick={() => toggle('color')}>
          <ColorIcon />
        </Tool>

        <span className="fmt__sep" />

        <Tool label="Done editing" onClick={onDone}>
          <CheckIcon />
        </Tool>
      </div>
    </div>
  );
}

function Tool({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`fmt__tool${active ? ' is-active' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StyleBtn({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`fmt__style fmt__style--${title.toLowerCase()}`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
