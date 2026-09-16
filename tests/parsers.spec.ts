import { describe, expect, it } from "vitest";
import { parseCapturedText, parseMarkdownFences, parseXmlMarkers } from "../src/capture/parsers";
import { extractPathHint } from "../src/capture/parsers/path-hints";
import { parseRoute } from "../src/orchestrator/ollama";
import { deterministicPlan } from "../src/orchestrator/deterministic";
import { jailPath } from "../src/orchestrator/path-jail";
import type { CodeBlock } from "../src/types/block";

describe("xml markers", () => {
  it("lê lang, file e action", () => {
    const text = `<code-block lang="python" file="app.py" action="create">
print("hi")
</code-block>`;
    const [b] = parseXmlMarkers(text);
    expect(b.language).toBe("python");
    expect(b.explicitPath).toBe("app.py");
    expect(b.actionHint).toBe("create");
    expect(b.code).toContain('print("hi")');
    expect(b.source).toBe("xml");
  });
});

describe("markdown fences", () => {
  it("lê linguagem e path hint", () => {
    const text = "```ts\n// file: src/api/users.ts\nexport const n = 1;\n```";
    const [b] = parseMarkdownFences(text);
    expect(b.language).toBe("ts");
    expect(b.explicitPath).toBe("src/api/users.ts");
    expect(b.code).toContain("export const n");
  });
});

describe("merge", () => {
  it("XML ganha e não duplica o mesmo corpo", () => {
    const text = `
<code-block lang="ts" file="a.ts" action="update">
const x = 1;
</code-block>

\`\`\`ts
const x = 1;
\`\`\`
`;
    const blocks = parseCapturedText(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe("xml");
    expect(blocks[0].explicitPath).toBe("a.ts");
  });
});

describe("path hints", () => {
  it("aceita # file: e // file:", () => {
    expect(extractPathHint("# file: models.py\nclass A: pass")).toBe("models.py");
    expect(extractPathHint("// file: ./src/x.ts\n")).toBe("src/x.ts");
  });
});

describe("jail", () => {
  it("rejeita traversal e absolutos", () => {
    expect(jailPath("../etc/passwd", "ok.txt").errors.length).toBeGreaterThan(0);
    expect(jailPath("/tmp/x", "ok.txt").errors.length).toBeGreaterThan(0);
    expect(jailPath("src/app.ts", "ok.txt").path).toBe("src/app.ts");
  });
});

describe("deterministic plan", () => {
  it("promove create a update se o ficheiro existe", () => {
    const block: CodeBlock = {
      id: "1",
      language: "ts",
      path: "src/a.ts",
      action: "create",
      code: "export {}",
      source: "fence",
      platform: "chatgpt",
      capturedAt: 0,
    };
    const plan = deterministicPlan(block, ["src/a.ts"]);
    expect(plan.action).toBe("update");
  });
});

describe("ollama json extract", () => {
  it("aceita texto à volta do JSON", () => {
    const r = parseRoute('claro\n{"path":"app.py","action":"create","confidence":0.8,"reason":"ok"}\n');
    expect(r.path).toBe("app.py");
    expect(r.action).toBe("create");
  });
});
