import type { PlatformAdapter, PlatformConfig } from "../types/platform";
import chatgpt from "../../platforms/chatgpt.json";
import deepseek from "../../platforms/deepseek.json";
import grok from "../../platforms/grok.json";
import qwen from "../../platforms/qwen.json";
import { makeConfigAdapter } from "./generic";

/** Fonte da verdade da captura: os `platforms/*.json` (embutidos no bundle).
 * Quando uma plataforma muda a UI, actualiza-se o JSON — o código fica igual.
 * Cada config é validada à carga: falta um campo → o adapter não regista e
 * a extensão usa os fallbacks universais (toolbar/genérico). */
const CONFIGS: PlatformConfig[] = [chatgpt, grok, qwen, deepseek].filter(isValidConfig);

export const adapters: PlatformAdapter[] = CONFIGS.map((cfg) => makeConfigAdapter(cfg));

/** Adapter genérico sem hosts próprios — usado quando nenhuma config casa com
 * o host mas o manifest permitiu injectar o content script. Cobertura mínima
 * com selectores estilo ChatGPT + fallback da toolbar. */
export const fallbackAdapter: PlatformAdapter = makeConfigAdapter({
  id: "generic",
  name: "Genérico",
  hosts: [],
  assistant: ["[data-message-author-role='assistant']", "article", "pre"],
  streaming: ["[data-is-streaming='true']", "[data-streaming='true']"],
  composer: ["textarea", "[contenteditable='true']"],
  codeBlock: ["pre code"],
  languageLabel: ["pre [class*='language']"],
});

export function detectAdapter(url: URL, doc: Document): PlatformAdapter | null {
  return (
    adapters.find((a) => a.match(url, doc)) ??
    (fallbackAdapter.match(url, doc) ? fallbackAdapter : null)
  );
}

/** Bloco — validação de config. Deve devolver true só para configs completas:
 * todas as listas de selectores não-vazias e id/name presentes. Hosts pode
 * ser vazio (o adapter genérico usa assim). */
function isValidConfig(cfg: PlatformConfig): boolean {
  return Boolean(
    cfg.id &&
      cfg.name &&
      Array.isArray(cfg.hosts) &&
      cfg.assistant.length &&
      cfg.streaming.length &&
      cfg.composer.length &&
      cfg.codeBlock.length &&
      cfg.languageLabel.length,
  );
}
