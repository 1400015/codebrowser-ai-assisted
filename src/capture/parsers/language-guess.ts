/** Heurísticas para a captura via evento `copy` (2026-09-23).
 *
 * Caso Qwen: o código dos editores Monaco virtualizados só existe nas props
 * React — a árvore DOM não o tem completo. Mas quando o utilizador clica no
 * botão "Copiar" do bloco (ou Ctrl+C numa selecção), o texto COMPLETO passa
 * pelo evento `copy` da página, sem permissões nem hacks. Estas funções
 * decidem se um texto copiado merece virar bloco e qual a sua linguagem.
 *
 * Contrato: puras, testáveis em node, conservadoras — é melhor falhar a
 * captura de um código (o utilizador copia outra vez) do que encher o popup
 * de prosa copiada.
 */

/** true se o texto copiado parece código: multiline, substancial e com
 * sinais de código (pontuação típica ou palavras-chave no início de linha).
 * Prosa em português raramente passa. */
export function looksLikeCode(text: string): boolean {
  if (!text.includes("\n")) return false;
  if (text.trim().length < 40) return false;
  const head = text.slice(0, 600);
  return (
    /[{;=<>]/.test(head) ||
    /^(#!|import\s|from\s|def\s|const\s|let\s|var\s|function\s|class\s|<!|#include|using\s)/m.test(
      text,
    )
  );
}

/** Linguagem pelo conteúdo (o evento copy não traz metadados). Barato e
 * suficiente para escolher a extensão do fallback (snippet.py, snippet.js…). */
export function guessLanguage(code: string): string {
  const head = code.slice(0, 400);
  if (/^#!.*python/.test(head)) return "python";
  if (/^\s*(import\s+\w|from\s+[\w.]+\s+import|def\s+\w+\s*\()/m.test(head)) return "python";
  if (/<!doctype html|<html[\s>]/i.test(head)) return "html";
  if (/^\s*<\?php/m.test(head)) return "php";
  if (/\b(function\s+\w|const\s|let\s|var\s)\w|=>\s*{/m.test(head)) return "javascript";
  if (/^\s*(public|private|protected)\s+(static\s+)?class/m.test(head)) return "java";
  if (/^\s*#include/m.test(head)) return "c";
  if (/^\s*using\s+\w+;/m.test(head)) return "csharp";
  if (/^\s*(package|func)\s+\w/m.test(head)) return "go";
  return "text";
}
