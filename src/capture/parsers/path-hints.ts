const PATTERNS: RegExp[] = [
  /^\s*(?:\/\/|#|--)\s*file:\s*(\S+)/i,
  /^\s*(?:\/\/|#|--)\s*filepath:\s*(\S+)/i,
  /^\s*(?:\/\/|#|--)\s*path:\s*(\S+)/i,
  /^\s*file:\s*(\S+)/i,
];

export function extractPathHint(code: string): string | undefined {
  const firstLines = code.split(/\r?\n/, 8);
  for (const line of firstLines) {
    for (const re of PATTERNS) {
      const m = line.match(re);
      if (m?.[1]) return sanitizeHint(m[1]);
    }
  }
  return undefined;
}

export function sanitizeHint(raw: string): string {
  return raw.replace(/^["'`]+|["'`:]+$/g, "").replace(/^\.\//, "");
}
