import type { RawBlock } from "../../types/block";
import { parseMarkdownFences } from "./markdown-fences";
import { parseXmlMarkers } from "./xml-markers";
import { extractPathHint } from "./path-hints";

export function parseCapturedText(text: string): RawBlock[] {
  const xml = parseXmlMarkers(text);
  const fences = parseMarkdownFences(text);
  const merged: RawBlock[] = [...xml];
  const seen = new Set(xml.map((b) => normalize(b.code)));

  for (const fence of fences) {
    const key = normalize(fence.code);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!fence.explicitPath) {
      fence.explicitPath = extractPathHint(fence.code);
    }
    merged.push(fence);
  }
  return merged;
}

function normalize(code: string): string {
  return code.replace(/\s+$/gm, "").trim();
}

export { parseMarkdownFences, parseXmlMarkers, extractPathHint };
