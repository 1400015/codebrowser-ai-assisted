import { describe, expect, it } from "vitest";
import { assertSafePath, inspectPath, jailPath } from "../src/orchestrator/path-jail";

describe("inspectPath", () => {
  it("aceita paths relativos normais e .env", () => {
    expect(inspectPath("src/app.ts").errors).toEqual([]);
    expect(inspectPath(".env").errors).toEqual([]);
    expect(inspectPath(".gitignore").errors).toEqual([]);
    expect(inspectPath(".github/workflows/ci.yml").errors).toEqual([]);
  });

  it("rejeita traversal e absolutos", () => {
    expect(inspectPath("../secret.txt").errors.length).toBeGreaterThan(0);
    expect(inspectPath("src/../../x").errors.length).toBeGreaterThan(0);
    expect(inspectPath("/tmp/x").errors.length).toBeGreaterThan(0);
    expect(inspectPath("C:\\temp\\x").errors.length).toBeGreaterThan(0);
    expect(inspectPath("~/project").errors.length).toBeGreaterThan(0);
  });

  it("rejeita segmentos vazios e paths de directório", () => {
    expect(inspectPath("src//file.ts").errors.length).toBeGreaterThan(0);
    expect(inspectPath("src/./file.ts").errors.length).toBeGreaterThan(0);
    expect(inspectPath("").errors.length).toBeGreaterThan(0);
    expect(inspectPath("src/").errors.length).toBeGreaterThan(0);
  });

  it("rejeita .git e node_modules, não outros dotfiles", () => {
    expect(inspectPath(".git/config").errors.some((e) => e.includes("reservado"))).toBe(true);
    expect(inspectPath("node_modules/leftpad/index.js").errors.length).toBeGreaterThan(0);
    expect(inspectPath(".env.local").errors).toEqual([]);
  });

  it("rejeita nomes reservados Windows e controlo", () => {
    expect(inspectPath("CON").errors.length).toBeGreaterThan(0);
    expect(inspectPath("src/nul.txt").errors.length).toBe(0);
    expect(inspectPath("src/NUL").errors.length).toBeGreaterThan(0);
    expect(inspectPath("a/\u0000b.ts").errors.length).toBeGreaterThan(0);
  });
});

describe("assertSafePath", () => {
  it("lança em traversal e devolve o path limpo se válido", () => {
    expect(() => assertSafePath("../x")).toThrow(/traversal/);
    expect(assertSafePath("./src/a.ts")).toBe("src/a.ts");
  });
});

describe("jailPath", () => {
  it("substitui por fallback quando o raw é inválido", () => {
    const r = jailPath("../x", "ok.ts");
    expect(r.path).toBe("ok.ts");
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
