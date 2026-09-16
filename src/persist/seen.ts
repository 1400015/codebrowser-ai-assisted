import type { KeyValueStore } from "./kv";

const KEY = "seenIds";
const MAX = 1000;

export async function loadSeen(store: KeyValueStore): Promise<Set<string>> {
  const data = await store.get(KEY);
  const ids = (data[KEY] as string[] | undefined) ?? [];
  return new Set(ids);
}

export async function rememberSeen(
  store: KeyValueStore,
  seen: Set<string>,
  id: string,
): Promise<boolean> {
  if (seen.has(id)) return false;
  seen.add(id);
  const ids = [...seen].slice(-MAX);
  seen.clear();
  for (const item of ids) seen.add(item);
  await store.set({ [KEY]: ids });
  return true;
}
