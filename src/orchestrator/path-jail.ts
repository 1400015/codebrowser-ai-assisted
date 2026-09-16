const BAD = [/^\/+/, /^[a-zA-Z]:[\\/]/, /^~/, /\\/];

export function jailPath(raw: string | undefined, fallback: string): {
  path: string;
  errors: string[];
} {
  const errors: string[] = [];
  let path = (raw || fallback).trim().replace(/\\/g, "/");
  path = path.replace(/^\.\//, "");

  if (!path || path === "." || path.endsWith("/")) {
    errors.push("caminho vazio ou é um directório");
    path = fallback;
  }
  if (path.includes("..")) {
    errors.push("path traversal (..)");
    path = fallback;
  }
  for (const re of BAD) {
    if (re.test(path)) {
      errors.push("caminho absoluto ou inválido");
      path = fallback;
      break;
    }
  }
  if (path.split("/").some((p) => p === "" || p === ".")) {
    errors.push("segmento de path vazio");
    path = fallback;
  }
  return { path, errors };
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
