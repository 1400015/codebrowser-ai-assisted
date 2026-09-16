export interface WorkspaceIO {
  readonly opened: boolean;
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, content: string): Promise<void>;
  appendFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
}
