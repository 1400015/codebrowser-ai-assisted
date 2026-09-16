import { describe, expect, it } from "vitest";
import { clip, parseRoute, validateRoute } from "../src/orchestrator/ollama";

describe("validateRoute", () => {
  it("aceita um objecto válido e faz clamp da confiança", () => {
    const r = validateRoute({
      path: " app.py ",
      action: "create",
      confidence: 2,
      reason: "ok",
    });
    expect(r.path).toBe("app.py");
    expect(r.confidence).toBe(1);
  });

  it("rejeita path vazio, acção inválida e delete", () => {
    expect(() => validateRoute({ path: "", action: "create", confidence: 0.5 })).toThrow(/path/);
    expect(() => validateRoute({ path: "a.ts", action: "explode", confidence: 0.5 })).toThrow(/ação/);
    expect(() => validateRoute({ path: "a.ts", action: "delete", confidence: 0.9 })).toThrow(/delete/);
  });

  it("confiança negativa vai a 0", () => {
    expect(validateRoute({ path: "a.ts", action: "update", confidence: -1 }).confidence).toBe(0);
  });
});

describe("parseRoute", () => {
  it("extrai JSON rodeado de texto", () => {
    const r = parseRoute('claro\n{"path":"app.py","action":"create","confidence":0.8,"reason":"ok"}\n');
    expect(r.path).toBe("app.py");
    expect(r.action).toBe("create");
  });
});

describe("clip", () => {
  it("corta por caracteres", () => {
    expect(clip("abcd", 3)).toBe("abc");
    expect(clip("ab", 3)).toBe("ab");
  });
});
