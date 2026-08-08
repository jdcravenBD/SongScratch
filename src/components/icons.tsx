/**
 * Inline SVG icon set. Everything is stroked in `currentColor` on a 24-unit
 * grid at a consistent weight, so icons sitting next to text inherit its colour
 * and read at the same visual density.
 */
type IconProps = { size?: number; className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.1}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

/** New song — a pencil. */
export function ComposeIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 20.5l4.2-1.1L19 8.6a2.05 2.05 0 0 0-2.9-2.9L5.1 16.4 4 20.5z" />
      <path d="M14.6 7.2l2.9 2.9" />
    </svg>
  );
}

export function TrashIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
      <path d="M6.4 7l.9 12.1a1.2 1.2 0 0 0 1.2 1.1h7a1.2 1.2 0 0 0 1.2-1.1L17.6 7" />
      <path d="M10.2 11v5.6M13.8 11v5.6" />
    </svg>
  );
}

export function PinIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 3.8h6l-.8 5.3 3 2.6v1.8H6.8v-1.8l3-2.6L9 3.8z" />
      <path d="M12 13.5V20.2" />
    </svg>
  );
}

export function DuplicateIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4" />
      <path d="M15.4 5.6A2.4 2.4 0 0 0 13 4H6.4A2.4 2.4 0 0 0 4 6.4V13a2.4 2.4 0 0 0 1.6 2.3" />
    </svg>
  );
}

/** Chords tab indicator. */
export function ChordIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2}>
      <path d="M9.5 18V5.6l9-1.9V16" />
      <circle cx="6.7" cy="18" r="2.8" />
      <circle cx="15.7" cy="16" r="2.8" />
    </svg>
  );
}

/** Lyrics tab indicator. */
export function LyricsIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2}>
      <path d="M4.5 6.5h15M4.5 11h15M4.5 15.5h9" />
    </svg>
  );
}

/** Voice tab indicator. */
export function VoiceIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2}>
      <path d="M4 10.5v3M8.5 6.5v11M13 3.5v17M17.5 8v8M21.5 10.5v3" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.2}>
      <circle cx="12" cy="12" r="9.2" fill="currentColor" stroke="none" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="var(--bg)" />
    </svg>
  );
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.2}>
      <path d="M15 4.5L7.5 12l7.5 7.5" />
    </svg>
  );
}

export function EllipsisIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="12" r="1.85" />
      <circle cx="12" cy="12" r="1.85" />
      <circle cx="18.5" cy="12" r="1.85" />
    </svg>
  );
}

export function UndoIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 8.5h9.6a5.4 5.4 0 0 1 0 10.8H7" />
      <path d="M7.6 4.6L3.7 8.5l3.9 3.9" />
    </svg>
  );
}

export function RedoIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M20 8.5h-9.6a5.4 5.4 0 0 0 0 10.8H17" />
      <path d="M16.4 4.6l3.9 3.9-3.9 3.9" />
    </svg>
  );
}

export function CheckIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.4}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

/** Highlighter — a marker nib over its stroke. */
export function HighlightIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M8.4 14.6l-1.9 3.9 4.2-1.2 7.7-7.7a2.1 2.1 0 0 0-3-3l-7 8z" />
      <path d="M4 21h16" strokeWidth={2.6} />
    </svg>
  );
}

/** Font colour — a swatch. */
export function ColorIcon({ size = 19, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlayIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.4a.9.9 0 0 1 1.37-.77l9 6.6a.9.9 0 0 1 0 1.54l-9 6.6A.9.9 0 0 1 8 18.6z" />
    </svg>
  );
}

export function PauseIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6.4" y="5" width="3.9" height="14" rx="1.4" />
      <rect x="13.7" y="5" width="3.9" height="14" rx="1.4" />
    </svg>
  );
}

/** Jump back ten seconds — a loop running anticlockwise, with the count inside. */
export function Back10Icon({ size = 26, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={1.7}>
      <path d="M11.6 4.6A7.9 7.9 0 1 1 4.1 12" />
      <path d="M11.9 1.8 8.4 4.7l3.5 2.9" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="7.6"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        10
      </text>
    </svg>
  );
}

export function Forward10Icon({ size = 26, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={1.7}>
      <path d="M12.4 4.6A7.9 7.9 0 1 0 19.9 12" />
      <path d="M12.1 1.8l3.5 2.9-3.5 2.9" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontSize="7.6"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        10
      </text>
    </svg>
  );
}

/** Reorder grip — the bars you drag a section by. */
/** Picking several at once — the same mark the rows show, at menu size. */
export function SelectIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.4 12.2l2.5 2.5 4.7-4.9" />
    </svg>
  );
}

export function GripIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={1.9}>
      <path d="M5 8h14M5 12h14M5 16h14" />
    </svg>
  );
}

/** Add another take to an existing recording. */
export function PlusIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MicIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="9" y="2.6" width="6" height="11.4" rx="3" />
      <path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" />
      <path d="M12 18v3.2" />
    </svg>
  );
}

/** Selection indicator for multi-select. Filled with a tick when `on`. */
export function SelectDot({ on, size = 21 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="10.4"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.6}
        opacity={on ? 1 : 0.45}
      />
      {on && (
        <path
          d="M7.6 12.4l3 3 5.9-6.3"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
