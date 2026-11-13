/**
 * Local-only key-value persistence. IndexedDB first, localStorage when
 * IndexedDB is missing or blocked (some private-browsing modes). Nothing in
 * this file, or anywhere else in the app, talks to a network.
 */
const DB_NAME = 'fin-modeler';
const STORE = 'kv';
const LS_PREFIX = 'fin-modeler:';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function lsGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or disabled: nothing else to fall back to */
  }
}

function lsDel(key: string): void {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (db) {
    try {
      const v = await tx<T | undefined>(db, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
      if (v !== undefined) return v;
    } catch {
      /* fall through to localStorage */
    }
  }
  return lsGet<T>(key);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, 'readwrite', (s) => s.put(value, key));
      lsDel(key);
      return;
    } catch {
      /* fall through */
    }
  }
  lsSet(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await tx(db, 'readwrite', (s) => s.delete(key));
    } catch {
      /* ignore */
    }
  }
  lsDel(key);
}

/** Which backend is in use, for the privacy panel. */
export async function storageBackend(): Promise<'IndexedDB' | 'localStorage'> {
  return (await openDb()) ? 'IndexedDB' : 'localStorage';
}

/** Synchronous settings store. Small, non-financial preferences and the lock config. */
export const prefs = {
  get: lsGet,
  set: lsSet,
  del: lsDel,
};
