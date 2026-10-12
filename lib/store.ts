import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Store } from "./types";
import { seedStore } from "./seed";
const folder = process.env.HISAB_DATA_DIR ? path.resolve(process.env.HISAB_DATA_DIR) : path.join(process.cwd(), ".data");
const file = path.join(folder, "demo.json");
const globals = globalThis as typeof globalThis & { demoQueue?: Promise<unknown> };
async function read(): Promise<Store> {
  try { const state = JSON.parse(await readFile(file, "utf8")) as Store; if (state.version !== 1 || !Array.isArray(state.orders)) throw new Error("Unsupported sample data. Restore a backup or reset the demo."); return state; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; const state = seedStore(); await save(state); return state; }
}
async function save(state: Store) {
  await mkdir(folder, { recursive: true }); const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2), "utf8"); await rename(temp, file);
}
export async function updateStore<T>(operation: (state: Store) => Promise<{ state: Store; result: T }> | { state: Store; result: T }): Promise<T> {
  const next = (globals.demoQueue ?? Promise.resolve()).catch(() => undefined).then(async () => { const previous = await read(); const { state, result } = await operation(structuredClone(previous)); await save(state); return result; });
  globals.demoQueue = next; return next;
}
export async function readStore() {
  await (globals.demoQueue ?? Promise.resolve()).catch(() => undefined);
  // Initialization is serialized as well, avoiding concurrent first-request seed writes.
  return updateStore(state => ({ state, result: state }));
}
