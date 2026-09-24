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
  /** cardMode: a raiz é um cartão de código (fallback da toolbar), não uma
   * mensagem — a extracção por texto pode arrancar sem selectores. */
  extractCodeBlocks(messageRoot: HTMLElement, opts?: { cardMode?: boolean }): RawBlock[];
  isStreaming(messageRoot: HTMLElement): boolean;
}

/** Config declarativa de uma plataforma (ficheiros `platforms/*.json`).
 * Cada campo é uma lista de selectores CSS tentados por ordem — o primeiro
 * que casa ganha. Isto permite actualizar a captura sem tocar no código:
 * quando uma plataforma muda a UI, muda-se o JSON. */
export interface PlatformConfig {
  id: string;
  name: string;
  hosts: string[];
  /** Contentores de mensagem do assistente, por ordem de preferência. */
  assistant: string[];
  /** Um elemento que casa = mensagem ainda a fazer stream. */
  streaming: string[];
  /** Campo de input do utilizador. */
  composer: string[];
  /** Elementos de código dentro de uma mensagem (`querySelectorAll`). */
  codeBlock: string[];
  /** Onde ler a linguagem dentro do bloco (texto ou classe). */
  languageLabel: string[];
}
