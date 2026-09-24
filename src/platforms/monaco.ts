/** Extracção de código de editores Monaco (VS Code) embutidos nas plataformas.
 *
 * Caso Qwen 2026-09-23 (confirmado por HTML gravado): os blocos de código são
 * um Monaco **virtualizado** — só as linhas visíveis existem no DOM (`view-line`
 * com classes `mtk*`, posicionadas fora de ordem visual) e o corpo tem
 * `height` de milhares de px. Reconstruir pelo DOM daria código parcial e
 * embaralhado. O código COMPLETO vive nas props do componente React que monta
 * o editor — acessível pela árvore de fibers do React em runtime.
 *
 * O nome da prop varia entre plataformas (Qwen não usa `value`): por isso a
 * busca é POR CONTEÚDO — uma linha visível do editor ("agulha") identifica a
 * prop string que contém o código completo. Guardas contra falsos positivos:
 * o candidato tem de ser bem maior que a agulha e NÃO pode conter fences
 * markdown (senão apanhamos a mensagem inteira, que também contém a linha).
 *
 * Detalhe: o elemento `.monaco-editor` é criado pelo Monaco de forma
 * imperativa (não tem fiber próprio) — `nearestFiber` sobe na árvore DOM até
 * encontrar um nó gerido pelo React (`__reactFiber$*`).
 *
 * Contrato: nunca lança. Sem React/fiber ou com walk falhado devolve [] e o
 * chamador segue para os selectores normais (o diagnóstico "mensagem
 * encontrada mas 0 blocos" dirá que a extracção Monaco falhou).
 */

export interface MonacoBlock {
  code: string;
  language?: string;
}

/** Caminho rápido sem agulha: props de código com nomes comuns. Exigimos
 * multiline para não apanhar props curtas irrelevantes. */
const CODE_PROPS = ["value", "defaultValue", "originalValue"] as const;
const MAX_FIBER_HOPS = 60;

/** Bloco — núcleo puro/testável. Com agulha: devolve a primeira prop string
 * que a contém, seja bem maior que ela e não tenha fences (modo por conteúdo,
 * independente do nome da prop). Sem agulha: primeira prop de código com nome
 * conhecido e multiline. null se nada. */
export function codeFromFiberChain(
  start: unknown,
  hops = MAX_FIBER_HOPS,
  needle?: string | null,
): string | null {
  type FiberNode = { return?: unknown; memoizedProps?: Record<string, unknown> };
  let node = start as FiberNode | null;
  let n = 0;
  while (node && n < hops) {
    const props = node.memoizedProps;
    if (props && typeof props === "object") {
      if (needle) {
        for (const v of Object.values(props)) {
          if (typeof v !== "string" || !v.includes(needle)) continue;
          // O código completo TEM de ter mais linhas além da agulha — mas o
          // tamanho absoluto não: snippets pequenos também são código.
          if (!v.includes("\n")) continue;
          if (v.includes("```")) continue; // markdown da mensagem, não código
          return v;
        }
      } else {
        for (const k of CODE_PROPS) {
          const v = props[k];
          if (typeof v === "string" && v.includes("\n") && v.trim().length >= 4) {
            return v;
          }
        }
      }
    }
    node = node.return as FiberNode | null;
    n++;
  }
  return null;
}

/** Bloco — agulha: a 1ª view-line legível do editor, com espaços não-quebráveis
 * (Monaco usa \u00A0 na indentação) normalizados. */
export function monacoNeedle(ed: HTMLElement): string | null {
  for (const line of ed.querySelectorAll<HTMLElement>(".view-line")) {
    const t = (line.textContent ?? "").replace(/\u00A0/g, " ").trim();
    if (t.length >= 8) return t.slice(0, 60);
  }
  return null;
}

/** Bloco — sobe no DOM (≤10 níveis) até achar um nó com fiber React. */
function nearestFiber(el: HTMLElement): unknown {
  let cur: HTMLElement | null = el;
  let n = 0;
  while (cur && n < 10) {
    const key = Object.keys(cur).find((k) => k.startsWith("__reactFiber$"));
    if (key) return (cur as unknown as Record<string, unknown>)[key];
    cur = cur.parentElement;
    n++;
  }
  return null;
}

/** Bloco — extrai TODOS os blocos Monaco dentro de `root`. Linguagem vem do
 * atributo `data-mode-id` do wrapper do Monaco (ex.: "html", "python"). */
export function extractMonacoBlocks(root: HTMLElement): MonacoBlock[] {
  const out: MonacoBlock[] = [];
  const seen = new Set<string>();
  for (const ed of root.querySelectorAll<HTMLElement>(".monaco-editor")) {
    const fiber = nearestFiber(ed);
    if (!fiber) continue;
    const needle = monacoNeedle(ed);
    const code = codeFromFiberChain(fiber, MAX_FIBER_HOPS, needle);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const lang = ed.closest("[data-mode-id]")?.getAttribute("data-mode-id") || undefined;
    out.push({ code, language: lang });
  }
  return out;
}
