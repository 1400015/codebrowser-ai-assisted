import { DEFAULT_FALLBACK_MODEL, DEFAULT_PRIMARY_MODEL, normalizeModelId } from "./models";

export type AiMode = "auto" | "off";

export interface AiSettings {
  primaryModel: string;
  fallbackModel: string;
  apiKey: string;
  mode: AiMode;
}

export const DEFAULT_SETTINGS: AiSettings = {
  primaryModel: DEFAULT_PRIMARY_MODEL,
  fallbackModel: DEFAULT_FALLBACK_MODEL,
  apiKey: "",
  mode: "auto",
};

const SYNC_KEYS = ["aiPrimaryModel", "aiFallbackModel", "aiMode"] as const;
const LOCAL_KEY = "openrouterKey";

/** Normaliza valores vindos do storage. Aceita custom, UI lista :free por defeito. */
export function normalizeSettings(raw: Partial<AiSettings>): AiSettings {
  const mode: AiMode = raw.mode === "off" ? "off" : "auto";
  return {
    primaryModel: normalizeModelId(raw.primaryModel, DEFAULT_PRIMARY_MODEL),
    fallbackModel: normalizeModelId(raw.fallbackModel, DEFAULT_FALLBACK_MODEL),
    apiKey: (raw.apiKey ?? "").trim(),
    mode,
  };
}

function hasChrome(): boolean {
  return typeof globalThis !== "undefined" && !!(globalThis as unknown as { chrome?: unknown }).chrome;
}

export async function loadAiSettings(): Promise<AiSettings> {
  if (!hasChrome()) return { ...DEFAULT_SETTINGS };
  const chrome = (globalThis as unknown as { chrome: typeof globalThis & never }).chrome as unknown as {
    storage: {
      sync: { get: (k: string[]) => Promise<Record<string, unknown>> };
      local: { get: (k: string | string[]) => Promise<Record<string, unknown>> };
    };
  };
  try {
    const [sync, local] = await Promise.all([
      chrome.storage.sync.get([...SYNC_KEYS]),
      chrome.storage.local.get(LOCAL_KEY),
    ]);
    return normalizeSettings({
      primaryModel: typeof sync.aiPrimaryModel === "string" ? sync.aiPrimaryModel : undefined,
      fallbackModel: typeof sync.aiFallbackModel === "string" ? sync.aiFallbackModel : undefined,
      mode: sync.aiMode === "off" ? "off" : undefined,
      apiKey: typeof local[LOCAL_KEY] === "string" ? (local[LOCAL_KEY] as string) : "",
    });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAiSettings(s: AiSettings): Promise<void> {
  const n = normalizeSettings(s);
  if (!hasChrome()) return;
  const chrome = (globalThis as unknown as { chrome: typeof globalThis & never }).chrome as unknown as {
    storage: {
      sync: { set: (o: Record<string, unknown>) => Promise<void> };
      local: { set: (o: Record<string, unknown>) => Promise<void> };
    };
  };
  await chrome.storage.sync.set({
    aiPrimaryModel: n.primaryModel,
    aiFallbackModel: n.fallbackModel,
    aiMode: n.mode,
  });
  // Chave só em local, nunca em sync.
  await chrome.storage.local.set({ [LOCAL_KEY]: n.apiKey });
}
