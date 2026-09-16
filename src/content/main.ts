import { createWatchdog } from "../capture/watchdog";
import { detectAdapter } from "../platforms/registry";
import type { RawBlock } from "../types/block";

const adapter = detectAdapter(new URL(location.href), document);

if (adapter) {
  const watchdog = createWatchdog(600, scan);
  const obs = new MutationObserver(() => watchdog.kick());
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
      message: `adapter ${adapter.name} activo`,
    },
  }).catch(() => undefined);
}

function scan(): void {
  if (!adapter) return;
  const messages = adapter.findAssistantMessages(document);
  const last = messages.at(-1);
  if (!last) return;
  if (adapter.isStreaming(last)) {
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
  const blocks: RawBlock[] = adapter.extractCodeBlocks(last);
  if (!blocks.length) return;
  chrome.runtime.sendMessage({
    type: "RAW_CAPTURE",
    payload: {
      platform: adapter.id,
      url: location.href,
      blocks,
    },
  }).catch(() => undefined);
}
