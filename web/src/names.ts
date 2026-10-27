// Your own names for the amps and pedals, kept only in this browser. With
// ?rename in the address the amp and the open pedal circuit get a Rename
// button; a blank name goes back to the built-in one.

const namesKey = 'phreakguitar.names.v1';

export const renameMode = new URLSearchParams(location.search).has('rename');

function load(): Record<string, string> {
  try {
    const names = JSON.parse(localStorage.getItem(namesKey) ?? '{}');
    return names && typeof names === 'object' ? names : {};
  } catch {
    return {};
  }
}

/** Gives each item the name you chose for it, if any. */
export function withNames<T extends { id: string; name: string }>(items: T[]): T[] {
  const names = load();
  for (const it of items) if (typeof names[it.id] === 'string' && names[it.id].trim()) it.name = names[it.id];
  return items;
}

/** Asks for a new name for `id` and reloads to show it everywhere. */
export function rename(id: string, current: string): void {
  const next = prompt(`Name (blank for the built-in one):`, current);
  if (next === null) return;
  const names = load();
  if (next.trim()) names[id] = next.trim();
  else delete names[id];
  try {
    localStorage.setItem(namesKey, JSON.stringify(names));
  } catch {
    return;
  }
  location.reload();
}
