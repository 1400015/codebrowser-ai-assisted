import { clip, MAX_CODE_CHARS, MAX_TREE_CHARS, validateRoute, type RouteResult } from "./ollama";

const DEFAULT_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 45_000;

export interface OpenRouterRouteOpts {
  tree: string;
  lang: string;
  hint: string;
  codeHead: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  referer?: string;
}

/** Valida a chave sem gastar tokens: GET /auth/key. Devolve etiqueta da conta. */
export async function testOpenRouterKey(apiKey: string, baseUrl?: string): Promise<string> {
  const key = (apiKey ?? "").trim();
  if (!key) throw new Error("cola primeiro a chave API");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${baseUrl ?? DEFAULT_URL}/auth/key`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error("chave inválida (401/403)");
    if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
    const data = (await res.json()) as { data?: { label?: string; limit?: number | null } };
    const label = data.data?.label?.trim();
    return label ? `chave válida (${label})` : "chave válida";
  } finally {
    clearTimeout(timer);
  }
}

/** Rota via OpenRouter (OpenAI-compatible). Devolve o mesmo RouteResult do Ollama. */
export async function routeWithOpenRouter(opts: OpenRouterRouteOpts): Promise<RouteResult> {
  const key = (opts.apiKey ?? "").trim();
  if (!key) throw new Error("falta a chave API do OpenRouter");
  if (!opts.model.trim()) throw new Error("modelo OpenRouter em falta");

  const prompt = buildPrompt({
    tree: clip(opts.tree, MAX_TREE_CHARS),
    lang: opts.lang,
    hint: opts.hint,
    codeHead: clip(opts.codeHead, MAX_CODE_CHARS),
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${opts.baseUrl ?? DEFAULT_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": opts.referer ?? "https://github.com/codebrowser-ai-assisted",
        "X-Title": "CodeBrowser AI Assisted",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.1,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content: "Responde apenas JSON com path, action, confidence, reason.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return validateRoute(extractJson(content));
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("resposta sem JSON");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

function buildPrompt(opts: { tree: string; lang: string; hint: string; codeHead: string }): string {
  return `És o orquestrador de ficheiros do CodeBrowser AI Assisted.
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
