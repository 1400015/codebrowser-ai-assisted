import type { HistoryEntry } from "../types/status";
import type { KeyValueStore } from "./kv";

const KEY = "history";
const MAX = 200;

export async function appendHistory(
  store: KeyValueStore,
  entry: HistoryEntry,
): Promise<void> {
  const data = await store.get(KEY);
  const prev = (data[KEY] as HistoryEntry[] | undefined) ?? [];
  const next = [...prev, entry].slice(-MAX);
  await store.set({ [KEY]: next });
}

export async function listHistory(store: KeyValueStore): Promise<HistoryEntry[]> {
  const data = await store.get(KEY);
  return ((data[KEY] as HistoryEntry[] | undefined) ?? []).slice();
}
