import type { RawBlock } from "../types/block";
import { extractPathHint } from "../capture/parsers/path-hints";
import { parseXmlMarkers } from "../capture/parsers/xml-markers";
import { parseMarkdownFences } from "../capture/parsers/markdown-fences";
import { extractMonacoBlocks } from "./monaco";

/** Bloco — querySelectorAll que atravessa shadow roots. Plataformas novas
 * (DeepSeek 2026) renderizam mensagens/código em custom elements com
 * ShadowDOM; o querySelectorAll comum não vê lá dentro. Custo: varre todos
 * os elementos à procura de shadowRoot — aceitável porque o scan só corre
 * quando o DOM está estável (600 ms sem mutações). */
export function deepQuerySelectorAll(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [...root.querySelectorAll(selector)];
  const walk = (node: ParentNode): void => {
    for (const el of node.querySelectorAll("*")) {
      if (el.shadowRoot) {
        out.push(...el.shadowRoot.querySelectorAll(selector));
        walk(el.shadowRoot);
      }
    }
  };
  walk(root);
  return out;
}

/** Extrai blocos de qualquer raiz (mensagem, `pre` com toolbar, body).
 * Ordem de tentativa — a primeira que produz blocos ganha:
 * 1. marcadores XML (contrato preferido, tem path explícito);
 * 2. selectores `codeBlock` da config da plataforma (ex.: `pre code`);
 * 3. `pre code` genérico (fallback clássico);
 * 4. fences markdown do texto (último recurso).
 * A linguagem vem da classe `language-*` (mais fiável) e só depois dos
 * selectores `languageLabel` da config (texto visível, ex.: DeepSeek). */
export function extractBlocksFromElement(
  root: HTMLElement,
  codeBlockSelectors?: string[],
  languageLabelSelectors?: string[],
  deep = false,
  cardMode = false,
): RawBlock[] {
  const text = root.innerText || root.textContent || "";
  const xml = parseXmlMarkers(text);
  if (xml.length) return xml;

  // Monaco (Qwen 2026-09-23): código completo nas props React — o DOM está
  // virtualizado e fora de ordem, nunca extrair Monaco pelo texto.
  const monaco = extractMonacoBlocks(root);
  if (monaco.length) {
    return monaco.map((m) => ({
      language: m.language || "text",
      explicitPath: extractPathHint(m.code),
      code: m.code,
      source: "dom" as const,
    }));
  }

  // cardMode: root veio do fallback da toolbar (cartão de código sem pre).
  // A extracção por texto tem de vir primeiro e SÓ aqui — em mensagens normais
  // seria apanhar prosa como "código".
  if (cardMode) {
    const card = extractCodeFromCardText(text);
    if (card) {
      return [
        {
          language: card.language ?? "text",
          explicitPath: extractPathHint(card.code),
          code: card.code,
          source: "dom",
        },
      ];
    }
  }

  const selectors = [...(codeBlockSelectors ?? []), "pre code"];
  const fromDom: RawBlock[] = [];
  for (const sel of selectors) {
    const nodes = deep ? deepQuerySelectorAll(root, sel) : [...root.querySelectorAll(sel)];
    nodes.forEach((node) => {
      const code = (node.textContent || "").replace(/\s+$/, "");
      if (code.trim().length < 4) return;
      // Classe language-* primeiro (fiável); label de texto só se não houver
      // classe. Tentamos a raiz E o contentor do próprio bloco (ex.: DeepSeek
      // põe o banner com a linguagem dentro do cartão do pre).
      const lang =
        langFromClass(node) ||
        langFromClass(node.parentElement) ||
        langFromLabel(root, languageLabelSelectors ?? []) ||
        (node.parentElement ? langFromLabel(node.parentElement, languageLabelSelectors ?? []) : undefined);
      // Evita duplicar o mesmo bloco quando dois selectores casam o mesmo node.
      if (fromDom.some((b) => b.code === code)) return;
      fromDom.push({
        language: lang || "text",
        explicitPath: extractPathHint(code),
        code,
        source: "dom",
      });
    });
    if (fromDom.length) break;
  }
  if (fromDom.length) return fromDom;
  return parseMarkdownFences(text);
}

/** Bloco — extracção por texto do cartão (pura, testável em node). O innerText
 * de um cartão de código tipicamente começa com a etiqueta da linguagem
 * ("html") seguida dos botões da toolbar ("Copiar", "Descarregar", "Executar").
 * Deve produzir: linguagem = etiqueta curta sem pontuação; código = tudo o que
 * sobra depois de saltar essas linhas de cabeçalho. null se não sobrar código. */
export function extractCodeFromCardText(text: string): { code: string; language?: string } | null {
  const lines = text.split("\n").map((l) => l.trim());
  let i = 0;
  let language: string | undefined;
  if (lines[0] && /^[a-z0-9+#.\-]{1,24}$/i.test(lines[0])) {
    language = lines[0].toLowerCase();
    i = 1;
  }
  while (i < lines.length && (TOOLBAR_LINE.test(lines[i]) || lines[i] === "")) i++;
  const code = lines.slice(i).join("\n").replace(/\s+$/, "");
  if (code.length < 4) return null;
  return { code, language };
}

const TOOLBAR_LINE = /^(copiar|copy|descarregar|download|baixar|executar|run)\.?$/i;

/** Linguagem pela classe `language-xxx` no code/parent (padrão highlight.js). */
function langFromClass(el: Element | null): string | undefined {
  if (!el) return undefined;
  const cls = el.getAttribute("class") || "";
  const m = cls.match(/language-([A-Za-z0-9_+#.\-]+)/);
  return m?.[1]?.toLowerCase();
}

/** Linguagem pelo texto de um label da config (ex.: `pre span` no DeepSeek,
 * onde o primeiro span dentro do pre diz a linguagem). Só o primeiro selector
 * que existir conta; texto vazio/longo não é linguagem. */
function langFromLabel(root: HTMLElement, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    const t = el?.textContent?.trim().toLowerCase() ?? "";
    if (t && t.length <= 24 && /^[a-z0-9+#.\-_]+$/.test(t)) return t;
  }
  return undefined;
}
