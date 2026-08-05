/**
 * On-device persistence for songs, backed by IndexedDB.
 *
 * Why IndexedDB and not localStorage: voice recordings (added later) are audio
 * blobs far larger than localStorage's few-MB budget, and IndexedDB stores
 * Blobs natively. Keeping songs here from the start means the voice tab has
 * somewhere to live without a migration. No server, no account — everything is
 * on the device.
 */

import type { Song } from '../types';

const DB_NAME = 'song-scratch';
const DB_VERSION = 1;
const STORE = 'songs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Promisify a single IndexedDB request. */
function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Every song, newest activity first (how the list wants them). */
export async function getAllSongs(): Promise<Song[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  const all = await wrap(tx.objectStore(STORE).getAll() as IDBRequest<Song[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putSong(song: Song): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  await wrap(tx.objectStore(STORE).put(song));
}

export async function putSongs(songs: Song[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  await Promise.all(songs.map((s) => wrap(store.put(s))));
}

export async function deleteSongs(ids: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  await Promise.all(ids.map((id) => wrap(store.delete(id))));
}

export async function countSongs(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readonly');
  return wrap(tx.objectStore(STORE).count());
}

/** A fresh, empty song ready to drop into the store. */
export function newSong(overrides: Partial<Song> = {}): Song {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
