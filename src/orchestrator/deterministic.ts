import type { CodeBlock } from "../types/block";
import type { IntegrationPlan } from "../types/plan";
import { fallbackName, jailPath } from "./path-jail";

export function deterministicPlan(
  block: CodeBlock,
  existingPaths: string[],
): IntegrationPlan {
  const guessed = block.path || fallbackName(block.language);
  const jailed = jailPath(guessed, fallbackName(block.language));
  const exists = existingPaths.includes(jailed.path);

  let action = block.action;
  const warnings: string[] = [];
  if (action === "create" && exists) {
    action = "update";
    warnings.push("ficheiro já existe — create promovido a update");
  }
  if (action === "update" && !exists) {
    action = "create";
    warnings.push("ficheiro não existe — update promovido a create");
  }
  if (action === "delete") {
    warnings.push("delete exige confirmação extra na UI");
  }

  return {
    blockId: block.id,
    path: jailed.path,
    action,
    confidence: jailed.errors.length ? 0.3 : block.path ? 0.75 : 0.45,
    reason: exists
      ? "ficheiro já está no workspace"
      : "ficheiro novo relativo ao root",
    fromModel: false,
    valid: jailed.errors.length === 0,
    errors: jailed.errors,
    warnings,
  };
}
