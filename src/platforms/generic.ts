import type { ComposerHandle, PlatformAdapter } from "../types/platform";
import { extractBlocksFromElement } from "./dom";

export function makeGenericAdapter(
  id: string,
  name: string,
  hosts: string[],
): PlatformAdapter {
  return {
    id,
    name,
    match(url) {
      return hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
    },
    findComposer(doc) {
      const el =
        (doc.querySelector("textarea") as HTMLTextAreaElement | null) ||
        (doc.querySelector("[contenteditable='true']") as HTMLElement | null);
      if (!el) return null;
      return wrapComposer(el);
    },
    findAssistantMessages(doc) {
      const nodes = [...doc.querySelectorAll("article, [data-message-author-role='assistant'], pre")];
      return nodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
    },
    extractCodeBlocks(messageRoot) {
      return extractBlocksFromElement(messageRoot);
    },
    isStreaming(messageRoot) {
      return Boolean(
        messageRoot.querySelector("[data-is-streaming='true'], [data-streaming='true']"),
      );
    },
  };
}

export function wrapComposer(el: HTMLElement): ComposerHandle {
  return {
    element: el,
    getText() {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
      return el.innerText;
    },
    setText(text: string) {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        const proto = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        );
        proto?.set?.call(el, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      el.focus();
      el.innerText = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    },
  };
}
