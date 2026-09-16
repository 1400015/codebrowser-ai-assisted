export type ActivityLevel = "debug" | "info" | "ok" | "warn" | "error" | "wait";

export type ActivitySource =
  | "capture"
  | "parse"
  | "validate"
  | "model"
  | "plan"
  | "fs"
  | "git"
  | "ui";

export interface ActivityEvent {
  id: string;
  ts: number;
  level: ActivityLevel;
  source: ActivitySource;
  platform?: string;
  message: string;
  meta?: Record<string, string | number | boolean>;
}
