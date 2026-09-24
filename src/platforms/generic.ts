import type { ComposerHandle, PlatformAdapter, PlatformConfig } from "../types/platform";
import { deepQuerySelectorAll, extractBlocksFromElement } from "./dom";
import { findToolbarCodeBlocks, findToolbarCodeContainers } from "../capture/toolbar";

/** Bloco — fábrica de adapters a partir de PlatformConfig.
 * Semântica dos selectores: listas tentadas por ordem, o primeiro que casa
 * ganha; nenhum casa → fallback descrito em cada método. Hosts vazios = o
 * adapter casa com qualquer host (último recurso, ver registry). */
export function makeConfigAdapter(cfg: PlatformConfig): PlatformAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    match(url) {
      if (!cfg.hosts.length) return true;
      return cfg.hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
    },
    findComposer(doc) {
      for (const sel of cfg.composer) {
        const el = doc.querySelector(sel);
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLElement) {
          return wrapComposer(el as HTMLElement);
        }
      }
      return null;
    },
    /** Ordem: (1) selectores da config (atravessam shadow roots); (2) `pre`
     * com toolbar de copiar/download; (3) cartões de código pela toolbar SEM
     * pre (caso DeepSeek 2026-09-23: bloco é componente próprio com numeração
     * de linhas — só os botões Copiar/Descarregar/Executar o marcam); (4)
     * último recurso — todos os `pre` (melhor capturar a mais: o popup de
     * aprovação filtra ruído — do que ficar mudo). */
    findAssistantMessages(doc) {
      for (const sel of cfg.assistant) {
        const elems = deepQuerySelectorAll(doc, sel).filter(
          (n): n is HTMLElement => n instanceof HTMLElement,
        );
        if (elems.length) return elems;
      }
      const toolbar = findToolbarCodeBlocks(doc);
      if (toolbar.length) return toolbar;
      const cards = findToolbarCodeContainers(doc);
      if (cards.length) return cards;
      return deepQuerySelectorAll(doc, "pre").filter(
        (n): n is HTMLElement => n instanceof HTMLElement,
      );
    },
    extractCodeBlocks(messageRoot, opts) {
      // Selector profundo: mensagens dentro de shadow roots também extraiem.
      return extractBlocksFromElement(
        messageRoot,
        cfg.codeBlock,
        cfg.languageLabel,
        true,
        opts?.cardMode ?? false,
      );
    },
    isStreaming(messageRoot) {
      return cfg.streaming.some((sel) => Boolean(messageRoot.querySelector(sel)));
    },
  };
}

export function wrapComposer(el: HTMLElement): ComposerHandle {
  return {
    element: el,
    getText() {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
      return el.innerText;
    },
    setText(text: string) {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        const proto = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        );
        proto?.set?.call(el, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      el.focus();
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  };
}
