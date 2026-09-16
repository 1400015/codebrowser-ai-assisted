import { describe, expect, it } from "vitest";
import { deterministicPlan } from "../src/orchestrator/deterministic";
import type { CodeBlock } from "../src/types/block";

describe("deterministicPlan.valid", () => {
  it("fica inválido quando o path original tem erros", () => {
    const block: CodeBlock = {
      id: "1",
      language: "ts",
      path: "../oops.ts",
      action: "create",
      code: "x",
      source: "xml",
      platform: "grok",
      capturedAt: 0,
    };
    const plan = deterministicPlan(block, []);
    expect(plan.errors.length).toBeGreaterThan(0);
    expect(plan.valid).toBe(false);
    expect(plan.valid).toBe(plan.errors.length === 0);
  });

  it("fica válido para um path relativo normal", () => {
    const plan = deterministicPlan(
      {
        id: "1",
        language: "ts",
        path: "src/ok.ts",
        action: "create",
        code: "x",
        source: "fence",
        platform: "qwen",
        capturedAt: 0,
      },
      [],
    );
    expect(plan.valid).toBe(true);
    expect(plan.errors).toEqual([]);
  });
});
