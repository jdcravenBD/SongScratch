import { useCallback, useEffect, useState } from 'react';
import type { Chord, ChordSection, Song } from '../types';
import { getSong, putSong } from '../db/songs';
import { newId } from '../lib/id';

/** What the picker is open for, or null when it is shut. */
export interface Picking {
  sectionId: string;
  /** The chord being changed; null when a new one is being added. */
  chord: Chord | null;
}

/**
 * Where a held chord sits on screen, so its menu can grow out of it. Measured
 * against the screen rather than the window — on desktop the app is inside a
 * phone-shaped frame partway across the page.
 */
export interface ChordAnchor {
  /** The middle of the chord, horizontally. */
  x: number;
  top: number;
  bottom: number;
}

export interface HeldChord {
  sectionId: string;
  chord: Chord;
  at: ChordAnchor;
}

export interface ChordSections {
  sections: ChordSection[];
  add: () => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Move a section from one position in the stack to another. */
  reorder: (from: number, to: number) => Promise<void>;
  /** Empties the tab — offered from the editor's menu. */
  clearAll: () => Promise<void>;
  picking: Picking | null;
  startAdd: (sectionId: string) => void;
  startEdit: (sectionId: string, chord: Chord) => void;
  cancelPick: () => void;
  /** Puts the picker's chord back — in place when editing, at the end when new. */
  savePick: (chord: Chord) => Promise<void>;
  removeChord: (sectionId: string, chordId: string) => Promise<void>;
  /** The chord being held down, and where, or null when no menu is open. */
  held: HeldChord | null;
  hold: (held: HeldChord) => void;
  release: () => void;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  revealedId: string | null;
  setRevealedId: (id: string | null) => void;
}

/**
 * The chord tab's sections, which live on the song record itself — they are a
 * handful of small objects, unlike voice memos, so they need no store of their
 * own.
 *
 * Every write is a read-modify-write against the store rather than against
 * component state: the lyric tab is saving to the same record on its own timer,
 * and a stale snapshot here would quietly undo whatever it had just written.
 */
export function useChordSections(songId: string, enabled: boolean): ChordSections {
  const [sections, setSections] = useState<ChordSection[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [held, setHeld] = useState<HeldChord | null>(null);

  const refresh = useCallback(async () => {
    const song = await getSong(songId);
    setSections(song?.chordSections ?? []);
  }, [songId]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  /** Apply a change to the song's sections and write it back. */
  const commit = useCallback(
    async (change: (current: ChordSection[]) => ChordSection[]) => {
      const song = await getSong(songId);
      if (!song) return;
      const next = change(song.chordSections ?? []);
      const updated: Song = {
        ...song,
        chordSections: next,
        chordCount: next.reduce((n, s) => n + s.chords.length, 0),
        updatedAt: Date.now(),
      };
      await putSong(updated);
      setSections(next);
    },
    [songId],
  );

  const add = useCallback(async () => {
    const section: ChordSection = { id: newId(), name: 'Untitled', chords: [] };
    await commit((current) => [...current, sectionNamed(section, current)]);
    setExpandedId(section.id);
  }, [commit]);

  const rename = useCallback(
    (id: string, name: string) =>
      commit((current) => current.map((s) => (s.id === id ? { ...s, name } : s))),
    [commit],
  );

  const remove = useCallback(
    async (id: string) => {
      setExpandedId((cur) => (cur === id ? null : cur));
      setRevealedId(null);
      await commit((current) => current.filter((s) => s.id !== id));
    },
    [commit],
  );

  const clearAll = useCallback(async () => {
    setExpandedId(null);
    setRevealedId(null);
    await commit(() => []);
  }, [commit]);

  const reorder = useCallback(
    (from: number, to: number) =>
      commit((current) => {
        if (from === to || from < 0 || from >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
        return next;
      }),
    [commit],
  );

  /**
   * The one way a chord gets written. A chord keeps its id through an edit, so
   * the same call either replaces it where it stands or adds a new one at the
   * end — the picker never has to know which it was doing.
   */
  const savePick = useCallback(
    async (chord: Chord) => {
      const target = picking?.sectionId;
      setPicking(null);
      if (!target) return;
      await commit((current) =>
        current.map((s) => {
          if (s.id !== target) return s;
          const at = s.chords.findIndex((c) => c.id === chord.id);
          if (at === -1) return { ...s, chords: [...s.chords, chord] };
          const chords = [...s.chords];
          chords[at] = chord;
          return { ...s, chords };
        }),
      );
    },
    [commit, picking],
  );

  const removeChord = useCallback(
    (sectionId: string, chordId: string) =>
      commit((current) =>
        current.map((s) =>
          s.id === sectionId
            ? { ...s, chords: s.chords.filter((c) => c.id !== chordId) }
            : s,
        ),
      ),
    [commit],
  );

  return {
    sections,
    add,
    rename,
    remove,
    reorder,
    clearAll,
    picking,
    startAdd: (sectionId: string) => setPicking({ sectionId, chord: null }),
    startEdit: (sectionId: string, chord: Chord) => setPicking({ sectionId, chord }),
    cancelPick: () => setPicking(null),
    savePick,
    removeChord,
    held,
    hold: setHeld,
    release: () => setHeld(null),
    expandedId,
    setExpandedId,
    revealedId,
    setRevealedId,
  };
}

/**
 * "Untitled", then "Untitled 2"… numbered from the highest already in use, so
 * deleting one doesn't hand its name to the next section made.
 */
function sectionNamed(section: ChordSection, existing: ChordSection[]): ChordSection {
  let highest = 0;
  for (const s of existing) {
    const match = /^Untitled(?: (\d+))?$/.exec(s.name.trim());
    if (match) highest = Math.max(highest, match[1] ? Number(match[1]) : 1);
  }
  return { ...section, name: highest === 0 ? 'Untitled' : `Untitled ${highest + 1}` };
}
