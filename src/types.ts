/**
 * Core data model. A Song is one "save": the three sections the user works in
 * (chords, lyrics, voice) are tabs inside it, never stored on their own.
 *
 * The per-tab content itself lands here as those screens are built. The counts
 * below are what the list needs to show at a glance which parts of a song
 * actually have something in them, so they live on the record rather than being
 * derived by loading every song's full contents just to draw a list.
 */
export interface Song {
  id: string;
  /** May be empty while a song is brand new; the list shows a placeholder. */
  title: string;
  /** e.g. "Standard", "Drop D" — the subheading in the lyric tab. */
  tuning?: string;
  /** One-line idea; doubles as the list preview under the title. */
  description?: string;
  /** Pinned songs sort into their own section at the top. */
  pinned?: boolean;
  /** How many chords are saved in the chord tab. */
  chordCount?: number;
  /** How many lyric sections (verse, chorus…) exist. */
  sectionCount?: number;
  /** How many voice memos are attached. */
  voiceCount?: number;
  createdAt: number;
  updatedAt: number;
}
