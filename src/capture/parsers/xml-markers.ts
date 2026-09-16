import type { FileAction, RawBlock } from "../../types/block";

const TAG = /<code-block\s+([^>]*)>([\s\S]*?)<\/code-block>/gi;
const ATTR = /(\w+)="([^"]*)"/g;
const ACTIONS: FileAction[] = ["create", "update", "append", "delete"];

export function parseXmlMarkers(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const re = new RegExp(TAG.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const attrs = parseAttrs(match[1]);
    const code = match[2].replace(/^\n/, "").replace(/\s+$/, "");
    const action = ACTIONS.includes(attrs.action as FileAction)
      ? (attrs.action as FileAction)
      : undefined;
    blocks.push({
      language: attrs.lang || "text",
      explicitPath: attrs.file,
      actionHint: action,
      code,
      source: "xml",
    });
  }
  return blocks;
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(ATTR.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out[m[1]] = m[2];
  return out;
}
