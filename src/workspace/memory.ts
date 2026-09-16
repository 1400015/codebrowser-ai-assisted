import type { WorkspaceIO } from "./io";
import { assertSafePath } from "../orchestrator/path-jail";
import { createQueue } from "./queue";

export class MemoryWorkspace implements WorkspaceIO {
  private files = new Map<string, string>();
  private readonly run = createQueue();
  opened = true;

  seed(path: string, content: string): void {
    this.files.set(assertSafePath(path), content);
  }

  async readFile(path: string): Promise<string | null> {
    const safe = assertSafePath(path);
    return this.files.has(safe) ? this.files.get(safe)! : null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    return this.run(async () => {
      const safe = assertSafePath(path);
      this.files.set(safe, content);
    });
  }

  async appendFile(path: string, content: string): Promise<void> {
    return this.run(async () => {
      const safe = assertSafePath(path);
      const existing = this.files.get(safe) ?? "";
      const joined = existing ? `${existing.replace(/\s+$/, "")}\n${content}` : content;
      this.files.set(safe, joined);
    });
  }

  async deleteFile(path: string): Promise<void> {
    return this.run(async () => {
      const safe = assertSafePath(path);
      this.files.delete(safe);
    });
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}
