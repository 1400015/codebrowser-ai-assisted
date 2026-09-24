/** Popup imediato de captura (2026-09-23).
 * Abre automaticamente quando o service worker detecta blocos novos e pergunta:
 * Gravar / Intercalar / Ignorar — sem abrir o side panel.
 *
 * Contrato deste ficheiro:
 * - Renderiza TODOS os blocos "captured" de chrome.storage.session no arranque
 *   e os novos que cheguem via BLOCKS_READY. Cartões já tratados ( gravado /
 *   rejeitado, em storage local `handledBlocks`) não voltam a aparecer.
 * - Gravar/Intercalar passam SEMPRE por planBlock → applyPlan (jail incluído).
 *   O popup não escreve directamente: é o mesmo pipeline do side panel.
 * - Workspace: restoreSaved() silencioso; se "prompt"/"none", o primeiro
 *   clique em Gravar pede permissão (resume/pick) — gesto do utilizador.
 * - Nunca lança para o topo: erros vão para o cartão/log, não matam o popup.
 */
import type { ActivityEvent } from "../types/activity";
import type { CodeBlock } from "../types/block";
import type { ExtensionMessage } from "../types/messages";
import type { IntegrationPlan } from "../types/plan";
import { formatLine } from "../activity/format";
import { applyPlan } from "../orchestrator/apply-plan";
import { planBlock } from "../orchestrator/planner";
import { loadAiSettings, type AiSettings } from "../orchestrator/settings";
import { appendHistory } from "../persist/history";
import { chromeLocal } from "../persist/kv";
import { Workspace } from "../workspace/fs-access";

const inbox = document.getElementById("inbox") as HTMLElement;
const term = document.getElementById("term") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const autoOpen = document.getElementById("autoOpen") as HTMLInputElement;
const closePopupBtn = document.getElementById("closePopup") as HTMLButtonElement;

const ws = new Workspace();
let ai: AiSettings | null = null;
let files: string[] = [];
/** Blocos já tratados (gravado/rejeitado) — persiste em chrome.storage.local
 * para o popup reaberto não voltar a mostrar o que já foi decidido. */
const handled = new Set<string>();
const rendered = new Set<string>();

boot();

async function boot(): Promise<void> {
  const saved = await chrome.storage.local.get(["handledBlocks", "capturePopupAuto"]);
  for (const id of (saved.handledBlocks as string[] | undefined) ?? []) handled.add(id);
  autoOpen.checked = saved.capturePopupAuto !== false;

  ai = await loadAiSettings();
  await restoreWorkspace();
  renderWorkspaceStatus();

  const stored = await chrome.storage.session.get("blocks");
  for (const b of (stored.blocks as CodeBlock[] | undefined) ?? []) void renderBlock(b);

  chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
    if (msg.type === "BLOCKS_READY") for (const b of msg.payload.blocks) void renderBlock(b);
    if (msg.type === "BLOCK_HANDLED") {
      handled.add(msg.payload.id);
      removeCard(msg.payload.id);
    }
  });

  autoOpen.addEventListener("change", () => {
    void chrome.storage.sync.set({ capturePopupAuto: autoOpen.checked });
  });
  closePopupBtn.addEventListener("click", () => window.close());
}

/** Estado da workspace no topo do popup. "prompt"/"none" não são erros:
 * o primeiro Gravar resolve (resume → pick). */
async function restoreWorkspace(): Promise<void> {
  try {
    const state = await ws.restoreSaved();
    if (state === "granted") files = await ws.listFiles();
  } catch {
    // workspace permanece fechada; status reflecte isso
  }
}

function renderWorkspaceStatus(): void {
  statusEl.textContent = ws.opened ? `workspace · ${files.length} ficheiros` : "workspace fechada";
}

async function renderBlock(block: CodeBlock): Promise<void> {
  if (handled.has(block.id) || rendered.has(block.id)) return;
  rendered.add(block.id);

  const plan = await computePlan(block);
  renderCard(block, plan);
}

async function computePlan(block: CodeBlock): Promise<IntegrationPlan> {
  try {
    return await planBlock(block, files, {
      enabled: true,
      mode: ai?.mode ?? "auto",
      openrouterModel: ai?.primaryModel,
      openrouterFallback: ai?.fallbackModel,
      openrouterKey: ai?.apiKey,
    });
  } catch (err) {
    // planner nunca devia lançar (cai no determinístico), mas o popup não morre
    const fallback = await planBlock(block, [], { mode: "off" });
    log("warn", `plano falhou (${err instanceof Error ? err.message : "?"}) — determinístico`);
    return fallback;
  }
}

