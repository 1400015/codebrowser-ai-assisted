/** Heurística da toolbar de código — o sinal "isto é um bloco de código a sério".
 *
 * Racional (decisão 2026-09-23): as plataformas de chat renderizam cada bloco
 * de código com uma toolbar local (copiar / descarregar / executar). Esse padrão
 * é mais estável do que as classes da própria mensagem: os nomes de classe
 * mudam a cada redesign, mas o botão "copiar código" raramente desaparece.
 * Por isso a captura usa a toolbar como (a) reforço de detecção e (b) fallback
 * universal quando os selectores da plataforma falham.
 *
 * Afinado 2026-09-23 (tarde) após teste real no DeepSeek: a toolbar pode ser
 * só-ícones (SVG sem aria-label nem título) e as etiquetas podem estar em
 * chinês no DOM (复制/下载). A heurística agora olha também para `svg`/`use`
 * (href/class) e aceita sinais zh.
 *
 * Contrato das funções:
 * - isCopyDownloadLabel: pura, testável em node. true se o texto/atributo
 *   parecer um controlo de copiar/descarregar (pt + en + zh).
 * - hasCodeToolbar: dependente de DOM; true se o `pre` tiver uma toolbar com
 *   sinais de copiar/download por perto (irmãos anteriores ou pai próximo).
 * - findToolbarCodeBlocks: dependente de DOM; devolve TODOS os `pre` do root
 *   com toolbar — usar como fallback quando a mensagem não foi encontrada.
 */

import { deepQuerySelectorAll } from "../platforms/dom";

/** Palavras que aparecem em botões/aria-labels/classes de toolbars de código.
 * Manter minúsculo; a função normaliza antes de comparar. Inclui zh (复制=
 * copiar, 下载=descarregar) porque o DOM do DeepSeek pode estar localizado. */
const SIGNALS = [
  "copy code",
  "copiar código",
  "copiar codigo",
  "copiar",
  "copy",
  "download",
  "baixar",
  "descarregar",
  "salvar código",
  "save code",
  "复制",
  "下载",
  "executar",
  "code-block-copy",
  "copy-button",
  "clipboard",
];

/** Bloco — matcher puro da toolbar. Recebe os textos candidados (aria-label,
 * title, texto do botão, classes, href de ícone) e devolve true se algum casa
 * com um sinal de copiar/descarregar. Mínimo de 2 chars porque 复制/下载 têm
 * exactamente 2; o guard existe só para não casar strings vazias/1-char. */
export function isCopyDownloadLabel(label: string): boolean {
  const norm = label.trim().toLowerCase();
  if (norm.length < 2 || norm.length > 60) return false;
  return SIGNALS.some((s) => norm.includes(s));
}

/** Bloco — detecção em volta de um `pre`. Procura botões/links/ícones com
 * sinal de copiar/download nos irmãos anteriores do pre, no pai imediato ou
 * no avô (as toolbars vivem tipicamente num wrapper do pre). Os candidatos
 * incluem svg/use porque as toolbars só-ícones não têm texto. */
export function hasCodeToolbar(pre: Element): boolean {
  const scopes: Element[] = [];
  if (pre.previousElementSibling) scopes.push(pre.previousElementSibling);
  if (pre.parentElement) scopes.push(pre.parentElement);
  const grand = pre.parentElement?.parentElement;
  if (grand && grand !== document.body) scopes.push(grand);

  for (const scope of scopes) {
    const candidates = [
      ...scope.querySelectorAll<HTMLElement>(
        "button, a, [role='button'], svg, use, [class*='copy'], [class*='download']",
      ),
    ];
    if (scope instanceof HTMLElement && scope !== pre) candidates.push(scope);
    for (const el of candidates) {
      const texts = [
        el.getAttribute("aria-label") ?? "",
        el.title ?? "",
        el.getAttribute("href") ?? "",
        el.getAttribute("xlink:href") ?? "",
        el.className && typeof el.className === "string" ? el.className : "",
        el.tagName === "BUTTON" || el.tagName === "A" ? (el.textContent ?? "") : "",
      ];
      if (texts.some(isCopyDownloadLabel)) return true;
    }
  }
  return false;
}

/** Bloco — fallback universal. Devolve todos os `pre` do root que têm toolbar
 * de copiar/download (atravessa shadow roots). Usado quando os selectores da
 * plataforma não encontram a mensagem: mesmo com UI mudada, os blocos com
 * botão de copiar continuam a ser capturados (ideia do utilizador 2026-09-23,
 * após o DeepSeek falhar). */
export function findToolbarCodeBlocks(root: ParentNode): HTMLPreElement[] {
  const out: HTMLPreElement[] = [];
  for (const pre of deepQuerySelectorAll(root, "pre")) {
    if (pre instanceof HTMLPreElement && hasCodeToolbar(pre)) out.push(pre);
  }
  return out;
}

/** Bloco — container de código pela toolbar, SEM pre (caso DeepSeek 2026-09-23:
 * o "bloco de código" é um componente próprio com numeração de linhas, não um
 * `<pre>`; só a toolbar Copiar/Descarregar/Executar o marca). Para cada botão
 * com sinal, sobe até 6 níveis e devolve o ancestral mais pequeno com texto
 * substancial (>200 chars) — o cartão de código. Chamador passa estes
 * containers a extractBlocksFromElement em cardMode. */
export function findToolbarCodeContainers(root: ParentNode): HTMLElement[] {
  const out: HTMLElement[] = [];
  const seen = new Set<Element>();
  for (const btn of deepQuerySelectorAll(root, "button, a, [role='button']")) {
    const label = btn.getAttribute("aria-label") ?? (btn.textContent ?? "");
    if (!isCopyDownloadLabel(label)) continue;
    let el: HTMLElement | null = btn instanceof HTMLElement ? btn : btn.parentElement;
    for (let up = 0; el && up < 6; up++) {
      if ((el.textContent ?? "").length > 200) break;
      el = el.parentElement;
    }
    if (el && (el.textContent ?? "").length > 200 && !seen.has(el)) {
      seen.add(el);
      out.push(el);
    }
  }
  return out;
}
