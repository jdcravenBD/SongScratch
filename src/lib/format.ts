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

/** Whole days between two dates, ignoring the time of day. */
function dayDiff(a: Date, b: Date): number {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOf(b) - startOf(a)) / 86_400_000);
}

export interface SongSection {
  key: string;
  label: string;
  songs: Song[];
}

/**
 * Buckets songs into the sections the list draws, in order: pinned first, then
 * by recency the way Notes does it — Today, Yesterday, the last week, the last
 * month, then month by month.
 *
 * Sections are only emitted when they have something in them, so the list never
 * shows an empty heading.
 */
export function groupSongs(songs: Song[]): SongSection[] {
  const now = new Date();
  const pinned: Song[] = [];
  const buckets = new Map<string, SongSection>();

  const push = (key: string, label: string, song: Song) => {
    let section = buckets.get(key);
    if (!section) {
      section = { key, label, songs: [] };
      buckets.set(key, section);
    }
    section.songs.push(song);
  };

  for (const song of songs) {
    if (song.pinned) {
      pinned.push(song);
      continue;
    }
    const d = new Date(song.updatedAt);
    const diff = dayDiff(d, now);

    if (diff <= 0) push('today', 'Today', song);
    else if (diff === 1) push('yesterday', 'Yesterday', song);
    else if (diff < 7) push('week', 'Previous 7 Days', song);
    else if (diff < 30) push('month', 'Previous 30 Days', song);
    else {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString([], {
        month: 'long',
        year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      });
      push(key, label, song);
    }
  }

  const out: SongSection[] = [];
  if (pinned.length) out.push({ key: 'pinned', label: 'Pinned', songs: pinned });
  // `songs` arrives newest-first, so insertion order is already the order we
  // want the date sections in.
  out.push(...buckets.values());
  return out;
}
