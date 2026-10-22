// Cab IRs you load from a file, kept in this browser (IndexedDB) so they
// are there after a reload and without the dev server. Every call fails
// soft: with storage blocked, an IR just isn't remembered.

import { migrated } from './migrate.ts';

const dbName = 'phreakguitar';
const store = 'irs';

interface SavedIR {
  name: string; // file name, also the key
  bytes: ArrayBuffer; // the file as loaded (decoded on use)
  added: number;
}

async function open(): Promise<IDBDatabase> {
  await migrated; // an older version's saved IRs are copied in first
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(store, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = op(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Names of the saved IRs, oldest first. */
export async function savedIRNames(): Promise<string[]> {
  try {
    const all = await run('readonly', (s) => s.getAll() as IDBRequest<SavedIR[]>);
    return all.sort((a, b) => a.added - b.added).map((ir) => ir.name);
  } catch {
    return [];
  }
}

export async function loadSavedIR(name: string): Promise<ArrayBuffer | null> {
  try {
    const ir = await run('readonly', (s) => s.get(name) as IDBRequest<SavedIR | undefined>);
    return ir?.bytes ?? null;
  } catch {
    return null;
  }
}

/** Saves (or replaces) an IR; false if the browser wouldn't store it. */
export async function saveIR(name: string, bytes: ArrayBuffer): Promise<boolean> {
  try {
    await run('readwrite', (s) => s.put({ name, bytes, added: Date.now() } satisfies SavedIR));
    return true;
  } catch {
    return false;
  }
}

export async function forgetIR(name: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(name));
  } catch {
    /* nothing to forget */
  }
}
