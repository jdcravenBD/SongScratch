/**
 * Core data model. A Song is one "save": the three sections the user works in
 * (chords, lyrics, voice) are tabs inside it, never stored on their own. This
 * file holds only the top-level shape the song list needs; the per-tab detail
 * is filled in as those screens are built.
 */
export interface Song {
  id: string;
  /** May be empty while a song is brand new; the UI shows a placeholder then. */
  title: string;
  /** e.g. "Standard", "Drop D" — shown as the subheading in the lyric tab. */
  tuning?: string;
  /** One-line idea; doubles as the list preview under the title. */
  description?: string;
  createdAt: number;
  updatedAt: number;
}
