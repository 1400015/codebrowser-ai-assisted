import { describe, expect, it } from "vitest";
import { applyPlan } from "../src/orchestrator/apply-plan";
import { deterministicPlan } from "../src/orchestrator/deterministic";
import type { CodeBlock } from "../src/types/block";
import { MemoryWorkspace } from "../src/workspace/memory";

function block(over: Partial<CodeBlock> = {}): CodeBlock {
  return {
    id: "1",
    language: "ts",
    path: "src/a.ts",
    action: "create",
    code: "export {}",
    source: "fence",
    platform: "chatgpt",
    capturedAt: 0,
    ...over,
  };
}

describe("applyPlan", () => {
  it("recusa path editado com traversal", async () => {
    const ws = new MemoryWorkspace();
    const b = block();
    const plan = deterministicPlan(b, []);
    const result = await applyPlan(ws, b, plan, "../secret.txt");
    expect(result.ok).toBe(false);
    expect(ws.snapshot()).toEqual({});
  });

  it("recusa plano inválido mesmo com path limpo", async () => {
    const ws = new MemoryWorkspace();
    const b = block({ path: "../x.ts" });
    const plan = deterministicPlan(b, []);
    expect(plan.valid).toBe(false);
    const result = await applyPlan(ws, b, plan, "src/ok.ts");
    expect(result.ok).toBe(false);
    expect(ws.snapshot()).toEqual({});
  });

  it("escreve create quando o path é seguro", async () => {
    const ws = new MemoryWorkspace();
    const b = block();
    const plan = deterministicPlan(b, []);
    const result = await applyPlan(ws, b, plan, "src/a.ts");
    expect(result.ok).toBe(true);
    expect(ws.snapshot()["src/a.ts"]).toBe("export {}");
  });

  it("pede confirmação se create encontra ficheiro existente", async () => {
    const ws = new MemoryWorkspace();
    ws.seed("src/a.ts", "old");
    const b = block();
    const plan = { ...deterministicPlan(b, []), action: "create" as const, warnings: [] };
    const blocked = await applyPlan(ws, b, plan, "src/a.ts");
    expect(blocked.ok).toBe(false);
    expect(blocked.needsOverwriteConfirm).toBe(true);
    expect(ws.snapshot()["src/a.ts"]).toBe("old");

    const written = await applyPlan(ws, b, plan, "src/a.ts", { confirmOverwrite: true });
    expect(written.ok).toBe(true);
    expect(ws.snapshot()["src/a.ts"]).toBe("export {}");
  });

  it("não apaga sem confirmação e recusa .git", async () => {
    const ws = new MemoryWorkspace();
    const b = block({ path: "src/a.ts", action: "delete" });
    const plan = deterministicPlan(b, ["src/a.ts"]);
    const pending = await applyPlan(ws, b, plan, "src/a.ts");
    expect(pending.needsDeleteConfirm).toBe(true);

    const git = await applyPlan(ws, b, { ...plan, action: "create", valid: true, errors: [] }, ".git/config");
    expect(git.ok).toBe(false);
  });

  it("Workspace em memória também recusa escrita e leitura directa insegura", async () => {
    const ws = new MemoryWorkspace();
    await expect(ws.writeFile("../x", "no")).rejects.toThrow();
    await expect(ws.deleteFile("/tmp/x")).rejects.toThrow();
    await expect(ws.readFile("../x")).rejects.toThrow();
    await expect(ws.readFile("src/missing.ts")).resolves.toBeNull();
  });
});
