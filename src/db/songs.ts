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
import { deleteMemosForSong } from './memos';
import { openDB, wrap, SONGS } from './open';

/** How long a thrown-away song is kept before it goes for good. */
export const TRASH_DAYS = 30;
const TRASH_MS = TRASH_DAYS * 86_400_000;

async function readAll(): Promise<Song[]> {
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readonly');
  return wrap(tx.objectStore(SONGS).getAll() as IDBRequest<Song[]>);
}

/** Every song still in the list, newest activity first (how the list wants them). */
export async function getAllSongs(): Promise<Song[]> {
  const all = await readAll();
  return all.filter((s) => !s.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** The thrown-away ones, most recently thrown first. */
export async function getDeletedSongs(): Promise<Song[]> {
  const all = await readAll();
  return all
    .filter((s) => s.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
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

/**
 * Throws songs away without destroying them: they leave the list and turn up
 * in Recently Deleted, where they can be had back. Their recordings stay put —
 * a restored song with no voice notes would be a song half-deleted.
 */
export async function deleteSongs(ids: string[]): Promise<void> {
  const all = await readAll();
  const now = Date.now();
  await putSongs(
    all.filter((s) => ids.includes(s.id)).map((s) => ({ ...s, deletedAt: now })),
  );
}

/** Back into the list, where it left off. */
export async function restoreSongs(ids: string[]): Promise<void> {
  const all = await readAll();
  await putSongs(
    all
      .filter((s) => ids.includes(s.id))
      .map(({ deletedAt: _gone, ...song }) => song as Song),
  );
}

/** Gone for good, recordings and all. */
export async function purgeSongs(ids: string[]): Promise<void> {
  // Recordings must not outlive the song they belong to, or they sit in
  // storage forever with nothing able to reach them.
  await Promise.all(ids.map(deleteMemosForSong));
  const db = await openDB();
  const tx = db.transaction(SONGS, 'readwrite');
  const store = tx.objectStore(SONGS);
  await Promise.all(ids.map((id) => wrap(store.delete(id))));
}

/** Anything that has sat in Recently Deleted for its full term. */
export async function purgeExpired(): Promise<void> {
  const cutoff = Date.now() - TRASH_MS;
  const all = await readAll();
  const stale = all.filter((s) => s.deletedAt && s.deletedAt < cutoff).map((s) => s.id);
  if (stale.length) await purgeSongs(stale);
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
