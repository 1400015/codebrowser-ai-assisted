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
}

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
