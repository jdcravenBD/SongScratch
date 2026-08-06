/**
 * The one IndexedDB connection, shared by every store.
 *
 * Songs and memos live in the same database, so the schema — and therefore the
 * version number and the upgrade path — has to be owned in one place rather
 * than raced between two modules each opening it with their own idea of it.
 */

const DB_NAME = 'song-scratch';
/** v2 added the `memos` store. */
const DB_VERSION = 2;

export const SONGS = 'songs';
export const MEMOS = 'memos';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // Written as "create if absent" rather than as a chain of version steps,
      // so a fresh install and an upgrade from v1 both land in the same place.
      if (!db.objectStoreNames.contains(SONGS)) {
        db.createObjectStore(SONGS, { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
      }
      if (!db.objectStoreNames.contains(MEMOS)) {
        // Indexed by song: the voice tab only ever asks for one song's memos.
        db.createObjectStore(MEMOS, { keyPath: 'id' }).createIndex('songId', 'songId');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Promisify a single IndexedDB request. */
export function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
