/**
 * Small inline SVG icons, stroked in `currentColor` so they take the colour of
 * whatever text they sit next to. Kept deliberately spare to match the app.
 */
type IconProps = { size?: number; className?: string };

export function SearchIcon({ size = 17, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

/** New song — a clean pencil. */
export function ComposeIcon({ size = 21, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20.5l4.2-1.1L19 8.6a2.05 2.05 0 0 0-2.9-2.9L5.1 16.4 4 20.5z" />
      <path d="M14.6 7.2l2.9 2.9" />
    </svg>
  );
}

export function TrashIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** Selection indicator for multi-select. Filled with a tick when `on`. */
export function SelectDot({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={on ? 0 : 1.6}
        opacity={on ? 1 : 0.5}
      />
      {on && (
        <path
          d="M7.5 12.4l3 3 6-6.4"
          fill="none"
          stroke="var(--bg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
