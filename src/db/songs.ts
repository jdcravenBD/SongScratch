/**
 * On-device persistence for songs, backed by IndexedDB.
 *
 * Why IndexedDB and not localStorage: voice recordings are audio blobs far
 * larger than localStorage's few-MB budget, and IndexedDB stores Blobs
 * natively. No server, no account — everything is on the device.
 *
 * The connection and schema live in ./open.
 */

import type { Song } from '../types';
import { newId } from '../lib/id';
import { openDB, wrap, SONGS } from './open';

/** Every song, newest activity first (how the list wants them). */
export async function getAllSongs(): Promise<Song[]> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readonly');
  const all = await wrap(tx.objectStore(SONGS).getAll() as IDBRequest<Song[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readonly');
  return wrap(tx.objectStore(SONGS).get(id) as IDBRequest<Song | undefined>);
}

export async function putSong(song: Song): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readwrite');
  await wrap(tx.objectStore(SONGS).put(song));
}

export async function putSongs(songs: Song[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readwrite');
  const store = tx.objectStore(SONGS);
  await Promise.all(songs.map((s) => wrap(store.put(s))));
}

export async function deleteSongs(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readwrite');
  const store = tx.objectStore(SONGS);
  await Promise.all(ids.map((id) => wrap(store.delete(id))));
}

export async function countSongs(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readonly');
  return wrap(tx.objectStore(SONGS).count());
}

/** A fresh, empty song ready to drop into the store. */
export function newSong(overrides: Partial<Song> = {}): Song {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
