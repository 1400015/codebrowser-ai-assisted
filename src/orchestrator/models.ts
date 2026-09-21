/** Lista curada de modelos gratuitos do OpenRouter para o CodeBrowser AI Assisted.
 * Só inclui variantes `:free`. O utilizador escolhe primário + fallback na UI.
 * Default primário: Laguna S 2.1 — rápido e estável para coding-agent.
 */

export interface FreeModel {
  id: string;
  label: string;
  context: string;
  notes: string;
}

export const FREE_MODELS: FreeModel[] = [
  {
    id: "poolside/laguna-s-2.1:free",
    label: "Laguna S 2.1 (default)",
    context: "262K",
    notes: "Coding-agent Poolside, tool-calling. Escolha padrão.",
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    label: "Laguna XS 2.1",
    context: "262K",
    notes: "Variante leve e rápida da família Laguna.",
  },
  {
    id: "openai/gpt-oss-120b:free",
    label: "GPT-OSS 120B",
    context: "131K",
    notes: "Open-weight, output completo, bom fallback estável.",
  },
  {
    id: "cohere/north-mini-code:free",
    label: "North Mini Code",
    context: "256K",
    notes: "Mais rápido (~69 tok/s), bom para iteração.",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra",
    context: "1M",
    notes: "Mais capaz em raciocínio, mas lento e promo.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super",
    context: "262K",
    notes: "Bom para revisão / planeamento.",
  },
  {
    id: "inclusionai/ling-3.0-flash:free",
    label: "Ling 3.0 Flash",
    context: "262K",
    notes: "Rápido, uso geral.",
  },
];

export const DEFAULT_PRIMARY_MODEL = "poolside/laguna-s-2.1:free";
export const DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-120b:free";

export function isKnownFreeModel(id: string): boolean {
  return FREE_MODELS.some((m) => m.id === id);
}

export function normalizeModelId(raw: string | undefined, fallback: string): string {
  const id = (raw ?? "").trim();
  if (!id) return fallback;
  // Aceita qualquer id (inclui custom pago), mas a UI só lista :free.
  return id;
}
