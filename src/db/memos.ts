/**
 * Voice memos, stored per song. Audio blobs go in as-is — this is the reason
 * the app was built on IndexedDB rather than localStorage in the first place.
 */

import type { Memo } from '../types';
import { openDB, wrap, MEMOS } from './open';

/** Every memo for one song, oldest first — the order they were recorded in. */
export async function getMemos(songId: string): Promise<Memo[]> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readonly');
  const index = tx.objectStore(MEMOS).index('songId');
  const all = await wrap(index.getAll(songId) as IDBRequest<Memo[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putMemo(memo: Memo): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readwrite');
  await wrap(tx.objectStore(MEMOS).put(memo));
}

export async function deleteMemo(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readwrite');
  await wrap(tx.objectStore(MEMOS).delete(id));
}

/** Used when a song is deleted, so its recordings don't outlive it. */
export async function deleteMemosForSong(songId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readwrite');
  const store = tx.objectStore(MEMOS);
  const keys = await wrap(store.index('songId').getAllKeys(songId));
  await Promise.all(keys.map((k) => wrap(store.delete(k))));
}
