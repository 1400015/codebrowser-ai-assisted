import type { PlatformAdapter } from "../types/platform";
import { makeGenericAdapter } from "./generic";

const HOSTS: Record<string, { name: string; hosts: string[] }> = {
  chatgpt: { name: "ChatGPT", hosts: ["chatgpt.com", "chat.openai.com"] },
  grok: { name: "Grok", hosts: ["grok.com", "x.com"] },
  qwen: { name: "Qwen", hosts: ["chat.qwen.ai", "qianwen.aliyun.com", "www.qianwen.com"] },
  deepseek: { name: "DeepSeek", hosts: ["chat.deepseek.com"] },
};

export const adapters: PlatformAdapter[] = Object.entries(HOSTS).map(([id, meta]) =>
  makeGenericAdapter(id, meta.name, meta.hosts),
);

export function detectAdapter(url: URL, doc: Document): PlatformAdapter | null {
  return adapters.find((a) => a.match(url, doc)) ?? null;
}
