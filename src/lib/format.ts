import type { Song } from '../types';

/**
 * Date labels for list rows, matching how iOS Notes / Voice Memos write them:
 * just the time today, "Yesterday", a weekday within the last week, then a
 * numeric date (dropping the year while it's the current one).
 */
export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = dayDiff(d, now);

  if (diff === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : '2-digit',
  });
}

/**
 * The full "last edited" line at the top of a song — e.g.
 * "August 6, 2026 at 1:12am". Lowercased and closed up around the meridiem,
 * which is how iOS writes it and not what toLocaleTimeString gives you.
 */
export function formatStamp(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = d
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\s+/g, '')
    .toLowerCase();
  return `${date} at ${time}`;
}

/** Whole days between two dates, ignoring the time of day. */
function dayDiff(a: Date, b: Date): number {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOf(b) - startOf(a)) / 86_400_000);
}

export interface SongSection {
  key: string;
  /** Empty for the main run of songs, which carries no heading. */
  label: string;
  songs: Song[];
}

/**
 * Splits pinned songs out to the top and leaves the rest as one unbroken run.
 *
 * Only "Pinned" earns a heading — it marks a choice the user made. The date
 * headings that used to sit here labelled something the row already says in its
 * own timestamp, and chopped a short list into more headings than songs.
 *
 * `songs` arrives newest-first, so both parts keep that order.
 */
export function groupSongs(songs: Song[]): SongSection[] {
  const out: SongSection[] = [];
  const pinned = songs.filter((s) => s.pinned);
  const rest = songs.filter((s) => !s.pinned);

  if (pinned.length) out.push({ key: 'pinned', label: 'Pinned', songs: pinned });
  if (rest.length) out.push({ key: 'rest', label: '', songs: rest });
  return out;
}
