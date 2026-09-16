import type { CodeBlock } from "../types/block";
import type { IntegrationPlan } from "../types/plan";
import { deterministicPlan } from "./deterministic";
import { clip, MAX_CODE_CHARS, MAX_TREE_CHARS, routeWithOllama } from "./ollama";
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
      tree: clip(existingPaths.join("\n"), MAX_TREE_CHARS),
      lang: block.language,
      hint: block.path,
      codeHead: clip(block.code, MAX_CODE_CHARS),
      model: opts?.model,
    });
    return mergeRouted(base, existingPaths, routed);
  } catch {
    return {
      ...base,
      warnings: [...base.warnings, "modelo local indisponível — plano determinístico"],
    };
  }
}

export function mergeRouted(
  base: IntegrationPlan,
  existingPaths: string[],
  routed: { path: string; action: "create" | "update" | "append"; confidence: number; reason: string },
): IntegrationPlan {
  // Abaixo de 0.3 ignora o path do modelo: o número não está calibrado.
  if (routed.confidence < 0.3) {
    return {
      ...base,
      warnings: [
        ...base.warnings,
        `confiança ${routed.confidence.toFixed(2)} — plano determinístico`,
      ],
    };
  }

  const jailed = jailPath(routed.path || base.path, base.path);
  const exists = existingPaths.includes(jailed.path);
  let action = routed.action as IntegrationPlan["action"];
  if (action === "create" && exists) action = "update";
  if (action === "update" && !exists) action = "create";
  const errors = [...base.errors, ...jailed.errors];
  const warnings = [...base.warnings];
  if (routed.confidence < 0.55) {
    warnings.push("confiança baixa — rever o path à mão");
  }

  return {
    ...base,
    path: jailed.path,
    action,
    confidence: routed.confidence,
    reason: routed.reason || base.reason,
    fromModel: true,
    errors,
    warnings,
    valid: errors.length === 0,
  };
}
