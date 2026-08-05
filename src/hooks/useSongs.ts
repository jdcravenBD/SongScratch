import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../types';
import {
  countSongs,
  deleteSongs as dbDelete,
  getAllSongs,
  newSong,
  putSong,
} from '../db/songs';

const SEED_FLAG = 'ss-seeded';

/**
 * A few example songs on first ever launch, so the list shows the design
 * populated rather than empty. Guarded by a localStorage flag so it never runs
 * again — the user is free to delete them.
 *
 * Memoised as one shared promise so React StrictMode's double-invoked effect
 * (and both effect passes) await the *same* seeding run rather than racing:
 * without this the second pass can read the store before the first pass's
 * writes commit and render an empty list.
 */
let seedPromise: Promise<void> | null = null;

function seedIfFirstRun(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG)) return;
  localStorage.setItem(SEED_FLAG, '1');
  if ((await countSongs()) > 0) return;

  const now = Date.now();
  const day = 86_400_000;
  const demos: Song[] = [
    {
      id: crypto.randomUUID(),
      title: 'Back Porch',
      tuning: 'Open G',
      description: 'Slow, fingerpicked. Verse idea only.',
      createdAt: now - 5 * day,
      updatedAt: now - 40 * 60_000,
    },
    {
      id: crypto.randomUUID(),
      title: 'Dropped',
      tuning: 'Drop D',
      description: 'Heavier chorus — needs a bridge.',
      createdAt: now - 3 * day,
      updatedAt: now - day,
    },
    {
      id: crypto.randomUUID(),
      title: 'Untitled',
      tuning: 'Standard',
      description: '',
      createdAt: now - 9 * day,
      updatedAt: now - 5 * day,
    },
  ];
  await Promise.all(demos.map(putSong));
}

export interface SongsApi {
  /** `null` while the store is still loading. */
  songs: Song[] | null;
  createSong: () => Promise<string>;
  deleteSongs: (ids: string[]) => Promise<void>;
  duplicateSongs: (ids: string[]) => Promise<void>;
}

export function useSongs(): SongsApi {
  const [songs, setSongs] = useState<Song[] | null>(null);

  const refresh = useCallback(async () => {
    setSongs(await getAllSongs());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await seedIfFirstRun();
      const all = await getAllSongs();
      if (alive) setSongs(all);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const createSong = useCallback(async () => {
    const song = newSong({ title: '' });
    await putSong(song);
    await refresh();
    return song.id;
  }, [refresh]);

  const deleteSongs = useCallback(
    async (ids: string[]) => {
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
          id: crypto.randomUUID(),
          title: s.title ? `${s.title} copy` : '',
          createdAt: now,
          updatedAt: now,
        }));
      await Promise.all(copies.map(putSong));
      await refresh();
    },
    [refresh],
  );

  return { songs, createSong, deleteSongs, duplicateSongs };
}
