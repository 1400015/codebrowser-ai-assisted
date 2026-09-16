import type { FileAction } from "./block";

export type BlockStatus =
  | "captured"
  | "planned"
  | "written"
  | "rejected"
  | "failed";

export interface HistoryEntry {
  blockId: string;
  path: string;
  action: FileAction;
  platform: string;
  status: BlockStatus;
  ts: number;
}
