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
  /**
   * The lyric tab's document, as HTML. It holds the whole hierarchy — title,
   * tuning, description, then each section with its chords and lines — because
   * the user edits all of it as one rich-text document rather than as fields.
   * `title`, `description` and `sectionCount` above are mirrored back out of it
   * on save so the song list never has to parse this to draw a row.
   */
  lyrics?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * One continuous take.
 *
 * A memo is a list of these rather than a single file because MediaRecorder
 * cannot append to a recording it has already finished — every container it
 * closes is complete and immutable. Adding to an old memo therefore means
 * recording a new take and playing the takes back in order, which is what makes
 * "carry on where I left off" possible at all.
 */
export interface Segment {
  blob: Blob;
  /** Seconds, measured while recording — see lib/audio for why not from the file. */
  duration: number;
  /** Loudness samples for drawing the waveform, 0–1, captured as it recorded. */
  peaks: number[];
}

/** A voice note belonging to exactly one song. */
export interface Memo {
  id: string;
  /** The song this belongs to. Indexed — a memo is never shown outside its song. */
  songId: string;
  /** "Untitled" until the user names it. */
  name: string;
  /** Pinned memos sort to the top of the song's list. */
  pinned?: boolean;
  mimeType: string;
  segments: Segment[];
  createdAt: number;
  updatedAt: number;
}
