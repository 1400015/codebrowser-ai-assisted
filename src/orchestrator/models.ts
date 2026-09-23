/** Catálogo de modelos gratuitos do OpenRouter para o CodeBrowser AI Assisted.
 * Só inclui variantes `:free`. O utilizador escolhe primário + fallback na UI.
 * A oferta `:free` do OpenRouter muda frequentemente: a UI tenta buscar a lista
 * em tempo real (fetchFreeModels) e usa esta lista curada como fallback offline.
 * Default primário: Laguna S 2.1 — rápido e estável para coding-agent.
 *
 * O que cada exportação deve produzir:
 * - FREE_MODELS: lista curada para exibir sem rede (com notas de decisão).
 * - fetchFreeModels: lista ao vivo, ordenada, sem chave API; lança em falha.
 * - normalizeModelId: sempre um id não-vazio; nunca lança (guarda de settings).
 */

export interface FreeModel {
  id: string;
  label: string;
  context: string;
  notes: string;
}

/** Bloco — lista curada. Verificada a 2026-09-22 contra GET /api/v1/models;
 * contextos reais da API. Ordem de exibição na UI (o primeiro é o primário
 * sugerido). Se um destes desaparecer da oferta `:free`, não rebenta nada:
 * o planner cai para o próximo da cadeia e o refresh live substitui a lista. */
export const FREE_MODELS: FreeModel[] = [
  {
    id: "poolside/laguna-s-2.1:free",
    label: "Laguna S 2.1 (default)",
    context: "256K",
    notes: "Coding-agent Poolside, tool-calling. Escolha padrão.",
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    label: "Laguna XS 2.1",
    context: "256K",
    notes: "Variante leve e rápida da família Laguna.",
  },
  {
    id: "z-ai/glm-5.2:free",
    label: "GLM 5.2 (default fallback)",
    context: "32K",
    notes: "Estável, uso geral e código. Fallback padrão.",
  },
  {
    id: "qwen/qwen3.8-27b:free",
    label: "Qwen3.8 27B",
    context: "256K",
    notes: "Família Qwen, forte em código.",
  },
  {
    id: "cohere/north-mini-code:free",
    label: "North Mini Code",
    context: "250K",
    notes: "Rápido, bom para iteração.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super",
    context: "256K",
    notes: "Bom para revisão / planeamento.",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra",
    context: "977K",
    notes: "Mais capaz em raciocínio, mas lento.",
  },
  {
    id: "thinkingmachines/inkling:free",
    label: "Inkling",
    context: "1M",
    notes: "Contexto enorme, modelo novo.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    context: "256K",
    notes: "Open-weight Google, uso geral.",
  },
];

export const DEFAULT_PRIMARY_MODEL = "poolside/laguna-s-2.1:free";
export const DEFAULT_FALLBACK_MODEL = "z-ai/glm-5.2:free";

/** Bloco — migração. IDs que já saíram da oferta `:free` e são re-mapeados
 * para os defaults ao carregar settings guardadas. Isto evita o cenário de
 * 2026-09-21: fallback default morto → 404 → tudo caía no determinístico.
 * Manter só enquanto existirem valores antigos em storage; limpar depois. */
const RETIRED_MODEL_IDS = new Set([
  "openai/gpt-oss-120b:free",
  "inclusionai/ling-3.0-flash:free",
]);

export function isKnownFreeModel(id: string): boolean {
  return FREE_MODELS.some((m) => m.id === id);
}

/** Bloco — guarda de normalização. Contrato: devolve SEMPRE um id não-vazio
 * e nunca lança. Vazio ou retirado → o fallback dado (default ou o parâmetro
 * do chamador). Ids desconhecidos passam (permite custom, incl. pago). */
export function normalizeModelId(raw: string | undefined, fallback: string): string {
  const id = (raw ?? "").trim();
  if (!id || RETIRED_MODEL_IDS.has(id)) return fallback;
  return id;
}

const DEFAULT_MODELS_URL = "https://openrouter.ai/api/v1";

interface OpenRouterModelInfo {
  id?: string;
  name?: string;
  context_length?: number;
}

/** Bloco — lista ao vivo. Busca GET /models (endpoint público, sem chave)
 * e deve produzir: só ids `:free`, ordenados alfabeticamente (determinismo
 * na UI), label sem o sufixo "(free)" do OpenRouter. Lança em HTTP != 200,
 * rede indisponível ou lista vazia — o chamador decide o fallback (a UI
 * mantém a lista curada e registra aviso; nunca deixa os selects vazios). */
export async function fetchFreeModels(baseUrl?: string): Promise<FreeModel[]> {
  const res = await fetch(`${baseUrl ?? DEFAULT_MODELS_URL}/models`);
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = (await res.json()) as { data?: OpenRouterModelInfo[] };
  const list = (data.data ?? [])
    .filter((m) => typeof m.id === "string" && m.id.endsWith(":free"))
    .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))
    .map((m) => ({
      id: m.id as string,
      label: (m.name ?? m.id ?? "").replace(/\s*\(free\)\s*$/i, "").trim(),
      context: humanizeContext(m.context_length),
      notes: "",
    }));
  if (!list.length) throw new Error("lista de modelos gratuitos vazia");
  return list;
}

/** Bloco — formatação de contexto. Convenção binária (1K = 1024 tokens):
 * 32768 → "32K", 262144 → "256K", 1048576 → "1M". Sem valor → "?" para a
 * UI nunca mostrar "undefinedK". */
export function humanizeContext(tokens: number | undefined): string {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) return "?";
  if (tokens >= 1024 * 1024) {
    const m = tokens / (1024 * 1024);
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(tokens / 1024)}K`;
}
