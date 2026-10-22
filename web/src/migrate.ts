// One-time moves for data saved by earlier versions, run before anything
// reads storage: the storage keys and databases of the old name (PhreakRig)
// move to PhreakGuitar's, and amps, pedals and effects saved under their
// old ids get their current ones. Every step is idempotent and fails soft.

// Ids renamed since earlier versions (old -> new).
const renamed: Record<string, string> = {};
const id = (x: unknown) => (typeof x === 'string' && renamed[x]) || x;
const keys = <T>(o: Record<string, T> | undefined) =>
  o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [id(k) as string, v])) : o;

type Json = Record<string, unknown>;
type Slot = { id?: string } | null;

function migratePresetLike(p: Json): Json {
  return {
    ...p,
    amp: id(p.amp),
    pedals: Array.isArray(p.pedals) ? (p.pedals as Slot[]).map((s) => (s ? { ...s, id: id(s.id) } : s)) : p.pedals,
    fx: keys(p.fx as Record<string, unknown>),
  };
}

function migrateSettings(s: Json): Json {
  return {
    ...s,
    amp: id(s.amp),
    ampKnobs: keys(s.ampKnobs as Record<string, unknown>),
    board: Array.isArray(s.board) ? (s.board as Slot[]).map((b) => (b ? { ...b, id: id(b.id) } : b)) : s.board,
    pedalKnobs: keys(s.pedalKnobs as Record<string, unknown>),
    fx: keys(s.fx as Record<string, unknown>),
  };
}

function moveKey(from: string, to: string, fix: (v: unknown) => unknown): void {
  try {
    const raw = localStorage.getItem(to) ?? localStorage.getItem(from);
    if (raw === null) return;
    localStorage.setItem(to, JSON.stringify(fix(JSON.parse(raw))));
  } catch {
    // unreadable or storage blocked: start fresh
  }
}

/** Copies an IndexedDB store from an old database into a new, empty one. */
async function copyDb(from: string, to: string, store: string, keyPath: string): Promise<void> {
  if (!('indexedDB' in globalThis) || !indexedDB.databases) return;
  const names = (await indexedDB.databases()).map((d) => d.name);
  if (!names.includes(from) || names.includes(to)) return;
  const open = (name: string) => new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, { keyPath }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const src = await open(from);
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const r = src.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  src.close();
  const dst = await open(to);
  await new Promise<void>((resolve, reject) => {
    const tx = dst.transaction(store, 'readwrite');
    for (const row of rows) tx.objectStore(store).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  dst.close();
}

async function migrate(): Promise<void> {
  moveKey('phreakrig.settings.v1', 'phreakguitar.settings.v1', (v) => migrateSettings(v as Json));
  moveKey('phreakrig.presets.v1', 'phreakguitar.presets.v1',
    (v) => (Array.isArray(v) ? (v as Json[]).map(migratePresetLike) : v));
  moveKey('phreakrig.pedals.v1', 'phreakguitar.pedals.v1',
    (v) => (Array.isArray(v) ? (v as Json[]).map((p) => ({ ...p, parent: id(p.parent) })) : v));
  moveKey('phreakrig.tabs.v1', 'phreakguitar.tabs.v1', (v) => v);
  try {
    await copyDb('phreakrig', 'phreakguitar', 'irs', 'name');
    await copyDb('phreakrig-tabs', 'phreakguitar-tabs', 'files', 'name');
  } catch {
    // not copied: those files can be opened again
  }
}

/** Started as this module loads (it's imported first, before anything
    reads storage); the IR and tab stores wait for it before opening their
    databases. */
export const migrated: Promise<void> = migrate();
