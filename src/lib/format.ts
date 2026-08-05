/**
 * Date formatting for list rows, matching how iOS Notes / Voice Memos label
 * things: just the time today, "Yesterday", a weekday within the last week,
 * then a numeric date (dropping the year while it's the current one).
 */
export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();

  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

  if (dayDiff === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff > 1 && dayDiff < 7) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : '2-digit',
  });
}
