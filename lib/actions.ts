import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Costs, Order, Role, Store } from "./types";
import { advanceDue, completionDate, courierCost, heldInitial, paymentsOf, payoutDue, productCost, sale, todayPK, validDate } from "./finance";

const id = () => randomUUID();
const text = z.string().trim().min(1).max(160);
const amount = z.number().int().min(0).max(100_000_000_000);
const date = z.string().refine(validDate, "Enter a real calendar date (YYYY-MM-DD).");
const eventDate = date.refine(d => d <= todayPK(), "Actual activity cannot be recorded in the future.");
const costs = { material: amount, packaging: amount, labour: amount };
const productSchema = z.object({ id: text.optional(), name: text, sku: text, color: z.string().regex(/^#[0-9a-f]{6}$/i), price: amount.positive(), ...costs });
const orderSchema = z.object({ id: text.optional(), customer: text, city: text, courier: text, tracking: z.string().max(100).default(""), placedDate: eventDate, discount: amount, deliveryCharge: amount,
  items: z.array(z.object({ productId: text, quantity: z.number().int().min(1).max(100), price: amount.positive() })).min(1).max(20) });
const expenseSchema = z.object({ id: text.optional(), category: z.enum(["Advertising", "Salary", "Rent", "Utilities", "Other", "Inventory purchase"]), description: text, amount: amount.positive(), date: date, paidDate: z.union([eventDate, z.literal("")]), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$|^$/), platform: z.string().max(100), campaign: z.string().max(160), reason: z.string().max(300).optional() });
const eventSchema = z.object({ id: text, date: eventDate });
export class ActionError extends Error { constructor(message: string, public status = 400) { super(message); } }
function requireFinance(role: Role) { if (role === "Operations") throw new ActionError("Operations can manage delivery activity, but only Owner or Finance can edit financial records.", 403); }
function requireOps(role: Role) { if (role === "Finance") throw new ActionError("Use Owner or Operations to manage order activity.", 403); }
function noEarlier(d: string, lower?: string) { if (lower && d < lower) throw new ActionError(`This event cannot be before ${lower}.`); }
function ledger(o: Order, d: string, category: "Revenue" | "Material" | "Packaging" | "Labour" | "Courier" | "Recovery", value: number, note: string) { if (value) o.ledger.push({ id: id(), date: d, category, amount: value, note }); }

export function applyAction(state: Store, role: Role, action: string, raw: unknown) {
  let description = ""; let before: unknown;
  if (action === "order-delete") {
    requireFinance(role);
    const request = z.object({ id: text, confirm: z.literal(true) }).parse(raw);
    const order = state.orders.find(o => o.id === request.id);
    if (!order) throw new ActionError("Order not found.", 404);
    state.orders = state.orders.filter(o => o.id !== request.id);
    state.adjustments = state.adjustments.filter(a => a.reference !== request.id);
    state.audit = state.audit.filter(a => {
      const snapshot = a.before as { id?: string; reference?: string } | undefined;
      return snapshot?.id !== request.id && snapshot?.reference !== request.id && !a.description.split(/[\s·]+/).includes(request.id);
    });
    description = `Deleted order ${request.id} and its linked financial records; products and shared expenses kept.`;
  } else if (action === "product-save") {
    requireFinance(role); const p = productSchema.parse(raw);
    if (state.products.some(x => x.sku === p.sku && x.id !== p.id)) throw new ActionError("This SKU already exists.");
    const old = state.products.find(x => x.id === p.id); before = old ? structuredClone(old) : undefined;
    const next = { ...p, id: p.id ?? id() };
    if (old) Object.assign(old, next); else state.products.push(next);
    description = `${old ? "Updated" : "Added"} product ${p.name}; existing order costs are preserved.`;
  } else if (action === "expense-save") {
    requireFinance(role); const e = expenseSchema.parse(raw); const old = state.expenses.find(x => x.id === e.id);
    if (old && !e.reason?.trim()) throw new ActionError("Explain the correction so the previous expense remains traceable.");
    if (e.month && !["Salary", "Rent", "Utilities", "Other"].includes(e.category)) throw new ActionError("Monthly allocation is for operating costs, not ad spend or inventory purchases.");
    before = old ? structuredClone(old) : undefined; const { reason, ...fields } = e; const next = { ...fields, id: e.id ?? id() };
    if (old) Object.assign(old, next); else state.expenses.push(next);
    description = `${old ? "Corrected" : "Added"} ${e.description}${reason ? `: ${reason}` : ""}`;
  } else if (action === "order-save") {
    requireOps(role); const x = orderSchema.parse(raw); const old = state.orders.find(o => o.id === x.id);
    if (old?.dispatchDate || old?.cancelledDate) {
      if (JSON.stringify(old.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))) !== JSON.stringify(x.items) || old.discount !== x.discount || old.deliveryCharge !== x.deliveryCharge || old.placedDate !== x.placedDate) throw new ActionError("Dispatched financial amounts are preserved. Use a traceable correction instead of rewriting history.");
      before = structuredClone(old); Object.assign(old, { customer: x.customer, city: x.city, courier: x.courier, tracking: x.tracking });
    } else {
      const items = x.items.map(i => { const p = state.products.find(p => p.id === i.productId); if (!p) throw new ActionError("Choose an existing product."); return { ...i, name: p.name, material: p.material, packaging: p.packaging, labour: p.labour }; });
      if (x.discount >= items.reduce((s, i) => s + i.quantity * i.price, 0)) throw new ActionError("Discount must be less than the order value.");
      const nextNumber = Math.max(1000, ...state.orders.map(o => /^HB-\d+$/.test(o.id) ? Number(o.id.slice(3)) : 0)) + 1;
      const next: Order = { ...x, id: x.id ?? `HB-${String(nextNumber).padStart(4, "0")}`, items, returnCharge: 0, reusable: true, recoveryConfirmed: false, payments: [], ledger: [] };
      if (payoutDue(next) < 0) throw new ActionError("Courier deductions exceed the held 30%. Enter charges within the held balance; excess deductions are outside the agreed workflow.");
      before = old ? structuredClone(old) : undefined;
      if (old) Object.assign(old, next); else { if (state.orders.some(o => o.id === next.id)) throw new ActionError("Order reference already exists."); state.orders.push(next); }
    }
    description = `${old ? "Updated" : "Created"} order for ${x.customer}`;
  } else if (action === "correction") {
    requireFinance(role); const a = z.object({ reference: text, date: eventDate, basis: z.enum(["settled", "delivery", "payments", "both"]), amount: z.number().int().min(-100_000_000_000).max(100_000_000_000).refine(n => n !== 0), reason: z.string().trim().min(8).max(400) }).parse(raw);
    if (!state.orders.some(o => o.id === a.reference) && !state.expenses.some(e => e.id === a.reference)) throw new ActionError("Choose an existing order or expense reference.");
    state.adjustments.push({ ...a, id: id() }); description = `Dated correction for ${a.reference}: ${a.reason}`;
  } else {
    const e = eventSchema.parse(raw); const o = state.orders.find(o => o.id === e.id);
    if (!o) throw new ActionError("Order not found.", 404);
    before = structuredClone(o);
    if (action === "confirm") {
      requireOps(role); if (o.confirmedDate || o.dispatchDate || o.cancelledDate) throw new ActionError("Only a new order can be confirmed.");
      noEarlier(e.date, o.placedDate); o.confirmedDate = e.date;
    } else if (action === "pack") {
      requireOps(role); if (!o.confirmedDate || o.packedDate || o.dispatchDate || o.cancelledDate) throw new ActionError("Confirm this order before recording packing.");
      noEarlier(e.date, o.confirmedDate); o.packedDate = e.date;
    } else if (action === "dispatch") {
      requireOps(role); if (o.dispatchDate || o.cancelledDate) throw new ActionError("This order cannot be dispatched again.");
      if (!o.packedDate) throw new ActionError("Confirm and pack the order before dispatch.");
      noEarlier(e.date, o.packedDate); o.dispatchDate = e.date;
    } else if (action === "cancel") {
      requireOps(role); if (o.dispatchDate || o.cancelledDate) throw new ActionError("Only a new order can be cancelled."); noEarlier(e.date, o.placedDate); o.cancelledDate = e.date;
    } else if (action === "deliver") {
      requireOps(role); if (!o.dispatchDate || o.deliveryDate || o.returnDate) throw new ActionError("Dispatch the order before recording one delivery.");
      noEarlier(e.date, o.dispatchDate); o.deliveryDate = e.date;
      ledger(o, e.date, "Revenue", sale(o), "delivered sale");
      for (const k of ["material", "packaging", "labour"] as (keyof Costs)[]) ledger(o, e.date, `${k[0].toUpperCase()}${k.slice(1)}` as "Material" | "Packaging" | "Labour", productCost(o, k), k);
      ledger(o, e.date, "Courier", o.deliveryCharge, "delivery charge");
    } else if (action === "advance" || action === "payout") {
      requireFinance(role); const p = z.object({ amount, paymentId: text.optional() }).parse(raw);
      if (!o.dispatchDate || o.returnDate || o.cancelledDate) throw new ActionError("Only an active dispatched order can receive payments.");
      noEarlier(e.date, action === "payout" ? o.deliveryDate : o.dispatchDate);
      if (action === "payout" && !o.deliveryDate) throw new ActionError("Final courier payout requires actual delivery.");
      const due = action === "advance" ? advanceDue(o) : payoutDue(o);
      if (due < 0) throw new ActionError("Deductions exceed the held balance; business review is required.");
      if (p.amount === 0 && (action !== "payout" || due !== 0 || o.payments.some(p => p.kind === "payout"))) throw new ActionError("Zero-value confirmation is only valid for a fully deducted, unconfirmed final payout.");
      if (paymentsOf(o, action) + p.amount > due) throw new ActionError("Receipt exceeds the remaining amount due.");
      if (p.paymentId && state.orders.some(o => o.payments.some(x => x.id === p.paymentId))) throw new ActionError("Payment reference already imported.");
      o.payments.push({ id: p.paymentId ?? id(), kind: action, date: e.date, amount: p.amount, note: action === "advance" ? "70% dispatch advance received" : "final courier payout received" });
    } else if (action === "verify") {
      requireFinance(role); if (!o.deliveryDate || o.returnDate || o.verifiedDate) throw new ActionError("Only an unverified delivered order can have costs verified.");
      noEarlier(e.date, o.deliveryDate); o.verifiedDate = e.date;
    } else if (action === "return") {
      requireFinance(role);
      const r = z.object({ returnCharge: amount, reusable: z.boolean(), recoveryConfirmed: z.boolean(), recovery: amount, reversalDate: eventDate.optional(), refundDate: eventDate.optional(), recoveryDate: eventDate.optional() }).parse(raw);
      if (!o.dispatchDate || o.returnDate || o.cancelledDate) throw new ActionError("Only an active dispatched order can be returned.");
      if (completionDate(o) || (o.deliveryDate && paymentsOf(o, "payout") === payoutDue(o) && o.payments.some(p => p.kind === "payout"))) throw new ActionError("Returns after final settlement are outside this demo workflow. Record an explicit correction instead.");
      if (paymentsOf(o, "payout") > 0) throw new ActionError("A return after partial payout requires a separately agreed settlement rule; use a correction for this demonstration.");
      noEarlier(e.date, o.deliveryDate ?? o.dispatchDate); for (const p of o.payments) noEarlier(e.date, p.date);
      const reversalDate = r.reversalDate ?? e.date, refundDate = r.refundDate ?? e.date;
      noEarlier(reversalDate, e.date); noEarlier(refundDate, reversalDate);
      const deductions = o.deliveryCharge + r.returnCharge;
      if (deductions + r.recovery > heldInitial(o)) throw new ActionError("Courier charges plus business expense recovery exceed the held 30%. Reduce the deductions; this case is outside the agreed workflow.");
      if (r.recovery > productCost(o, "packaging") + productCost(o, "labour") + (r.reusable ? 0 : productCost(o, "material"))) throw new ActionError("Recovery cannot exceed the business's recorded packaging, labour and non-reusable material costs.");
      if (r.recovery && !r.recoveryConfirmed) throw new ActionError("Confirm the actual business expense recovery before recording its receipt.");
      const recoveryDate = r.recoveryDate ?? e.date;
      noEarlier(recoveryDate, e.date);
      o.returnDate = e.date; o.returnCharge = r.returnCharge; o.reusable = r.reusable; o.recoveryConfirmed = r.recoveryConfirmed; o.customerFundedReturnCourier = true;
      const reversed = paymentsOf(o, "advance");
      if (reversed) o.payments.push({ id: id(), kind: "reversal", amount: reversed, date: reversalDate, note: "business advance reversed to courier" });
      if (reversed) o.payments.push({ id: id(), kind: "customer-refund", amount: reversed, date: refundDate, note: "courier refunded reversed advance to customer" });
      o.payments.push({ id: id(), kind: "held-refund", amount: heldInitial(o) - deductions - r.recovery, date: refundDate, note: "courier refunded held remainder after courier charges and business expense recovery" });
      if (o.deliveryDate) {
        ledger(o, e.date, "Revenue", -sale(o), "returned sale reversal");
        if (r.reusable) ledger(o, e.date, "Material", -productCost(o, "material"), "reusable material restored");
        ledger(o, e.date, "Courier", -o.deliveryCharge, "customer-funded courier cost reversal on return");
      } else {
        if (!r.reusable) ledger(o, e.date, "Material", productCost(o, "material"), "non-reusable return material");
        ledger(o, e.date, "Packaging", productCost(o, "packaging"), "spent return packaging");
        ledger(o, e.date, "Labour", productCost(o, "labour"), "spent return labour");
        // Courier charges are paid from the customer's refund, not business return costs.
      }
      if (r.recovery) { o.payments.push({ id: id(), kind: "recovery", amount: r.recovery, date: recoveryDate, fromHeld: true, note: "business expense recovery received from held 30%" }); ledger(o, recoveryDate, "Recovery", r.recovery, "return cost recovery from held 30%"); }
    } else throw new ActionError("Unknown action.");
    description = `${action} Â· ${o.id} Â· ${e.date}`;
  }
  state.audit.unshift({ id: id(), time: new Date().toISOString(), role, action, description, before });
  state.revision += 1;
  return state;
}
