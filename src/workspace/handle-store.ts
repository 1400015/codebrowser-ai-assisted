/** Persistência do handle da workspace em IndexedDB.
 *
 * Decisão 2026-09-23: o handle da pasta vivia só na memória do side panel —
 * fechar o painel perdia a workspace e o popup de captura não podia gravar
 * sem re-escolher a pasta. A File System Access API permite guardar handles
 * em IndexedDB (são structured-cloneable); a permissão persiste entre
 * sessões como "granted" ou volta a "prompt", e `requestPermission` só pode
 * correr dentro de um gesto do utilizador (clique) — nunca no arranque.
 *
 * Contrato: nenhuma função lança por falta de IndexedDB (node/testes) —
 * devolve null/false e a extensão continua a funcionar por `pick()`.
 */

const DB_NAME = "codebrowser-ws";
const DB_VERSION = 1;
const STORE = "handles";
const KEY = "workspace-root";

/** Handle com as extensões de permissão da spec (query/requestPermission).
 * O cast é local: as declarações DOM do TS nem sempre incluem estes métodos. */
interface PermissionCapableHandle {
  queryPermission?(desc: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(desc: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

export async function saveRoot(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const db = await open();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

/** Handle guardado ou null (nada guardado / IndexedDB indisponível). */
export async function loadSavedRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await open();
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearSavedRoot(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // limpar é best-effort
  }
}

/** Só consulta (sem gesto): true se a permissão já está concedida. */
export async function hasPermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  const cap = handle as FileSystemDirectoryHandle & PermissionCapableHandle;
  try {
    if (!cap.queryPermission) return false;
    return (await cap.queryPermission({ mode })) === "granted";
  } catch {
    return false;
  }
}

/** Consulta e, se preciso, pede ao utilizador. TEM de correr num clique
 * (gesto) — fora de gesto o browser recusa e devolve false. */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  if (await hasPermission(handle, mode)) return true;
  const cap = handle as FileSystemDirectoryHandle & PermissionCapableHandle;
  try {
    if (!cap.requestPermission) return false;
    return (await cap.requestPermission({ mode })) === "granted";
  } catch {
    return false;
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
