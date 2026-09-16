export type RouteAction = "create" | "update" | "append";

export interface RouteResult {
  path: string;
  action: RouteAction;
  confidence: number;
  reason: string;
}

const DEFAULT_MODEL = "qwen2.5-coder:7b";
const DEFAULT_URL = "http://127.0.0.1:11434";
export const MAX_TREE_CHARS = 20_000;
export const MAX_CODE_CHARS = 12_000;
const ACTIONS: RouteAction[] = ["create", "update", "append"];

export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export async function routeWithOllama(opts: {
  tree: string;
  lang: string;
  hint: string;
  codeHead: string;
  model?: string;
  baseUrl?: string;
}): Promise<RouteResult> {
  const prompt = buildPrompt({
    tree: clip(opts.tree, MAX_TREE_CHARS),
    lang: opts.lang,
    hint: opts.hint,
    codeHead: clip(opts.codeHead, MAX_CODE_CHARS),
  });
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
  return validateRoute(extractJson(raw));
}

export function validateRoute(value: unknown): RouteResult {
  if (!value || typeof value !== "object") {
    throw new Error("resposta inválida do modelo");
  }
  const route = value as Record<string, unknown>;
  if (typeof route.path !== "string" || !route.path.trim()) {
    throw new Error("path ausente");
  }
  if (route.action === "delete") {
    throw new Error("o modelo não pode propor delete");
  }
  if (typeof route.action !== "string" || !ACTIONS.includes(route.action as RouteAction)) {
    throw new Error("ação inválida");
  }
  let confidence = 0;
  if (typeof route.confidence === "number" && Number.isFinite(route.confidence)) {
    confidence = Math.max(0, Math.min(1, route.confidence));
  }
  return {
    path: route.path.trim(),
    action: route.action as RouteAction,
    confidence,
    reason: typeof route.reason === "string" ? route.reason : "",
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
Não proponhas delete.

Árvore do projecto:
${opts.tree || "(vazia)"}

Bloco capturado:
- lang: ${opts.lang}
- hint de path: ${opts.hint || "nenhum"}
- primeiras linhas:
${opts.codeHead}`;
}
