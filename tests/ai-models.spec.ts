import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_PRIMARY_MODEL,
  FREE_MODELS,
  fetchFreeModels,
  humanizeContext,
  normalizeModelId,
} from "../src/orchestrator/models";
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

  it("defaults (primário e fallback) estão na lista curada", () => {
    expect(FREE_MODELS.some((m) => m.id === DEFAULT_FALLBACK_MODEL)).toBe(true);
    expect(FREE_MODELS.some((m) => m.id === DEFAULT_PRIMARY_MODEL)).toBe(true);
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

  it("migra modelos retirados da oferta :free para os defaults", () => {
    expect(normalizeModelId("openai/gpt-oss-120b:free", DEFAULT_FALLBACK_MODEL)).toBe(DEFAULT_FALLBACK_MODEL);
    expect(normalizeModelId("inclusionai/ling-3.0-flash:free", DEFAULT_PRIMARY_MODEL)).toBe(DEFAULT_PRIMARY_MODEL);
    const s = normalizeSettings({
      primaryModel: DEFAULT_PRIMARY_MODEL,
      fallbackModel: "openai/gpt-oss-120b:free",
    });
    expect(s.fallbackModel).toBe(DEFAULT_FALLBACK_MODEL);
  });

  it("humanizeContext mostra K/M legíveis", () => {
    expect(humanizeContext(32768)).toBe("32K");
    expect(humanizeContext(262144)).toBe("256K");
    expect(humanizeContext(1048576)).toBe("1M");
    expect(humanizeContext(undefined)).toBe("?");
    expect(humanizeContext(0)).toBe("?");
  });

  describe("fetchFreeModels", () => {
    const payload = {
      data: [
        { id: "z-ai/glm-5.2:free", name: "Z.ai: GLM 5.2 (free)", context_length: 32768 },
        { id: "poolside/laguna-s-2.1:free", name: "Poolside: Laguna S 2.1 (free)", context_length: 262144 },
        { id: "openai/gpt-oss-120b", name: "OpenAI: GPT-OSS 120B", context_length: 131072 },
      ],
    };

    function stubFetch(body: unknown, status = 200): void {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(body), { status })),
      );
    }

    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    it("filtra :free, ordena e limpa o label", async () => {
      stubFetch(payload);
      const list = await fetchFreeModels();
      expect(list.map((m) => m.id)).toEqual([
        "poolside/laguna-s-2.1:free",
        "z-ai/glm-5.2:free",
      ]);
      expect(list[0].label).toBe("Poolside: Laguna S 2.1");
      expect(list[0].context).toBe("256K");
    });

    it("lança em HTTP != 200 e em lista vazia", async () => {
      stubFetch({ error: "boom" }, 500);
      await expect(fetchFreeModels()).rejects.toThrow("OpenRouter HTTP 500");
      stubFetch({ data: [{ id: "openai/gpt-oss-120b", name: "x" }] });
      await expect(fetchFreeModels()).rejects.toThrow("vazia");
    });
  });
});
