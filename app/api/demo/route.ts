import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readStore, updateStore } from "@/lib/store";
import { ActionError, applyAction } from "@/lib/actions";
import { buildReport, todayPK } from "@/lib/finance";
import { seedStore } from "@/lib/seed";
import { applyCsvRow, exportCsv, previewImport } from "@/lib/csv";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown) {
  const message = error instanceof z.ZodError ? error.issues.map(x => `${x.path.join(".")}: ${x.message}`).join("; ") : error instanceof Error ? error.message : "Could not process this request.";
  return NextResponse.json({ error: message }, { status: error instanceof ActionError ? error.status : 400 });
}
export async function GET(request: NextRequest) {
  try {
    const state = await readStore(); const q = request.nextUrl.searchParams;
    const from = q.get("from") ?? todayPK(), to = q.get("to") ?? from;
    const basis = z.enum(["settled", "delivery", "payments"]).parse(q.get("basis") ?? "settled");
    const report = buildReport(state, from, to, basis);
    if (q.get("export") === "csv") {
      const rows = report.rows.map(r => ({ basis, from, to, date: r.date, reference: r.reference, description: r.description, category: r.category, amount_pkr: (r.amount / 100).toFixed(2), provisional: !!r.provisional }));
      const csv = rows.length ? exportCsv(rows) : "basis,from,to,date,reference,description,category,amount_pkr,provisional\r\n";
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hisab-${basis}-${from}-${to}.csv"`, "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ state, report }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    // Next's internal URL may use localhost even when the browser uses 127.0.0.1.
    // Validate against the actual request Host, not the internally reconstructed URL.
    if (origin && new URL(origin).host !== request.headers.get("host")) throw new ActionError("Use the demo from its own browser page.", 403);
    const raw = await request.text(); if (raw.length > 400_000) throw new ActionError("Request is too large.");
    const body = z.object({ action: z.string(), revision: z.number().int().optional(), data: z.unknown() }).parse(JSON.parse(raw));
    const role = z.enum(["Owner", "Operations", "Finance"]).parse(request.headers.get("x-demo-role") ?? "Owner") as Role;
    if (body.action === "import-preview") {
      const data = z.object({ kind: z.enum(["orders", "expenses", "settlements"]), csv: z.string() }).parse(body.data);
      const state = await readStore(); return NextResponse.json({ rows: previewImport(state, data.kind, data.csv, role), revision: state.revision });
    }
    const result = await updateStore<{ revision: number; imported?: number; skipped?: number }>(state => {
      if (body.revision !== state.revision) throw new ActionError("The sample changed in another window. Refresh and try again.", 409);
      if (body.action === "reset") {
        if (role !== "Owner") throw new ActionError("Only Owner can reset the sample.", 403);
        if ((body.data as { confirm?: boolean })?.confirm !== true) throw new ActionError("Confirm before resetting sample data.");
        const fresh = seedStore(); fresh.revision = state.revision + 1;
        fresh.audit.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), role, action: "reset", description: "Owner confirmed reset to original sample data." });
        return { state: fresh, result: { revision: fresh.revision } };
      }
      if (body.action === "import") {
        const data = z.object({ kind: z.enum(["orders", "expenses", "settlements"]), csv: z.string() }).parse(body.data);
        const preview = previewImport(state, data.kind, data.csv, role); const valid = preview.filter(r => !r.duplicate && !r.errors.length);
        if (!valid.length) throw new ActionError("There are no valid new rows to import.");
        for (const row of valid) applyCsvRow(state, data.kind, row.values, role);
        return { state, result: { imported: valid.length, skipped: preview.length - valid.length, revision: state.revision } };
      }
      applyAction(state, role, body.action, body.data); return { state, result: { revision: state.revision } };
    });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
