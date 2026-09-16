import type { RawBlock } from "./block";

export interface ComposerHandle {
  element: HTMLElement;
  setText(text: string): void;
  getText(): string;
}

export interface PlatformAdapter {
  id: string;
  name: string;
  match(url: URL, doc: Document): boolean;
  findComposer(doc: Document): ComposerHandle | null;
  findAssistantMessages(doc: Document): HTMLElement[];
  extractCodeBlocks(messageRoot: HTMLElement): RawBlock[];
  isStreaming(messageRoot: HTMLElement): boolean;
}
