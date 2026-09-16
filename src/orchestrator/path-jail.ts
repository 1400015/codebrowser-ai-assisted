/** Paths que saem do root escolhido pelo utilizador. A FSA já os recusa; nós recusamos antes. */
const ABSOLUTE = [/^\/+/, /^[a-zA-Z]:[\\/]/, /^~/];
/** Política de produto: o planner não vê nem escreve nestes directórios. `.env` NÃO está aqui. */
const BLOCKED_DIR = new Set([".git", "node_modules"]);
const WINDOWS_RESERVED = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);
const MAX_PATH = 240;
const MAX_SEGMENT = 80;

export interface PathCheck {
  path: string;
  errors: string[];
}

/** Diagnóstico puro: normaliza e lista erros. Não inventa um path alternativo. */
export function inspectPath(raw: string | undefined): PathCheck {
  const errors: string[] = [];
  let path = (raw ?? "").trim().replace(/\\/g, "/");
  path = path.replace(/^\.\//, "");

  if (!path || path === ".") {
    errors.push("caminho vazio ou é um directório");
  }
  if (path.endsWith("/")) {
    errors.push("caminho vazio ou é um directório");
    path = path.replace(/\/+$/, "");
  }
  if (path.includes("..")) {
    errors.push("path traversal (..)");
  }
  for (const re of ABSOLUTE) {
    if (re.test(path)) {
      errors.push("caminho absoluto ou inválido");
      break;
    }
  }
  if (/[\u0000-\u001f]/.test(path)) {
    errors.push("caracteres de controlo no path");
  }
  if (path.length > MAX_PATH) {
    errors.push("path demasiado longo");
  }

  const parts = path.split("/");
  for (const part of parts) {
    if (part === "" || part === ".") {
      errors.push("segmento de path vazio");
      break;
    }
    if (part.length > MAX_SEGMENT) {
      errors.push("segmento demasiado longo");
    }
    if (BLOCKED_DIR.has(part.toLowerCase())) {
      errors.push(`directório reservado: ${part}`);
    }
    if (WINDOWS_RESERVED.has(part.toLowerCase())) {
      errors.push(`nome reservado: ${part}`);
    }
  }

  return { path, errors: [...new Set(errors)] };
}

/** Para planeamento: se inválido, devolve fallback + erros. */
export function jailPath(raw: string | undefined, fallback: string): PathCheck {
  const checked = inspectPath(raw);
  if (checked.errors.length === 0 && checked.path) return checked;
  const fb = inspectPath(fallback);
  return {
    path: fb.errors.length === 0 && fb.path ? fb.path : "captured/snippet.txt",
    errors: checked.errors.length ? checked.errors : fb.errors,
  };
}

/** Recusa sem fallback. A camada FS deve usar isto. */
export function assertSafePath(raw: string): string {
  const checked = inspectPath(raw);
  if (checked.errors.length > 0 || !checked.path) {
    throw new Error(checked.errors.join("; ") || "path inválido");
  }
  return checked.path;
}

export function fallbackName(language: string): string {
  const ext: Record<string, string> = {
    typescript: "ts",
    javascript: "js",
    python: "py",
    bash: "sh",
    shell: "sh",
    html: "html",
    css: "css",
    json: "json",
    rust: "rs",
    go: "go",
    markdown: "md",
    text: "txt",
  };
  const e = ext[language.toLowerCase()] ?? "txt";
  return `captured/snippet.${e}`;
}
