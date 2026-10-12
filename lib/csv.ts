import Papa from "papaparse";
import type { ImportKind, ImportRow, Role, Store } from "./types";
import { applyAction } from "./actions";
import { money } from "./finance";

export const csvColumns: Record<ImportKind, string[]> = {
  orders: ["id", "customer", "city", "product_sku", "quantity", "unit_price", "placed_date", "courier", "delivery_charge", "discount", "tracking"],
  expenses: ["id", "category", "description", "amount", "date", "paid_date", "month", "platform", "campaign"],
  settlements: ["payment_id", "order_id", "type", "amount", "date"],
};
function decimal(value: string, label: string, zeroDefault = false) {
  if (!value && zeroDefault) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error(`${label} must be a nonnegative rupee amount with up to 2 decimals.`);
  return money(Number(value));
}
export function previewImport(state: Store, kind: ImportKind, source: string, role: Role) {
  if (source.length > 300_000) throw new Error("Use a CSV smaller than 300 KB.");
  const parsed = Papa.parse<Record<string, string>>(source.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: h => h.trim().toLowerCase(), transform: v => v.trim() });
  if (parsed.errors.length) throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
  if (!parsed.data.length || parsed.data.length > 200) throw new Error("Import between 1 and 200 records at a time.");
  const headers = parsed.meta.fields ?? [];
  const required = kind === "orders" ? ["id", "customer", "city", "product_sku", "quantity", "unit_price", "placed_date", "courier"] : kind === "expenses" ? ["id", "category", "description", "amount", "date"] : csvColumns.settlements;
  const missing = required.filter(h => !headers.includes(h)); if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
  const work = structuredClone(state); const rows: ImportRow[] = [];
  for (let n = 0; n < parsed.data.length; n++) {
    const v = parsed.data[n]; const row: ImportRow = { line: n + 2, values: v, errors: [], duplicate: false };
    try {
      row.duplicate = kind === "orders" ? work.orders.some(o => o.id === v.id) : kind === "expenses" ? work.expenses.some(e => e.id === v.id) : work.orders.some(o => o.payments.some(p => p.id === v.payment_id));
      if (!row.duplicate) applyCsvRow(work, kind, v, role);
    } catch (e) { row.errors.push(e instanceof Error ? e.message : "Invalid record."); }
    rows.push(row);
  }
  return rows;
}
export function applyCsvRow(state: Store, kind: ImportKind, v: Record<string, string>, role: Role) {
  if (kind === "orders") {
    const product = state.products.find(p => p.sku === v.product_sku); if (!product) throw new Error(`Unknown product SKU: ${v.product_sku}`);
    applyAction(state, role, "order-save", { id: v.id, customer: v.customer, city: v.city, courier: v.courier, tracking: v.tracking || "", placedDate: v.placed_date, discount: decimal(v.discount, "Discount", true), deliveryCharge: decimal(v.delivery_charge, "Delivery charge", true), items: [{ productId: product.id, quantity: Number(v.quantity), price: decimal(v.unit_price, "Unit price") }] });
  } else if (kind === "expenses") applyAction(state, role, "expense-save", { id: v.id, category: v.category, description: v.description, amount: decimal(v.amount, "Amount"), date: v.date, paidDate: v.paid_date || "", month: v.month || "", platform: v.platform || "", campaign: v.campaign || "" });
  else {
    if (!["advance", "payout"].includes(v.type)) throw new Error("Payment type must be advance or payout.");
    applyAction(state, role, v.type, { id: v.order_id, date: v.date, amount: decimal(v.amount, "Amount"), paymentId: v.payment_id });
  }
}
export const exportCsv = (rows: Record<string, string | number | boolean | undefined>[]) => Papa.unparse(rows, { escapeFormulae: true });
