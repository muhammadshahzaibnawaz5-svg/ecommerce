import { readStore } from "@/lib/store";
import DemoApp from "@/components/demo-app";
export const dynamic = "force-dynamic";
export default async function Page() {
  const state = await readStore();
  return <DemoApp initialState={state} />;
}
