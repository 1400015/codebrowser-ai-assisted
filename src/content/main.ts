import { createWatchdog } from "../capture/watchdog";
import { extractPathHint } from "../capture/parsers/path-hints";
import { guessLanguage, looksLikeCode } from "../capture/parsers/language-guess";
import { isCopyDownloadLabel } from "../capture/toolbar";
import { detectAdapter } from "../platforms/registry";
import { deepQuerySelectorAll } from "../platforms/dom";
import type { RawBlock } from "../types/block";

/** Conta shadow roots abertos em toda a página (profundidade máx. 6). */
function deepCountShadowRoots(root: Document | ShadowRoot, depth = 0): number {
  if (depth > 6) return 0;
  let n = 0;
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) n += 1 + deepCountShadowRoots(el.shadowRoot, depth + 1);
  }
  return n;
}

/** Captura universal via clipboard (2026-09-23).
 * O código dos editores Monaco virtualizados (Qwen) só existe nas props
 * React — mas quando o utilizador copia (botão "Copiar" do bloco ou Ctrl+C),
 * o texto COMPLETO passa pela clipboard. Duas vias:
 * 1. CustomEvent "cb:copy" — despachado pelo hook MAIN-world
 *    (inject/clipboard-hook.ts), que embrulha navigator.clipboard.writeText
 *    (o botão "Copiar" NÃO dispara evento copy — bug real do teste 19:5x).
 * 2. Evento "copy" nativo (Ctrl+C em selecções): durante o evento,
 *    getData() devolve VAZIO por spec (modo copy só aceita setData) — a
 *    fonte fiável é a selecção no momento.
 * Corre fora do gate do adapter: vale em qualquer host. */
function captureCopiedText(text: string): void {
  if (!looksLikeCode(text)) return;
  chrome.runtime
    .sendMessage({
      type: "RAW_CAPTURE",
      payload: {
        platform: adapter?.id ?? location.hostname,
        url: location.href,
        blocks: [
          {
            language: guessLanguage(text),
            explicitPath: extractPathHint(text),
            code: text,
            source: "copy",
          },
        ],
      },
    })
    .catch(() => undefined);
}

document.addEventListener("cb:copy", (e: Event) => {
  const text = (e as CustomEvent<string>).detail;
  if (typeof text === "string") captureCopiedText(text);
});

document.addEventListener(
  "copy",
  () => {
    const sel = document.getSelection()?.toString() ?? "";
    if (sel) captureCopiedText(sel);
  },
  true,
);

const adapter = detectAdapter(new URL(location.href), document);

/** Diagnóstico — o content script nunca deve ficar mudo. Mas o aviso só faz
 * sentido quando há evidência de que o utilizador JÁ pediu uma resposta:
 * num chat vazio ("Como posso ajudar?") zero mensagens é o normal. Por isso
 * um keydown de Enter no compositor arma `awaitingAnswer` e só aí o scan
 * com 0 mensagens avisa. Se mensagens aparecerem, o estado re-arma para a
 * resposta seguinte poder voltar a avisar. Falso positivo corrigido a
 * 2026-09-23 (disparava ao abrir chat novo no Qwen). */
let warnedNoMessages = false;
let warnedNoBlocks = false;
let awaitingAnswer = false;
let answerTimer: ReturnType<typeof setTimeout> | undefined;
/** Última mutação vista — usada para desbloquear streams "presos" (indicador
 * presente mas DOM parado = a geração já acabou e o sinal não foi limpo). */
let lastMutation = Date.now();

document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const t = e.target as HTMLElement | null;
    const isComposer =
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable);
    if (!isComposer) return;
    awaitingAnswer = true;
    if (answerTimer) clearTimeout(answerTimer);
    // Janela generosa: respostas longas demoram; o scan estável dispara antes.
    answerTimer = setTimeout(() => (awaitingAnswer = false), 60_000);
  },
  true,
);

