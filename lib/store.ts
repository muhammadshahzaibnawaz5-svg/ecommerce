import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Store } from "./types";
import { seedStore } from "./seed";
// Serverless hosts such as Vercel mount the deployment bundle read-only, so
// process.cwd()/.data cannot be written and every request would fail. Use the
// writable temp directory there, and keep an in-memory copy as a final fallback.
const folder = process.env.HISAB_DATA_DIR ? path.resolve(process.env.HISAB_DATA_DIR) : process.env.VERCEL ? path.join(os.tmpdir(), "hisab-data") : path.join(process.cwd(), ".data");
const file = path.join(folder, "demo.json");
const globals = globalThis as typeof globalThis & { demoQueue?: Promise<unknown>; demoMemory?: Store; demoVolatile?: boolean };
const readOnly = (code?: string) => code === "EROFS" || code === "ENOSPC" || code === "EACCES" || code === "EPERM";
function memoryState(): Store {
  globals.demoMemory ??= seedStore();
  return structuredClone(globals.demoMemory);
}
async function load(): Promise<Store> {
  if (globals.demoVolatile) return memoryState();
  try {
    const state = JSON.parse(await readFile(file, "utf8")) as Store;
    if (state.version !== 1 || !Array.isArray(state.orders)) throw new Error("Unsupported sample data. Restore a backup or reset the demo.");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const state = seedStore();
    await persist(state);
    return globals.demoVolatile ? memoryState() : state;
  }
}
async function persist(state: Store) {
  if (globals.demoVolatile) { globals.demoMemory = structuredClone(state); return; }
  try {
    await mkdir(folder, { recursive: true }); const temp = `${file}.tmp`;
    await writeFile(temp, JSON.stringify(state, null, 2), "utf8"); await rename(temp, file);
  } catch (error) {
    if (!readOnly((error as NodeJS.ErrnoException).code)) throw error;
    globals.demoVolatile = true; globals.demoMemory = structuredClone(state);
  }
}
export async function updateStore<T>(operation: (state: Store) => Promise<{ state: Store; result: T }> | { state: Store; result: T }): Promise<T> {
  const next = (globals.demoQueue ?? Promise.resolve()).catch(() => undefined).then(async () => { const previous = await load(); const { state, result } = await operation(structuredClone(previous)); await persist(state); return result; });
  globals.demoQueue = next; return next;
}
export async function readStore() {
  await (globals.demoQueue ?? Promise.resolve()).catch(() => undefined);
  // Initialization is serialized as well, avoiding concurrent first-request seed writes.
  return updateStore(state => ({ state, result: state }));
}
