'use client';

/**
 * Storage for the clips you cut yourself in the Clip Studio.
 *
 * IndexedDB rather than localStorage because these are audio blobs — a few
 * hundred KB each, which localStorage cannot hold and would have to base64 if
 * it could. Clips live in the browser that made them and survive reloads;
 * nothing is uploaded anywhere.
 *
 * The audio is stored already trimmed and as WAV. Cutting once at save time
 * means play time is a plain decode with no seeking, no re-trimming and no
 * dependence on whether the browser can still decode the original container.
 */

export interface ClipMeta {
  id: string;
  name: string;
  emoji: string;
  /** Where it came from — the file name, or the scene it was re-cut from. */
  from: string;
  seconds: number;
  createdAt: number;
}

export interface StoredClip extends ClipMeta {
  blob: Blob;
}

const DB_NAME = 'quiz-arena-mimic';
const STORE = 'clips';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser has no IndexedDB, so clips cannot be saved.'));
  }
  if (!dbPromise) {
    const attempt = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Could not open the clip store.'));
    });
    // A failed open should not poison every later attempt — private windows
    // sometimes succeed on a second try.
    attempt.catch(() => { dbPromise = null; });
    dbPromise = attempt;
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Clip store request failed.'));
      }),
  );
}

export const clipId = () =>
  `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function saveClip(clip: StoredClip): Promise<void> {
  await run('readwrite', (s) => s.put(clip) as IDBRequest<IDBValidKey>);
}

/** Metadata only — the blobs stay in the database until something plays them. */
export async function listClips(): Promise<ClipMeta[]> {
  const all = await run<StoredClip[]>('readonly', (s) => s.getAll() as IDBRequest<StoredClip[]>);
  return all
    .map(({ blob, ...meta }) => { void blob; return meta; })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getClip(id: string): Promise<StoredClip | null> {
  const row = await run<StoredClip | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredClip | undefined>);
  return row ?? null;
}

export async function deleteClip(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

export async function renameClip(id: string, name: string, emoji: string): Promise<void> {
  const row = await getClip(id);
  if (!row) return;
  await saveClip({ ...row, name, emoji });
}
