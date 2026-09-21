import { describe, expect, it } from "vitest";
import { DEFAULT_FALLBACK_MODEL, DEFAULT_PRIMARY_MODEL, FREE_MODELS, normalizeModelId } from "../src/orchestrator/models";
import { normalizeSettings } from "../src/orchestrator/settings";

describe("AI Assisted modelos gratuitos", () => {
  it("default primário é Laguna S 2.1 :free", () => {
    expect(DEFAULT_PRIMARY_MODEL).toBe("poolside/laguna-s-2.1:free");
    expect(FREE_MODELS[0].id).toBe(DEFAULT_PRIMARY_MODEL);
  });

  it("só lista modelos :free na UI", () => {
    expect(FREE_MODELS.length).toBeGreaterThan(0);
    for (const m of FREE_MODELS) expect(m.id.endsWith(":free")).toBe(true);
  });

  it("fallback tem default diferente do primário", () => {
    expect(DEFAULT_FALLBACK_MODEL).not.toBe(DEFAULT_PRIMARY_MODEL);
  });

  it("normalizeSettings usa defaults quando vazio", () => {
    const s = normalizeSettings({});
    expect(s.primaryModel).toBe(DEFAULT_PRIMARY_MODEL);
    expect(s.fallbackModel).toBe(DEFAULT_FALLBACK_MODEL);
    expect(s.apiKey).toBe("");
    expect(s.mode).toBe("auto");
  });

  it("normalizeSettings aceita mode off", () => {
    expect(normalizeSettings({ mode: "off" }).mode).toBe("off");
    expect(normalizeSettings({ mode: "auto" }).mode).toBe("auto");
  });

  it("mode off força determinístico mesmo com chave", async () => {
    const { planBlock } = await import("../src/orchestrator/planner");
    const plan = await planBlock(
      {
        id: "1",
        language: "ts",
        path: "src/a.ts",
        action: "create",
        code: "x",
        source: "fence",
        platform: "qwen",
        capturedAt: 0,
      },
      [],
      {
        enabled: true,
        mode: "off",
        openrouterModel: DEFAULT_PRIMARY_MODEL,
        openrouterFallback: DEFAULT_FALLBACK_MODEL,
        openrouterKey: "sk-or-fake",
      },
    );
    expect(plan.warnings.some((w) => w.includes("modo off"))).toBe(true);
  });

  it("normalizeModelId aceita custom mas mantém fallback se vazio", () => {
    expect(normalizeModelId("", DEFAULT_PRIMARY_MODEL)).toBe(DEFAULT_PRIMARY_MODEL);
    expect(normalizeModelId("openai/gpt-5.6-sol", DEFAULT_PRIMARY_MODEL)).toBe("openai/gpt-5.6-sol");
  });
});
