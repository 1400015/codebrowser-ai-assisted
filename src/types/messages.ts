import type { ActivityEvent } from "./activity";
import type { CodeBlock, RawCapturePayload } from "./block";
import type { IntegrationPlan } from "./plan";

export type ExtensionMessage =
  | { type: "RAW_CAPTURE"; payload: RawCapturePayload }
  | { type: "BLOCKS_READY"; payload: { blocks: CodeBlock[] } }
  /** Popup → resto da extensão: bloco já gravado/rejeitado no popup, para o
   * side panel remover o cartão e não haver dupla escrita. */
  | { type: "BLOCK_HANDLED"; payload: { id: string; status: "written" | "rejected" } }
  | { type: "ACTIVITY"; payload: ActivityEvent }
  | { type: "PLAN_READY"; payload: IntegrationPlan }
  | { type: "APPLY_PLAN"; payload: { plan: IntegrationPlan; code: string } }
  | { type: "APPLY_RESULT"; payload: { ok: boolean; path?: string; error?: string } }
  | { type: "OPEN_ACTIVITY_POPUP" }
  | { type: "PING" };
