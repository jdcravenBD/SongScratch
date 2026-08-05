import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../types';
import {
  countSongs,
  deleteSongs as dbDelete,
  getAllSongs,
  newSong,
  putSong,
  putSongs,
} from '../db/songs';

const SEED_FLAG = 'ss-seeded';

/**
 * A few example songs on first ever launch, so the list shows the design
 * populated rather than empty. Guarded by a localStorage flag so it never runs
 * again — the user is free to delete them.
 *
 * Memoised as one shared promise so React StrictMode's double-invoked effect
 * awaits the *same* seeding run rather than racing it: without this the second
 * pass can read the store before the first pass's writes commit and render an
 * empty list.
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
  const min = 60_000;
  const day = 86_400_000;

  const demos: Array<Partial<Song> & { title: string; updatedAt: number }> = [
    {
      title: 'Yellow Letter',
      tuning: 'Open G',
      description: 'unsealed, on a porch a letter sat',
      pinned: true,
      chordCount: 5,
      sectionCount: 4,
      voiceCount: 2,
      updatedAt: now - 24 * min,
    },
    {
      title: 'Back Porch',
      tuning: 'Open G',
      description: 'Slow, fingerpicked. Verse idea only.',
      chordCount: 4,
      sectionCount: 1,
      voiceCount: 1,
      updatedAt: now - 3 * 60 * min,
    },
    {
      title: 'Raindrop',
      tuning: 'Standard',
      description: 'being able to mask your emotions',
      chordCount: 6,
      sectionCount: 3,
      updatedAt: now - day - 2 * 60 * min,
    },
    {
      title: 'Dropped',
      tuning: 'Drop D',
      description: 'Heavier chorus — needs a bridge.',
      chordCount: 3,
      sectionCount: 2,
      voiceCount: 4,
      updatedAt: now - 3 * day,
    },
    {
      title: 'Spring',
      tuning: 'DADGAD',
      description: 'written in the style of eyes without a face',
      sectionCount: 2,
      updatedAt: now - 5 * day,
    },
    {
      title: 'Bread',
      tuning: 'Standard',
      description: 'verse 1:',
      chordCount: 4,
      updatedAt: now - 12 * day,
    },
    {
      title: 'Underneath the Sun',
      tuning: 'Half step down',
      description: "broken tree's the autumn's turned",
      chordCount: 7,
      sectionCount: 5,
      voiceCount: 1,
      updatedAt: now - 46 * day,
    },
    {
      title: '',
      tuning: 'Standard',
      updatedAt: now - 74 * day,
    },
  ];

  await putSongs(
    demos.map((d) =>
      newSong({ ...d, createdAt: d.updatedAt - day, updatedAt: d.updatedAt }),
    ),
  );
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
