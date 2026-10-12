import { readStore } from "@/lib/store";
import { seedStore } from "@/lib/seed";
import type { Store } from "@/lib/types";
import DemoApp from "@/components/demo-app";
export const dynamic = "force-dynamic";
export default async function Page() {
  // The sample store can fail on read-only/serverless hosts. Never let that
  // surface as a server error page; fall back to fresh seed data and let the
  // client load the authoritative state from /api/demo.
  let state: Store;
  try { state = await readStore(); } catch { state = seedStore(); }
  return <DemoApp initialState={state} />;
}
