import type { RawBlock } from "../../types/block";
import { extractPathHint } from "./path-hints";

const FENCE =
  /```([A-Za-z0-9_+#.\-]*)[^\n]*\n([\s\S]*?)```/g;

export function parseMarkdownFences(text: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FENCE.source, "g");
  while ((match = re.exec(text)) !== null) {
    const language = (match[1] || "text").toLowerCase();
    const code = match[2].replace(/\s+$/, "");
    if (!code.trim()) continue;
    blocks.push({
      language,
      explicitPath: extractPathHint(code),
      code,
      source: "fence",
    });
  }
  return blocks;
}