if (adapter) {
  // 600 ms sem mutações = resposta estável. Sem isto cada token gera RAW_CAPTURE.
  const watchdog = createWatchdog(600, scan);
  const obs = new MutationObserver(() => {
    lastMutation = Date.now();
    watchdog.kick();
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();

  chrome.runtime.sendMessage({
    type: "ACTIVITY",
    payload: {
      id: `boot_${adapter.id}`,
      ts: Date.now(),
      level: "info",
      source: "capture",
      platform: adapter.id,
      message: `adapter ${adapter.name} activo (${location.hostname})`,
    },
  }).catch(() => undefined);
}

function scan(): void {
  if (!adapter) return;
  const messages = adapter.findAssistantMessages(document);
  if (!messages.length) {
    // Só avisa com evidência de conversa (Enter no compositor) — chat vazio é normal.
    if (awaitingAnswer && !warnedNoMessages) {
      warnedNoMessages = true;
      // Diagnóstico anexado: se voltar a falhar, o log diz o que a página
      // oferece, sem precisar de DevTools (contagens profundas incl. shadow).
      const dom = {
        pre: deepQuerySelectorAll(document, "pre").length,
        code: deepQuerySelectorAll(document, "code").length,
        copiar: deepQuerySelectorAll(document, "button, a, [role='button']").filter((b) =>
          isCopyDownloadLabel(b.getAttribute("aria-label") ?? (b.textContent ?? "")),
        ).length,
        shadows: deepCountShadowRoots(document),
      };
      chrome.runtime.sendMessage({
        type: "ACTIVITY",
        payload: {
          id: `noselectors_${adapter.id}_${Date.now()}`,
          ts: Date.now(),
          level: "warn",
          source: "capture",
          platform: adapter.id,
          message: `resposta pedida mas 0 mensagens — DOM: ${dom.pre} pre, ${dom.code} code, ${dom.copiar} botões copiar/descarregar, ${dom.shadows} shadow roots — actualiza platforms/${adapter.id}.json`,
        },
      }).catch(() => undefined);
    }
    return;
  }
  // Mensagens existem: re-arma o diagnóstico de mensagens para a PRÓXIMA
  // resposta falhada. O de blocos só re-arma quando há blocos (abaixo) —
  // senão o aviso "0 blocos" disparava a cada scan estável (spam visto 19:37).
  warnedNoMessages = false;
  const last = messages.at(-1);
  if (!last) return;
  if (adapter.isStreaming(last) && Date.now() - lastMutation < 10_000) {
    // Sinal de stream presente E DOM ainda activo — esperar o fim.
    chrome.runtime.sendMessage({
      type: "ACTIVITY",
      payload: {
        id: `stream_${Date.now()}`,
        ts: Date.now(),
        level: "info",
        source: "capture",
        platform: adapter.id,
        message: "stream em curso…",
      },
    }).catch(() => undefined);
    return;
  }
  if (adapter.isStreaming(last)) {
    // Guarda 2026-09-23: indicador presente mas DOM parado >10 s = sinal
    // preso (UI não limpou a classe). Extrai em vez de esperar para sempre.
    chrome.runtime.sendMessage({
      type: "ACTIVITY",
      payload: {
        id: `stuckstream_${adapter.id}_${Date.now()}`,
        ts: Date.now(),
        level: "warn",
        source: "capture",
        platform: adapter.id,
        message: "sinal de stream preso >10 s — a extrair à mesma",
      },
    }).catch(() => undefined);
  }
  const blocks: RawBlock[] = adapter.extractCodeBlocks(last);
  if (!blocks.length) {
    // Diagnóstico 2026-09-23 (caso DeepSeek): mensagem encontrada mas 0
    // blocos = selectores de `codeBlock` falharam (ex.: código em `pre` sem
    // `<code>` filho). Sem isto, o silêncio era total — o aviso de mensagens
    // não cobria este caso.
    if (awaitingAnswer && !warnedNoBlocks) {
      warnedNoBlocks = true;
      chrome.runtime.sendMessage({
        type: "ACTIVITY",
        payload: {
          id: `noblocks_${adapter.id}_${Date.now()}`,
          ts: Date.now(),
          level: "warn",
          source: "capture",
          platform: adapter.id,
          message: `mensagem encontrada mas 0 blocos — selectores codeBlock de platforms/${adapter.id}.json não casam o DOM`,
        },
      }).catch(() => undefined);
    }
    return;
  }
  warnedNoBlocks = false; // captura OK: próxima falha volta a avisar
  chrome.runtime.sendMessage({
    type: "RAW_CAPTURE",
    payload: {
      platform: adapter.id,
      url: location.href,
      blocks,
    },
  }).catch(() => undefined);
}
