import type { RawBlock } from "../types/block";
import { extractPathHint } from "../capture/parsers/path-hints";
import { parseXmlMarkers } from "../capture/parsers/xml-markers";
import { parseMarkdownFences } from "../capture/parsers/markdown-fences";

export function extractBlocksFromElement(root: HTMLElement): RawBlock[] {
  const text = root.innerText || root.textContent || "";
  const xml = parseXmlMarkers(text);
  if (xml.length) return xml;

  const fromDom: RawBlock[] = [];
  root.querySelectorAll("pre code, pre > code").forEach((node) => {
    const code = (node.textContent || "").replace(/\s+$/, "");
    if (code.trim().length < 4) return;
    const lang =
      langFromClass(node) ||
      langFromClass(node.parentElement) ||
      "text";
    fromDom.push({
      language: lang,
      explicitPath: extractPathHint(code),
      code,
      source: "dom",
    });
  });
  if (fromDom.length) return fromDom;
  return parseMarkdownFences(text);
}

function langFromClass(el: Element | null): string | undefined {
  if (!el) return undefined;
  const cls = el.getAttribute("class") || "";
  const m = cls.match(/language-([A-Za-z0-9_+#.\-]+)/);
  return m?.[1]?.toLowerCase();
}
