/**
 * Voice memos, stored per song. Audio blobs go in as-is — this is the reason
 * the app was built on IndexedDB rather than localStorage in the first place.
 */

import type { Memo } from '../types';
import { openDB, wrap, MEMOS } from './open';

async function readForSong(songId: string): Promise<Memo[]> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readonly');
  const index = tx.objectStore(MEMOS).index('songId');
  return wrap(index.getAll(songId) as IDBRequest<Memo[]>);
}

/** Every memo for one song, oldest first — the order they were recorded in. */
export async function getMemos(songId: string): Promise<Memo[]> {
  const all = await readForSong(songId);
  return all.filter((m) => !m.deletedAt).sort((a, b) => a.createdAt - b.createdAt);
}

/** The thrown-away ones, most recently thrown first. */
export async function getDeletedMemos(songId: string): Promise<Memo[]> {
  const all = await readForSong(songId);
  return all
    .filter((m) => m.deletedAt)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

/** Thrown away, not destroyed — see Recently Deleted. */
export async function trashMemos(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readwrite');
  const store = tx.objectStore(MEMOS);
  const now = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const memo = await wrap(store.get(id) as IDBRequest<Memo | undefined>);
      if (memo) await wrap(store.put({ ...memo, deletedAt: now }));
    }),
  );
}

export async function restoreMemos(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readwrite');
  const store = tx.objectStore(MEMOS);
  await Promise.all(
    ids.map(async (id) => {
      const memo = await wrap(store.get(id) as IDBRequest<Memo | undefined>);
      if (!memo) return;
      const { deletedAt: _gone, ...rest } = memo;
      await wrap(store.put(rest as Memo));
    }),
  );
}

export async function purgeMemos(ids: string[]): Promise<void> {
  await Promise.all(ids.map(deleteMemo));
}

/** Anything that has sat in Recently Deleted for its full term. */
export async function purgeExpiredMemos(cutoff: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(MEMOS, 'readonly');
  const all = await wrap(tx.objectStore(MEMOS).getAll() as IDBRequest<Memo[]>);
  const stale = all.filter((m) => m.deletedAt && m.deletedAt < cutoff).map((m) => m.id);
  if (stale.length) await purgeMemos(stale);
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
