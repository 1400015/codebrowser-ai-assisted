import type { ActivityEvent } from "../types/activity";
import type { CodeBlock } from "../types/block";
import type { ExtensionMessage } from "../types/messages";
import type { IntegrationPlan } from "../types/plan";
import { formatLine } from "../activity/format";
import { applyPlan } from "../orchestrator/apply-plan";
import { planBlock } from "../orchestrator/planner";
import { FREE_MODELS } from "../orchestrator/models";
import { testOpenRouterKey } from "../orchestrator/openrouter";
import { loadAiSettings, saveAiSettings, type AiSettings } from "../orchestrator/settings";
import { appendHistory } from "../persist/history";
import { chromeLocal } from "../persist/kv";
import type { BlockStatus } from "../types/status";
import { Workspace } from "../workspace/fs-access";

const inbox = document.getElementById("inbox") as HTMLElement;
const term = document.getElementById("term") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const ws = new Workspace();
const plans = new Map<string, IntegrationPlan>();
let hintOn = false;
let files: string[] = [];
let ai: AiSettings = {
  primaryModel: "poolside/laguna-s-2.1:free",
  fallbackModel: "openai/gpt-oss-120b:free",
  apiKey: "",
  mode: "auto",
};

boot();

async function boot(): Promise<void> {
  ai = await loadAiSettings();
  initAiSettingsUI();
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

function initAiSettingsUI(): void {
  const primary = document.getElementById("primaryModel") as HTMLSelectElement | null;
  const fallback = document.getElementById("fallbackModel") as HTMLSelectElement | null;
  const modeSel = document.getElementById("aiMode") as HTMLSelectElement | null;
  const keyInput = document.getElementById("openrouterKey") as HTMLInputElement | null;
  const saveBtn = document.getElementById("saveAi");
  const testBtn = document.getElementById("testAi");
  const saved = document.getElementById("aiSaved");
  if (!primary || !fallback) return;
  for (const m of FREE_MODELS) {
    for (const sel of [primary, fallback]) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.label} · ${m.context}`;
      opt.title = m.notes;
      sel.append(opt);
    }
  }
  ensureOption(primary, ai.primaryModel);
  ensureOption(fallback, ai.fallbackModel);
  primary.value = ai.primaryModel;
  fallback.value = ai.fallbackModel;
  if (modeSel) modeSel.value = ai.mode;
  if (keyInput) keyInput.value = ai.apiKey;
  saveBtn?.addEventListener("click", async () => {
    ai = {
      primaryModel: primary.value,
      fallbackModel: fallback.value,
      apiKey: (keyInput?.value ?? "").trim(),
      mode: modeSel?.value === "off" ? "off" : "auto",
    };
    await saveAiSettings(ai);
    if (saved) saved.textContent = `guardado ${new Date().toLocaleTimeString()}`;
    log(local("ok", "model", `AI ${ai.mode} ${ai.primaryModel} → fallback ${ai.fallbackModel}`));
  });
  testBtn?.addEventListener("click", async () => {
    const key = (keyInput?.value ?? "").trim();
    if (saved) saved.textContent = "a testar…";
    try {
      const msg = await testOpenRouterKey(key);
      if (saved) saved.textContent = msg;
      log(local("ok", "model", msg));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "falha no teste";
      if (saved) saved.textContent = msg;
      log(local("error", "model", msg));
    }
  });
}

function ensureOption(sel: HTMLSelectElement, id: string): void {
  if (!id) return;
  if (Array.from(sel.options).some((o) => o.value === id)) return;
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = `${id} (custom)`;
  sel.append(opt);
}

async function renderBlock(block: CodeBlock): Promise<void> {
  log(local("ok", "parse", `${block.path} · ${block.language} · ${block.source}`, block.platform));
  log(local("wait", "model", `a escolher destino… (${ai.mode === "off" ? "off" : shortModel(ai.primaryModel)})`, block.platform));
  const plan = await planBlock(block, files, {
    enabled: true,
    mode: ai.mode,
    openrouterModel: ai.primaryModel,
    openrouterFallback: ai.fallbackModel,
    openrouterKey: ai.apiKey,
  });
  plans.set(block.id, plan);
  log(
    local(
      plan.valid ? "ok" : "warn",
      "plan",
      `${plan.action}  ${plan.path}  (${plan.fromModel ? "modelo" : "determinístico"})`,
      block.platform,
    ),
  );

  const issues = [
    ...plan.errors.map((e) => `Erro: ${e}`),
    ...plan.warnings.map((w) => `Aviso: ${w}`),
  ];
  const issueBox = document.createElement("ul");
  issueBox.className = "issues";
  for (const item of issues) {
    const li = document.createElement("li");
    li.textContent = item;
    issueBox.appendChild(li);
  }

  const card = document.createElement("article");
  card.className = "card";

  const head = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = plan.path;
  const badge = document.createElement("span");
  badge.className = "status";
  badge.dataset.role = "status";
  setStatus(badge, plan.valid ? "planned" : "failed");
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${block.platform} · ${block.language} · ${plan.action} · ${plan.fromModel ? shortModel(ai.primaryModel) : "local"} · conf ${plan.confidence.toFixed(2)}`;
  head.append(title, badge, meta);

  const rowPath = document.createElement("div");
  rowPath.className = "row";
  const input = document.createElement("input");
  input.type = "text";
  input.value = plan.path;
  rowPath.append(input);

  const pre = document.createElement("pre");
  pre.className = "code";
  pre.textContent = block.code.slice(0, 4000);

  const rowBtns = document.createElement("div");
  rowBtns.className = "row";
  const approveBtn = document.createElement("button");
  approveBtn.className = "primary";
  approveBtn.textContent = "Aprovar escrita";
  approveBtn.disabled = !plan.valid;
  const dropBtn = document.createElement("button");
  dropBtn.textContent = "Rejeitar";
  rowBtns.append(approveBtn, dropBtn);

  card.append(head, rowPath);
  if (issues.length) card.append(issueBox);
  card.append(pre, rowBtns);
  inbox.prepend(card);

  approveBtn.addEventListener("click", () => void approve(block, card, input));
  dropBtn.addEventListener("click", () => {
    void record(block, plan.path, plan.action, "rejected");
    setStatus(badge, "rejected");
    card.remove();
  });
}

async function approve(
  block: CodeBlock,
  card: HTMLElement,
  input: HTMLInputElement,
): Promise<void> {
  const plan = plans.get(block.id);
  if (!plan) return;
  if (!plan.valid) {
    log(local("error", "plan", "plano inválido; escrita bloqueada"));
    return;
  }

  let result = await applyPlan(ws, block, plan, input.value, {});
  if (result.needsDeleteConfirm) {
    if (!confirm(`Apagar ${result.path}?`)) return;
    result = await applyPlan(ws, block, plan, input.value, { confirmDelete: true });
  }
  if (result.needsOverwriteConfirm) {
    if (!confirm(`${result.path} já existe. Deseja substituir?`)) return;
    result = await applyPlan(ws, block, plan, input.value, { confirmOverwrite: true });
  }

  if (!result.ok) {
    log(local("error", "fs", result.error ?? "escrita recusada"));
    await record(block, result.path, plan.action, "failed");
    const mark = card.querySelector("[data-role='status']");
    if (mark instanceof HTMLElement) setStatus(mark, "failed");
    return;
  }
  log(local("ok", "fs", `escrito ${result.path}`));
  status.textContent = `escrito ${result.path}`;
  await record(block, result.path, result.action, "written");
  card.remove();
}

async function record(
  block: CodeBlock,
  path: string,
  action: CodeBlock["action"],
  blockStatus: BlockStatus,
): Promise<void> {
  await appendHistory(chromeLocal(), {
    blockId: block.id,
    path,
    action,
    platform: block.platform,
    status: blockStatus,
    ts: Date.now(),
  });
}

function setStatus(el: HTMLElement, value: BlockStatus): void {
  el.dataset.status = value;
  const label: Record<BlockStatus, string> = {
    captured: "capturado",
    planned: "pronto",
    written: "escrito",
    rejected: "rejeitado",
    failed: "falhou",
  };
  el.textContent = label[value];
}

function shortModel(id: string): string {
  const parts = id.split("/");
  const last = parts.at(-1) ?? id;
  return last.replace(":free", "");
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
    id: `ui_${crypto.randomUUID()}`,
    ts: Date.now(),
    level,
    source,
    platform,
    message,
  };
}