function renderCard(block: CodeBlock, plan: IntegrationPlan): void {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.blockId = block.id;

  const head = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = plan.path;
  const badge = document.createElement("span");
  badge.className = "status";
  badge.dataset.role = "status";
  badge.textContent = block.platform;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${block.language} · ${plan.action} · ${plan.fromModel ? "modelo" : "local"} · conf ${plan.confidence.toFixed(2)}`;
  head.append(title, badge, meta);

  if (plan.warnings.length || plan.errors.length) {
    const ul = document.createElement("ul");
    ul.className = "issues";
    for (const w of [...plan.errors.map((e) => `Erro: ${e}`), ...plan.warnings]) {
      const li = document.createElement("li");
      li.textContent = w;
      ul.append(li);
    }
    card.append(ul);
  }

  const rowPath = document.createElement("div");
  rowPath.className = "row";
  const input = document.createElement("input");
  input.type = "text";
  input.value = plan.path;
  const actionSel = document.createElement("select");
  for (const a of ["create", "update", "append"] as const) {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a === "append" ? "intercalar (append)" : a;
    if (a === plan.action) opt.selected = true;
    actionSel.append(opt);
  }
  rowPath.append(input, actionSel);

  const pre = document.createElement("pre");
  pre.className = "code";
  pre.textContent = block.code.slice(0, 2000);

  const rowBtns = document.createElement("div");
  rowBtns.className = "row";
  const saveBtn = document.createElement("button");
  saveBtn.className = "primary";
  saveBtn.textContent = "Gravar";
  const dropBtn = document.createElement("button");
  dropBtn.textContent = "Ignorar";
  rowBtns.append(saveBtn, dropBtn);

  card.append(head, rowPath, pre, rowBtns);
  inbox.prepend(card);

  saveBtn.addEventListener("click", () =>
    void save(block, card, input, actionSel.value as IntegrationPlan["action"], saveBtn),
  );
  dropBtn.addEventListener("click", () => void ignore(block, card));
}

/** Gravar (create/update) ou Intercalar (append). Se a workspace precisa de
 * permissão, pede-a AQUI (gesto do clique) — nunca no arranque do popup. */
async function save(
  block: CodeBlock,
  card: HTMLElement,
  input: HTMLInputElement,
  action: IntegrationPlan["action"],
  btn: HTMLButtonElement,
): Promise<void> {
  btn.disabled = true;
  try {
    if (!ws.opened) {
      const resumed = await ws.resume().catch(() => false);
      if (!resumed) await ws.pick();
      files = await ws.listFiles();
      renderWorkspaceStatus();
    }
    // Plano re-validado com a acção escolhida na UI (o jail repete no applyPlan).
    const plan: IntegrationPlan = {
      ...(await computePlan(block)),
      action,
    };
    const result = await applyPlan(ws, block, plan, input.value, {});
    const final =
      result.needsOverwriteConfirm && confirm(`${result.path} já existe. Substituir?`)
        ? await applyPlan(ws, block, plan, input.value, { confirmOverwrite: true })
        : result;
    if (!final.ok) throw new Error(final.error ?? "escrita recusada");

    log("ok", `escrito ${final.path}`);
    statusEl.textContent = `escrito ${final.path}`;
    await markHandled(block, card, "written");
  } catch (err) {
    log("error", err instanceof Error ? err.message : "falha a gravar");
    btn.disabled = false;
  }
}

async function ignore(block: CodeBlock, card: HTMLElement): Promise<void> {
  log("debug", `ignorado ${block.path}`);
  await markHandled(block, card, "rejected");
}

/** Persiste a decisão + avisa o resto da extensão (side panel remove o cartão). */
async function markHandled(
  block: CodeBlock,
  card: HTMLElement,
  status: "written" | "rejected",
): Promise<void> {
  handled.add(block.id);
  await chrome.storage.local.set({ handledBlocks: [...handled].slice(-200) });
  await appendHistory(chromeLocal(), {
    blockId: block.id,
    path: block.path,
    action: block.action,
    platform: block.platform,
    status,
    ts: Date.now(),
  });
  chrome.runtime
    .sendMessage({ type: "BLOCK_HANDLED", payload: { id: block.id, status } })
    .catch(() => undefined);
  card.remove();
}

function removeCard(id: string): void {
  inbox.querySelector(`[data-block-id="${id}"]`)?.remove();
}

function log(level: ActivityEvent["level"], message: string): void {
  const ev: ActivityEvent = {
    id: `pop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level,
    source: "fs",
    message,
  };
  const line = document.createElement("div");
  line.className = ev.level;
  line.textContent = formatLine(ev);
  term.appendChild(line);
  term.scrollTop = term.scrollHeight;
}
