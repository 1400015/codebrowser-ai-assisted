import type { ActivityEvent } from "../types/activity";
import type { CodeBlock } from "../types/block";
import type { ExtensionMessage } from "../types/messages";
import type { IntegrationPlan } from "../types/plan";
import { formatLine } from "../activity/format";
import { planBlock } from "../orchestrator/planner";
import { Workspace } from "../workspace/fs-access";

const inbox = document.getElementById("inbox") as HTMLElement;
const term = document.getElementById("term") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const ws = new Workspace();
const plans = new Map<string, IntegrationPlan>();
let hintOn = false;
let files: string[] = [];

boot();

async function boot(): Promise<void> {
  const stored = await chrome.storage.session.get(["blocks", "activity"]);
  for (const ev of (stored.activity as ActivityEvent[] | undefined) ?? []) log(ev);
  for (const b of (stored.blocks as CodeBlock[] | undefined) ?? []) await renderBlock(b);

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
    if (msg.type === "ACTIVITY") log(msg.payload);
    if (msg.type === "BLOCKS_READY") {
      for (const b of msg.payload.blocks) void renderBlock(b);
    }
  });

  document.getElementById("openWs")?.addEventListener("click", async () => {
    try {
      await ws.pick();
      files = await ws.listFiles();
      status.textContent = `workspace · ${files.length} ficheiros`;
      log(local("ok", "fs", `pasta aberta · ${files.length} ficheiros`));
    } catch (err) {
      log(local("error", "fs", err instanceof Error ? err.message : "picker cancelado"));
    }
  });

  document.getElementById("popup")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_ACTIVITY_POPUP" }).catch(() => undefined);
  });

  const hintBtn = document.getElementById("hintToggle");
  hintBtn?.addEventListener("click", async () => {
    hintOn = !hintOn;
    await chrome.storage.sync.set({ hintOn });
    if (hintBtn) hintBtn.textContent = `Hint opt-in: ${hintOn ? "on" : "off"}`;
  });
}

async function renderBlock(block: CodeBlock): Promise<void> {
  log(local("ok", "parse", `${block.path} · ${block.language} · ${block.source}`, block.platform));
  log(local("wait", "model", "a escolher destino…", block.platform));
  const plan = await planBlock(block, files, { enabled: true });
  plans.set(block.id, plan);
  log(
    local(
      plan.valid ? "ok" : "warn",
      "plan",
      `${plan.action}  ${plan.path}  (${plan.fromModel ? "modelo" : "determinístico"})`,
      block.platform,
    ),
  );

  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <header>
      <strong>${escapeHtml(plan.path)}</strong>
      <div class="meta">${escapeHtml(block.platform)} · ${escapeHtml(block.language)} · ${escapeHtml(plan.action)} · ${plan.fromModel ? "qwen-coder" : "local"}</div>
    </header>
    <div class="row">
      <input type="text" value="${escapeHtml(plan.path)}" data-path="${escapeHtml(block.id)}" />
    </div>
    <pre class="code">${escapeHtml(block.code.slice(0, 4000))}</pre>
    <div class="row">
      <button class="primary" data-approve="${escapeHtml(block.id)}">Aprovar escrita</button>
      <button data-drop="${escapeHtml(block.id)}">Rejeitar</button>
    </div>
  `;
  inbox.prepend(card);

  card.querySelector("[data-approve]")?.addEventListener("click", () => void approve(block, card));
  card.querySelector("[data-drop]")?.addEventListener("click", () => card.remove());
}

async function approve(block: CodeBlock, card: HTMLElement): Promise<void> {
  if (!ws.opened) {
    log(local("error", "fs", "abre uma pasta primeiro"));
    return;
  }
  const input = card.querySelector("input") as HTMLInputElement;
  const plan = plans.get(block.id);
  if (!plan) return;
  const path = input.value.trim() || plan.path;
  if (plan.action === "delete") {
    const ok = confirm(`Apagar ${path}?`);
    if (!ok) return;
    await ws.deleteFile(path);
    log(local("warn", "fs", `apagado ${path}`));
    card.remove();
    return;
  }
  try {
    if (plan.action === "append") await ws.appendFile(path, block.code);
    else await ws.writeFile(path, block.code);
    log(local("ok", "fs", `escrito ${path}`));
    status.textContent = `escrito ${path}`;
    card.remove();
  } catch (err) {
    log(local("error", "fs", err instanceof Error ? err.message : "falha a escrever"));
  }
}

function log(ev: ActivityEvent): void {
  const line = document.createElement("div");
  line.className = ev.level;
  line.textContent = formatLine(ev);
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}

function local(
  level: ActivityEvent["level"],
  source: ActivityEvent["source"],
  message: string,
  platform?: string,
): ActivityEvent {
  return {
    id: `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    level,
    source,
    platform,
    message,
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
