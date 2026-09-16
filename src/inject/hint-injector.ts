import type { ComposerHandle } from "../types/platform";

export const HINT =
  "[CodeBrowser] Se gerares ficheiros, indica o caminho na primeira linha de cada bloco: // file: path/relativo.ext";

export function appendHint(composer: ComposerHandle): void {
  const current = composer.getText();
  if (current.includes("[CodeBrowser]")) return;
  const next = current.trimEnd() ? `${current.trimEnd()}\n\n${HINT}` : HINT;
  composer.setText(next);
}
