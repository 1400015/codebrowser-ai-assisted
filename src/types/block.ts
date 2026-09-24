export type CaptureSource = "xml" | "fence" | "dom" | "copy";
export type FileAction = "create" | "update" | "append" | "delete";

export interface RawBlock {
  language?: string;
  explicitPath?: string;
  actionHint?: FileAction;
  code: string;
  source: CaptureSource;
}

export interface CodeBlock {
  id: string;
  language: string;
  path: string;
  action: FileAction;
  code: string;
  source: CaptureSource;
  platform: string;
  capturedAt: number;
}

export interface RawCapturePayload {
  platform: string;
  url: string;
  blocks: RawBlock[];
}
