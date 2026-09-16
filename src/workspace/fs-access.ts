import { assertSafePath } from "../orchestrator/path-jail";
import type { WorkspaceIO } from "./io";

export class Workspace implements WorkspaceIO {
  private root: FileSystemDirectoryHandle | null = null;

  get opened(): boolean {
    return this.root !== null;
  }

  async pick(): Promise<void> {
    this.root = await window.showDirectoryPicker({ mode: "readwrite" });
  }

  async listFiles(): Promise<string[]> {
    if (!this.root) return [];
    const out: string[] = [];
    await walk(this.root, "", out);
    return out;
  }

  async readFile(path: string): Promise<string | null> {
    try {
      const handle = await this.fileHandle(path, false);
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = await this.fileHandle(path, true);
    const w = await handle.createWritable();
    await w.write(content);
    await w.close();
  }

  async appendFile(path: string, content: string): Promise<void> {
    const existing = (await this.readFile(path)) ?? "";
    const joined = existing ? `${existing.replace(/\s+$/, "")}\n${content}` : content;
    await this.writeFile(path, joined);
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.root) throw new Error("workspace fechado");
    const safe = assertSafePath(path);
    const parts = safe.split("/");
    const name = parts.pop();
    if (!name) throw new Error("path inválido");
    let dir = this.root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }
    await dir.removeEntry(name);
  }

  private async fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    if (!this.root) throw new Error("workspace fechado");
    const safe = assertSafePath(path);
    const parts = safe.split("/");
    const name = parts.pop();
    if (!name) throw new Error("path inválido");
    let dir = this.root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir.getFileHandle(name, { create });
  }
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[],
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") out.push(path);
    else if (handle.kind === "directory" && name !== "node_modules" && name !== ".git") {
      await walk(handle, path, out);
    }
  }
}
