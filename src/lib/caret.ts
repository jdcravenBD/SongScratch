/**
 * Which character of `text` sits nearest `x`, measured in the given font.
 *
 * Renaming swaps a label for an input at the same place in the same face, so
 * the caret can land where the finger did rather than jumping to one end. An
 * `<input>` gives no way to ask that directly — `caretRangeFromPoint` only
 * speaks for rendered text — so the widths are measured instead.
 */
let scratch: CanvasRenderingContext2D | null = null;

export function caretIndexAtX(text: string, font: string, x: number): number {
  if (x <= 0) return 0;
  if (!scratch) scratch = document.createElement('canvas').getContext('2d');
  if (!scratch) return text.length;
  scratch.font = font;

  let best = 0;
  let bestDistance = Infinity;
  // Walking every boundary rather than binary-searching: names are short, and
  // this is exact even in a proportional face with kerning.
  for (let i = 0; i <= text.length; i++) {
    const distance = Math.abs(scratch.measureText(text.slice(0, i)).width - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** The shorthand `font` string for an element, ready for canvas measurement. */
export function fontOf(el: Element): string {
  const cs = getComputedStyle(el);
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
}
