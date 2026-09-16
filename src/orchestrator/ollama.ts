export interface RouteResult {
  path: string;
  action: "create" | "update" | "append";
  confidence: number;
  reason: string;
}

const DEFAULT_MODEL = "qwen2.5-coder:7b";
const DEFAULT_URL = "http://127.0.0.1:11434";

export async function routeWithOllama(opts: {
  tree: string;
  lang: string;
  hint: string;
  codeHead: string;
  model?: string;
  baseUrl?: string;
}): Promise<RouteResult> {
  const prompt = buildPrompt(opts);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${opts.baseUrl ?? DEFAULT_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_predict: 256 },
        messages: [
          {
            role: "system",
            content: "Responde apenas JSON com path, action, confidence, reason.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return parseRoute(data.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

export function parseRoute(raw: string): RouteResult {
  const json = extractJson(raw);
  const action =
    json.action === "update" || json.action === "append" || json.action === "create"
      ? json.action
      : "create";
  return {
    path: String(json.path ?? ""),
    action,
    confidence: Number(json.confidence ?? 0.5),
    reason: String(json.reason ?? ""),
  };
}

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("resposta sem JSON");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function buildPrompt(opts: {
  tree: string;
  lang: string;
  hint: string;
  codeHead: string;
}): string {
  return `És o orquestrador de ficheiros do CodeBrowser.
Responde APENAS JSON válido:
{"path":"caminho/relativo.ext","action":"create"|"update"|"append","confidence":0.0,"reason":"uma frase"}

Árvore do projecto:
${opts.tree || "(vazia)"}

Bloco capturado:
- lang: ${opts.lang}
- hint de path: ${opts.hint || "nenhum"}
- primeiras linhas:
${opts.codeHead}`;
}
