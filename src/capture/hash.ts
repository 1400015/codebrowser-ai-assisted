const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", encoder.encode(input));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return fallbackSha256(input);
}

export function blockId(path: string, action: string, code: string): Promise<string> {
  return sha256Hex(`${path}\n${action}\n${code}`);
}

function fallbackSha256(message: string): string {
  let h = 0xcbf29ce484222325n;
  for (const ch of encoder.encode(message)) {
    h ^= BigInt(ch);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}
