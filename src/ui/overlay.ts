import type { ActivityEvent } from "../types/activity";
import type { ExtensionMessage } from "../types/messages";
import { formatLine } from "../activity/format";

const term = document.getElementById("term") as HTMLElement;

chrome.storage.session.get("activity").then((data) => {
  for (const ev of (data.activity as ActivityEvent[] | undefined) ?? []) paint(ev);
});

chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
  if (msg.type === "ACTIVITY") paint(msg.payload);
});

function paint(ev: ActivityEvent): void {
  const line = document.createElement("div");
  line.className = ev.level;
  line.textContent = formatLine(ev);
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}
