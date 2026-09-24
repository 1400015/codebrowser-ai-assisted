/** Hook de clipboard no mundo MAIN da página (2026-09-23).
 *
 * Porque é que isto existe: o botão "Copiar" das plataformas (Qwen, Monaco)
 * usa `navigator.clipboard.writeText()`, que NÃO dispara o evento `copy` —
 * por isso o content script (mundo isolado) nunca via o clique no botão.
 * Este script corre no MAIN world (ver manifest: "world": "MAIN",
 * document_start) e embrulha as APIs de escrita da clipboard; quando a página
 * copia texto, notifica o content script via CustomEvent "cb:copy" no
 * document (os dois mundos partilham a árvore DOM e os seus eventos).
 *
 * Contrato: nunca lança para a página — qualquer falha do hook é silenciosa e
 * o comportamento original (copiar) mantém-se intacto. Sem imports: o bundle
 * tem de ser um IIFE autónomo.
 */
;(() => {
  const notify = (text: string): void => {
    try {
      document.dispatchEvent(new CustomEvent("cb:copy", { detail: text }));
    } catch {
      // nunca partir a página
    }
  };

  const clip = navigator.clipboard;
  if (clip) {
    // 1) Botão "Copiar" (Qwen/Monaco): writeText assíncrono, sem evento copy.
    if (typeof clip.writeText === "function") {
      const origWriteText = clip.writeText.bind(clip);
      clip.writeText = (text: string) => {
        notify(String(text));
        return origWriteText(text);
      };
    }
    // 2) write() com ClipboardItem (raro, mas algumas UIs usam).
    if (typeof clip.write === "function") {
      const origWrite = clip.write.bind(clip);
      clip.write = (items: ClipboardItem[]) => {
        void (async () => {
          for (const item of items) {
            try {
              const blob = await item.getType("text/plain");
              notify(await blob.text());
            } catch {
              // item sem text/plain — ignorar
            }
          }
        })();
        return origWrite(items);
      };
    }
  }

  // 3) execCommand("copy") (caminho clássico; ex.: Ctrl+C no Monaco passa
  // por aqui com o texto numa textarea escondida já seleccionada).
  const origExec = Document.prototype.execCommand;
  Document.prototype.execCommand = function (
    this: Document,
    commandId: string,
    showUI?: boolean,
    value?: string,
  ) {
    if (String(commandId).toLowerCase() === "copy") {
      try {
        const sel = this.getSelection?.()?.toString() ?? "";
        if (sel) notify(sel);
      } catch {
        // leitura de selecção recusada — ignorar
      }
    }
    return origExec.call(this, commandId, showUI as never, value as never);
  };
})();
