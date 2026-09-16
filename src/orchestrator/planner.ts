import type { CodeBlock } from "../types/block";
import type { IntegrationPlan } from "../types/plan";
import { deterministicPlan } from "./deterministic";
import { routeWithOllama } from "./ollama";
import { jailPath } from "./path-jail";

export async function planBlock(
  block: CodeBlock,
  existingPaths: string[],
  opts?: { model?: string; enabled?: boolean },
): Promise<IntegrationPlan> {
  const base = deterministicPlan(block, existingPaths);
  if (opts?.enabled === false) return base;

  try {
    const routed = await routeWithOllama({
      tree: existingPaths.slice(0, 400).join("\n"),
      lang: block.language,
      hint: block.path,
      codeHead: block.code.split("\n").slice(0, 40).join("\n"),
      model: opts?.model,
    });
    const jailed = jailPath(routed.path || base.path, base.path);
    const exists = existingPaths.includes(jailed.path);
    let action = routed.action;
    if (action === "create" && exists) action = "update";
    if (action === "update" && !exists) action = "create";
    const errors = [...base.errors, ...jailed.errors];
    return {
      ...base,
      path: jailed.path,
      action,
      confidence: routed.confidence || base.confidence,
      reason: routed.reason || base.reason,
      fromModel: true,
      errors,
      valid: errors.length === 0,
    };
  } catch {
    return {
      ...base,
      warnings: [...base.warnings, "modelo local indisponível — plano determinístico"],
    };
  }
}
