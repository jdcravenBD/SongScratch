import { useCallback, useEffect, useState } from 'react';
import type { Chord, ChordSection, Song } from '../types';
import { getSong, putSong } from '../db/songs';
import { newId } from '../lib/id';

export interface ChordSections {
  sections: ChordSection[];
  add: () => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Move a section from one position in the stack to another. */
  reorder: (from: number, to: number) => Promise<void>;
  /** The section a chord is being picked for, or null when the picker is shut. */
  addingTo: string | null;
  startAdd: (sectionId: string) => void;
  cancelAdd: () => void;
  addChord: (sectionId: string, chord: Chord) => Promise<void>;
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
  const [addingTo, setAddingTo] = useState<string | null>(null);

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

  const addChord = useCallback(
    async (sectionId: string, chord: Chord) => {
      setAddingTo(null);
      await commit((current) =>
        current.map((s) =>
          s.id === sectionId ? { ...s, chords: [...s.chords, chord] } : s,
        ),
      );
    },
    [commit],
  );

  return {
    sections,
    add,
    rename,
    remove,
    reorder,
    addingTo,
    startAdd: setAddingTo,
    cancelAdd: () => setAddingTo(null),
    addChord,
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
