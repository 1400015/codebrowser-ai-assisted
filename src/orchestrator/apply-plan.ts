import type { CodeBlock, FileAction } from "../types/block";
import type { IntegrationPlan } from "../types/plan";
import type { WorkspaceIO } from "../workspace/io";
import { inspectPath } from "./path-jail";

export interface ApplyPlanResult {
  ok: boolean;
  path: string;
  action: FileAction;
  error?: string;
  needsOverwriteConfirm?: boolean;
  needsDeleteConfirm?: boolean;
}

export async function applyPlan(
  workspace: WorkspaceIO,
  block: CodeBlock,
  plan: IntegrationPlan,
  requestedPath: string,
  opts?: { confirmOverwrite?: boolean; confirmDelete?: boolean },
): Promise<ApplyPlanResult> {
  if (!workspace.opened) {
    return fail(plan.path, plan.action, "workspace fechado");
  }
  if (!plan.valid || plan.errors.length > 0) {
    return fail(plan.path, plan.action, plan.errors.join("; ") || "plano inválido");
  }

  const checked = inspectPath(requestedPath.trim() || plan.path);
  if (checked.errors.length > 0 || !checked.path) {
    return fail(plan.path, plan.action, checked.errors.join("; ") || "path inválido");
  }
  const path = checked.path;
  const action = plan.action;

  if (action === "delete") {
    if (!opts?.confirmDelete) {
      return {
        ok: false,
        path,
        action,
        needsDeleteConfirm: true,
        error: "delete exige confirmação",
      };
    }
    try {
      await workspace.deleteFile(path);
      return { ok: true, path, action };
    } catch (err) {
      return fail(path, action, err instanceof Error ? err.message : "falha a apagar");
    }
  }

  const existing = await workspace.readFile(path);
  if (action === "create" && existing !== null && !opts?.confirmOverwrite) {
    return {
      ok: false,
      path,
      action,
      needsOverwriteConfirm: true,
      error: "ficheiro já existe",
    };
  }

  try {
    if (action === "append") await workspace.appendFile(path, block.code);
    else await workspace.writeFile(path, block.code);
    return { ok: true, path, action };
  } catch (err) {
    return fail(path, action, err instanceof Error ? err.message : "falha a escrever");
  }
}

function fail(path: string, action: FileAction, error: string): ApplyPlanResult {
  return { ok: false, path, action, error };
}
