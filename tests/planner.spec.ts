import { describe, expect, it } from "vitest";
import { deterministicPlan } from "../src/orchestrator/deterministic";
import { mergeRouted } from "../src/orchestrator/planner";
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

describe("mergeRouted confiança", () => {
  const base = deterministicPlan(
    {
      id: "1",
      language: "ts",
      path: "src/local.ts",
      action: "create",
      code: "x",
      source: "fence",
      platform: "qwen",
      capturedAt: 0,
    },
    [],
  );

  it("ignora o modelo abaixo de 0.3", () => {
    const plan = mergeRouted(base, [], {
      path: "src/model.ts",
      action: "update",
      confidence: 0.2,
      reason: "talvez",
    });
    expect(plan.path).toBe("src/local.ts");
    expect(plan.fromModel).toBe(false);
    expect(plan.warnings.some((w) => w.includes("determinístico"))).toBe(true);
  });

  it("usa o modelo com aviso entre 0.3 e 0.55", () => {
    const plan = mergeRouted(base, [], {
      path: "src/model.ts",
      action: "create",
      confidence: 0.4,
      reason: "ok",
    });
    expect(plan.path).toBe("src/model.ts");
    expect(plan.fromModel).toBe(true);
    expect(plan.warnings.some((w) => w.includes("confiança baixa"))).toBe(true);
  });
});
