import type { ActivityEvent } from "../types/activity";

export function formatLine(ev: ActivityEvent): string {
  const hh = new Date(ev.ts).toLocaleTimeString("pt-PT", { hour12: false });
  const plat = (ev.platform ?? "\u2014").padEnd(10, " ");
  return `${hh}  ${ev.source.padEnd(8, " ")}  ${plat}  ${ev.message}`;
}

export function newId(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
