import type { ActivityEvent } from "../types/activity";
import type { CodeBlock, RawCapturePayload } from "../types/block";
import type { ExtensionMessage } from "../types/messages";
import { blockId } from "../capture/hash";
import { fallbackName, jailPath } from "../orchestrator/path-jail";
import { newId } from "../activity/format";
import { chromeLocal, chromeSession } from "../persist/kv";
import { loadSeen, rememberSeen } from "../persist/seen";
import { appendHistory } from "../persist/history";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handle(message).then((r) => sendResponse(r ?? { ok: true }));
  return true;
});

async function handle(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "RAW_CAPTURE":
      await onCapture(message.payload);
      return { ok: true };
    case "OPEN_ACTIVITY_POPUP":
      await chrome.windows.create({
        url: "src/ui/overlay.html",
        type: "popup",
        width: 440,
        height: 300,
        focused: true,
      });
      return { ok: true };
    case "PING":
      return { ok: true };
    case "ACTIVITY":
      // ACTIVITY do content script passa a persistir em session storage —
      // antes as linhas de arranque/diagnóstico morriam se o painel estivesse
      // fechado no momento (só davam relay para páginas abertas).
      emit(message.payload);
      return { ok: true };
    default:
      relay(message);
      return { ok: true };
  }
}

async function onCapture(payload: RawCapturePayload): Promise<void> {
  const session = chromeSession();
  const seen = await loadSeen(session);
  const blocks: CodeBlock[] = [];

  for (const raw of payload.blocks) {
    const guessed = raw.explicitPath || fallbackName(raw.language || "text");
    const jailed = jailPath(guessed, fallbackName(raw.language || "text"));
    const action = raw.actionHint ?? "create";
    const id = await blockId(jailed.path, action, raw.code);
    if (!(await rememberSeen(session, seen, id))) continue;
    const block: CodeBlock = {
      id,
      language: raw.language || "text",
      path: jailed.path,
      action,
      code: raw.code,
      source: raw.source,
      platform: payload.platform,
      capturedAt: Date.now(),
    };
    blocks.push(block);
    await appendHistory(chromeLocal(), {
      blockId: id,
      path: block.path,
      action: block.action,
      platform: block.platform,
      status: "captured",
      ts: block.capturedAt,
    });
  }

  emit({
    level: blocks.length ? "ok" : "debug",
    source: "parse",
    platform: payload.platform,
    message: blocks.length
      ? `${blocks.length} bloco(s) estáveis`
      : "stream sem blocos novos",
  });

  if (!blocks.length) return;

  const stored = await chrome.storage.session.get("blocks");
  const prev = (stored.blocks as CodeBlock[] | undefined) ?? [];
  await chrome.storage.session.set({ blocks: [...prev, ...blocks].slice(-100) });
  relay({ type: "BLOCKS_READY", payload: { blocks } });
  await maybeOpenCapturePopup();
}

const CAPTURE_POPUP_URL = "src/ui/capture-popup.html";
const CAPTURE_WIN_KEY = "capturePopupWin";

/** Bloco — popup imediato de captura. Corre SÓ quando há blocos novos
 * (o rememberSeen acima já filtrou repetidos). Deve produzir: popup aberto
 * ou focado com os blocos por tratar, salvo se o utilizador desligou o
 * auto-abrir (sync `capturePopupAuto === false`). Best-effort: falhar aqui
 * nunca perde blocos — o side panel continua a receber BLOCKS_READY. */
async function maybeOpenCapturePopup(): Promise<void> {
  try {
    const sync = await chrome.storage.sync.get("capturePopupAuto");
    if (sync.capturePopupAuto === false) return;

    const s = await chrome.storage.session.get(CAPTURE_WIN_KEY);
    const winId = s[CAPTURE_WIN_KEY] as number | undefined;
    if (typeof winId === "number") {
      const existing = await chrome.windows.get(winId).catch(() => null);
      if (existing) {
        await chrome.windows.update(winId, { focused: true });
        return;
      }
    }
    const win = await chrome.windows.create({
      url: CAPTURE_POPUP_URL,
      type: "popup",
      width: 560,
      height: 700,
      focused: true,
    });
    if (typeof win.id === "number") {
      await chrome.storage.session.set({ [CAPTURE_WIN_KEY]: win.id });
    }
  } catch {
    // sem popup o fluxo do side panel continua completo
  }
}

/** Fecha a chave de sessão quando o popup é fechado, para o próximo bloco
 * voltar a abrir janela nova em vez de focar uma janela morta. */
chrome.windows.onRemoved.addListener((winId) => {
  void chrome.storage.session
    .get(CAPTURE_WIN_KEY)
    .then((s) => {
      if (s[CAPTURE_WIN_KEY] === winId) return chrome.storage.session.remove(CAPTURE_WIN_KEY);
    })
    .catch(() => undefined);
});

function relay(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

function emit(partial: Omit<ActivityEvent, "id" | "ts">): void {
  const event: ActivityEvent = { id: newId(), ts: Date.now(), ...partial };
  chrome.storage.session.get("activity").then((data) => {
    const prev = (data.activity as ActivityEvent[] | undefined) ?? [];
    return chrome.storage.session.set({ activity: [...prev, event].slice(-300) });
  }).catch(() => undefined);
  relay({ type: "ACTIVITY", payload: event });
}
