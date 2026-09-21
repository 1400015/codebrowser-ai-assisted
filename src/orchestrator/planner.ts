import type { CodeBlock } from "../types/block";
import type { IntegrationPlan } from "../types/plan";
import { deterministicPlan } from "./deterministic";
import { clip, MAX_CODE_CHARS, MAX_TREE_CHARS, routeWithOllama } from "./ollama";
import { routeWithOpenRouter } from "./openrouter";
import { jailPath } from "./path-jail";

export interface PlanOpts {
  model?: string;
  enabled?: boolean;
  mode?: "auto" | "off";
  openrouterModel?: string;
  openrouterFallback?: string;
  openrouterKey?: string;
}

export async function planBlock(
  block: CodeBlock,
  existingPaths: string[],
  opts?: PlanOpts,
): Promise<IntegrationPlan> {
  const base = deterministicPlan(block, existingPaths);
  if (opts?.enabled === false || opts?.mode === "off") {
    return {
      ...base,
      warnings: [...base.warnings, "modo off — determinístico forçado"],
    };
  }

  const tree = clip(existingPaths.join("\n"), MAX_TREE_CHARS);
  const codeHead = clip(block.code, MAX_CODE_CHARS);

  // 1) OpenRouter primário -> fallback (se houver chave).
  const key = (opts?.openrouterKey ?? "").trim();
  const primary = (opts?.openrouterModel ?? "").trim();
  const fallback = (opts?.openrouterFallback ?? "").trim();
  if (key && primary) {
    try {
      const routed = await routeWithOpenRouter({
        tree,
        lang: block.language,
        hint: block.path,
        codeHead,
        model: primary,
        apiKey: key,
      });
      return mergeRouted(base, existingPaths, routed);
    } catch (err) {
      if (fallback && fallback !== primary) {
        try {
          const routedFb = await routeWithOpenRouter({
            tree,
            lang: block.language,
            hint: block.path,
            codeHead,
            model: fallback,
            apiKey: key,
          });
          const merged = mergeRouted(base, existingPaths, routedFb);
          return {
            ...merged,
            warnings: [...merged.warnings, `primário falhou (${describe(err)}) — usado fallback`],
          };
        } catch {
          // cai para Ollama/determinístico abaixo
        }
      }
      // Se não há fallback ou ambos falharam, tenta Ollama antes de desistir.
      try {
        const routed = await routeWithOllama({
          tree,
          lang: block.language,
          hint: block.path,
          codeHead,
          model: opts?.model,
        });
        return {
          ...mergeRouted(base, existingPaths, routed),
          warnings: [...base.warnings, `OpenRouter indisponível (${describe(err)}) — usado Ollama`],
        };
      } catch {
        return {
          ...base,
          warnings: [...base.warnings, `OpenRouter + Ollama indisponíveis (${describe(err)}) — plano determinístico`],
        };
      }
    }
  }

  try {
    const routed = await routeWithOllama({
      tree,
      lang: block.language,
      hint: block.path,
      codeHead,
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

function describe(err: unknown): string {
  return err instanceof Error ? err.message : "erro desconhecido";
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
