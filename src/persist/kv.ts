export interface KeyValueStore {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function chromeSession(): KeyValueStore {
  return {
    get: (keys) => chrome.storage.session.get(keys) as Promise<Record<string, unknown>>,
    set: (items) => chrome.storage.session.set(items),
  };
}

export function chromeLocal(): KeyValueStore {
  return {
    get: (keys) => chrome.storage.local.get(keys) as Promise<Record<string, unknown>>,
    set: (items) => chrome.storage.local.set(items),
  };
}

export class MemoryStore implements KeyValueStore {
  constructor(private data: Record<string, unknown> = {}) {}

  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    const list = Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const k of list) {
      if (k in this.data) out[k] = this.data[k];
    }
    return out;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, items);
  }
}
