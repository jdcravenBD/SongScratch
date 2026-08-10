import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../types';
import { newId } from '../lib/id';
import {
  deleteSongs as dbDelete,
  getAllSongs,
  newSong,
  putSong,
  putSongs,
} from '../db/songs';

/**
 * "New Song", then "New Song 2"… counted from the highest already in use, so
 * deleting one doesn't hand its name to the next song made. Matches how the
 * chord sections and the voice memos number their own untitled ones.
 */
function nextSongTitle(existing: Song[]): string {
  let highest = 0;
  for (const song of existing) {
    const match = /^New Song(?: (\d+))?$/i.exec(song.title.trim());
    if (match) highest = Math.max(highest, match[1] ? Number(match[1]) : 1);
  }
  return highest === 0 ? 'New Song' : `New Song ${highest + 1}`;
}

export interface SongsApi {
  /** `null` while the store is still loading. */
  songs: Song[] | null;
  createSong: () => Promise<string>;
  deleteSongs: (ids: string[]) => Promise<void>;
  duplicateSongs: (ids: string[]) => Promise<void>;
  /** Pins or unpins every id; `pinned` omitted flips each one. */
  setPinned: (ids: string[], pinned?: boolean) => Promise<void>;
}

/** `refreshKey` changes when something outside this list has changed one of
    its songs — a restore out of Recently Deleted, for instance. */
export function useSongs(refreshKey = 0): SongsApi {
  const [songs, setSongs] = useState<Song[] | null>(null);

  const refresh = useCallback(async () => {
    setSongs(await getAllSongs());
  }, []);

  // Not on the first pass: the load below already reads the store, and the old
  // list stays on screen until the new one lands rather than blanking.
  useEffect(() => {
    if (refreshKey) void refresh();
  }, [refreshKey, refresh]);

  /**
   * A new install opens on an empty list — no sample songs. What is in here is
   * the user's, all of it. If the store can't be read at all, show the empty
   * list rather than nothing: a screen stuck on "loading" has no way out.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await getAllSongs();
        if (alive) setSongs(all);
      } catch {
        if (alive) setSongs([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const createSong = useCallback(async () => {
    // Named from the store rather than from state, which can be a beat behind
    // two songs made in quick succession and would name them both the same.
    const song = newSong({ title: nextSongTitle(await getAllSongs()) });
    await putSong(song);
    await refresh();
    return song.id;
  }, [refresh]);

  const deleteSongs = useCallback(
    async (ids: string[]) => {
      // Thrown away, not destroyed — they go to Recently Deleted, recordings
      // and all, and are only really gone once they age out of it.
      await dbDelete(ids);
      await refresh();
    },
    [refresh],
  );

  const duplicateSongs = useCallback(
    async (ids: string[]) => {
      const current = await getAllSongs();
      const now = Date.now();
      const copies = current
        .filter((s) => ids.includes(s.id))
        .map<Song>((s) => ({
          ...s,
          id: newId(),
          title: s.title ? `${s.title} copy` : '',
          pinned: false,
          createdAt: now,
          updatedAt: now,
        }));
      await putSongs(copies);
      await refresh();
    },
    [refresh],
  );

  const setPinned = useCallback(
    async (ids: string[], pinned?: boolean) => {
      const current = await getAllSongs();
      const next = current
        .filter((s) => ids.includes(s.id))
        // Pinning is not an edit to the song, so updatedAt is left alone —
        // otherwise pinning would reshuffle the date sections underneath.
        .map<Song>((s) => ({ ...s, pinned: pinned ?? !s.pinned }));
      await putSongs(next);
      await refresh();
    },
    [refresh],
  );

  return { songs, createSong, deleteSongs, duplicateSongs, setPinned };
}
