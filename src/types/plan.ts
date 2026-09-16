import type { FileAction } from "./block";

export interface IntegrationPlan {
  blockId: string;
  path: string;
  action: FileAction;
  confidence: number;
  reason: string;
  fromModel: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
}
