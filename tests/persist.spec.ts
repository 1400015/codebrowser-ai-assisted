import { describe, expect, it } from "vitest";
import { appendHistory, listHistory } from "../src/persist/history";
import { MemoryStore } from "../src/persist/kv";
import { loadSeen, rememberSeen } from "../src/persist/seen";

describe("seenIds", () => {
  it("deduplica e sobrevive a um reload do store", async () => {
    const store = new MemoryStore();
    const seen = await loadSeen(store);
    expect(await rememberSeen(store, seen, "a")).toBe(true);
    expect(await rememberSeen(store, seen, "a")).toBe(false);
    const again = await loadSeen(store);
    expect(again.has("a")).toBe(true);
    expect(await rememberSeen(store, again, "a")).toBe(false);
  });
});

describe("history", () => {
  it("guarda só metadados", async () => {
    const store = new MemoryStore();
    await appendHistory(store, {
      blockId: "1",
      path: "src/a.ts",
      action: "create",
      platform: "chatgpt",
      status: "written",
      ts: 1,
    });
    const rows = await listHistory(store);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("code");
  });
});
