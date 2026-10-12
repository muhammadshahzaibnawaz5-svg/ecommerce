import type { Basis, Order, Report, ReportRow, Store } from "./types";

export const money = (rupees: number) => Math.round(rupees * 100);
export const rupees = (paisa: number) => paisa / 100;
export const formatMoney = (paisa: number) => `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: paisa % 100 ? 2 : 0 }).format(rupees(paisa))}`;
export const todayPK = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
export const dateLabel = (date: string, short = false) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }), timeZone: "Asia/Karachi" }).format(new Date(`${date}T12:00:00Z`));
export function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date; }
export function datesBetween(from: string, to: string) {
  if (!validDate(from) || !validDate(to) || from > to) throw new Error("Choose a valid date range; the start must be before the end.");
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { if (days.length >= 366) throw new Error("Choose a range of up to 366 days."); days.push(d); }
  return days;
}
export const sale = (o: Order) => o.items.reduce((sum, i) => sum + i.price * i.quantity, 0) - o.discount;
export const productCost = (o: Order, key: "material" | "packaging" | "labour") => o.items.reduce((sum, i) => sum + i[key] * i.quantity, 0);
export const advanceDue = (o: Order) => Math.round(sale(o) * 70 / 100);
export const heldInitial = (o: Order) => sale(o) - advanceDue(o);
export const courierCost = (o: Order) => o.deliveryCharge + o.returnCharge;
export const payoutDue = (o: Order) => heldInitial(o) - o.deliveryCharge;
export const paymentsOf = (o: Order, kind: string, asOf = "9999-12-31") => o.payments.filter(p => p.kind === kind && p.date <= asOf).reduce((s, p) => s + p.amount, 0);
export function completionDate(o: Order, asOf = "9999-12-31") {
  if (o.returnDate || o.cancelledDate || !o.deliveryDate || !o.verifiedDate || o.deliveryDate > asOf || o.verifiedDate > asOf || payoutDue(o) < 0) return undefined;
  if (paymentsOf(o, "advance", asOf) !== advanceDue(o) || paymentsOf(o, "payout", asOf) !== payoutDue(o)) return undefined;
  const receipts = o.payments.filter(p => ["advance", "payout"].includes(p.kind) && p.date <= asOf);
  // Zero payout must be confirmed explicitly by a zero-value payout entry.
  if (!receipts.some(p => p.kind === "payout")) return undefined;
  return [o.deliveryDate, o.verifiedDate, ...receipts.map(p => p.date)].sort().at(-1);
}
export function orderStatus(o: Order, asOf = "9999-12-31") {
  if (o.returnDate && o.returnDate <= asOf) return "Returned";
  if (o.cancelledDate && o.cancelledDate <= asOf) return "Cancelled";
  if (completionDate(o, asOf)) return "Completed";
  if (o.deliveryDate && o.deliveryDate <= asOf) return "Settlement Pending";
  if (o.dispatchDate && o.dispatchDate <= asOf) return paymentsOf(o, "advance", asOf) >= advanceDue(o) ? "Advance Received" : "Dispatched";
  if (o.packedDate && o.packedDate <= asOf) return "Packed";
  if (o.confirmedDate && o.confirmedDate <= asOf) return "Confirmed";
  return "New";
}
export function heldBalance(o: Order, asOf: string) {
  if (!o.dispatchDate || o.dispatchDate > asOf) return 0;
  if (o.returnDate && o.returnDate <= asOf) return heldInitial(o) - courierCost(o) - paymentsOf(o, "held-refund", asOf) - paymentsOf(o, "payout", asOf) - o.payments.filter(p => p.kind === "recovery" && p.fromHeld && p.date <= asOf).reduce((s, p) => s + p.amount, 0);
  const deductions = o.deliveryDate && o.deliveryDate <= asOf ? o.deliveryCharge : 0;
  return heldInitial(o) - deductions - paymentsOf(o, "payout", asOf);
}
export function fulfillmentStatus(o: Order, asOf = "9999-12-31") {
  if (o.returnDate && o.returnDate <= asOf) return "Returned";
  if (o.cancelledDate && o.cancelledDate <= asOf) return "Cancelled";
  if (o.deliveryDate && o.deliveryDate <= asOf) return "Delivered";
  if (o.dispatchDate && o.dispatchDate <= asOf) return "Transit";
  if (o.confirmedDate && o.confirmedDate <= asOf) return "Booked";
  return "Unbooked";
}
export function settlementStatus(o: Order, asOf = "9999-12-31") {
  if (o.cancelledDate && o.cancelledDate <= asOf) return "Not Applicable";
  if (o.returnDate && o.returnDate <= asOf) {
    const hasRefund = o.payments.some(p => p.kind === "held-refund" && p.date <= asOf);
    const recoveryReceived = paymentsOf(o, "recovery", asOf) === paymentsOf(o, "recovery");
    const reversed = paymentsOf(o, "reversal", asOf) === paymentsOf(o, "advance");
    const customerRefunded = paymentsOf(o, "customer-refund", asOf) === paymentsOf(o, "advance");
    return hasRefund && recoveryReceived && reversed && customerRefunded && o.recoveryConfirmed && heldBalance(o, asOf) === 0 ? "Return Reconciled" : "Return Pending";
  }
  if (completionDate(o, asOf)) return "Verified / Settled";
  if (o.deliveryDate && o.deliveryDate <= asOf) return "Under Verification";
  if (paymentsOf(o, "advance", asOf) === advanceDue(o)) return "Advance Received";
  return "Pending Advance";
}
export const orderMargin = (o: Order) => sale(o) - productCost(o, "material") - productCost(o, "packaging") - productCost(o, "labour") - courierCost(o);
export const returnLoss = (o: Order) => productCost(o, "packaging") + productCost(o, "labour") + (o.customerFundedReturnCourier ? 0 : courierCost(o)) + (o.reusable ? 0 : productCost(o, "material")) - paymentsOf(o, "recovery");
export function dailyExpense(amount: number, month: string, date: string) {
  if (date.slice(0, 7) !== month) return 0;
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const base = Math.floor(amount / count);
  return Number(date.slice(-2)) === count ? amount - base * (count - 1) : base;
}
// Advertising is a daily selling cost. Every day's ad spend is split evenly across
// the orders recognised that day (completion date for settled, delivery date for delivery).
export const ORDER_COST_NAMES = ["Material", "Packaging", "Labour", "Courier", "Advertising"] as const;
export function advertisingByDay(state: Store) {
  const map = new Map<string, number>();
  for (const e of state.expenses) {
    if (e.category !== "Advertising") continue;
    if (e.month) {
      const count = new Date(Date.UTC(Number(e.month.slice(0, 4)), Number(e.month.slice(5, 7)), 0)).getUTCDate();
      for (let day = 1; day <= count; day++) { const d = `${e.month}-${String(day).padStart(2, "0")}`; const value = dailyExpense(e.amount, e.month, d); if (value) map.set(d, (map.get(d) ?? 0) + value); }
    } else if (e.date) map.set(e.date, (map.get(e.date) ?? 0) + e.amount);
  }
  return map;
}
export function adShares(state: Store, basis: Basis) {
  const shares = new Map<string, number>();
  if (basis === "payments") return shares;
  const byDay = advertisingByDay(state); const ordersByDay = new Map<string, string[]>();
  for (const o of state.orders) { const d = basis === "settled" ? completionDate(o) : o.deliveryDate; if (d) { const list = ordersByDay.get(d) ?? []; list.push(o.id); ordersByDay.set(d, list); } }
  for (const [d, ids] of ordersByDay) { const dayAd = byDay.get(d) ?? 0; if (!dayAd || !ids.length) continue; const base = Math.floor(dayAd / ids.length); ids.forEach((id, i) => shares.set(id, i === ids.length - 1 ? dayAd - base * (ids.length - 1) : base)); }
  return shares;
}
export function buildReport(state: Store, from: string, to: string, basis: Basis): Report {
  const days = datesBetween(from, to);
  const inRange = (d?: string) => !!d && d >= from && d <= to;
  const rows: ReportRow[] = [];
  const push = (row: ReportRow) => { if (inRange(row.date)) rows.push(row); };
  let revenue = 0, directCosts = 0, orderCosts = 0, sharedCosts = 0, losses = 0;
  const costMap: Record<string, number> = {};
  const cost = (name: string, amount: number) => { if (amount) costMap[name] = (costMap[name] ?? 0) + amount; };
  const orderCostNames = ORDER_COST_NAMES as readonly string[];
  // Exact order cost = material + packaging + labour + delivery charge + advertising.
  const addOrderCost = (name: string, value: number) => { directCosts += value; if (orderCostNames.includes(name)) orderCosts += value; cost(name, value); };
  const financial = (id: string, date: string, reference: string, description: string, category: string, amount: number, provisional = false) => push({ id, date, reference, description, category, amount, provisional });
  const advertising = basis === "payments" ? new Map<string, number>() : advertisingByDay(state);
  const shares = adShares(state, basis);
  const recognizes = (o: Order) => basis === "settled" ? completionDate(o) : o.deliveryDate;

  for (const o of state.orders) {
    const completed = completionDate(o);
    if (basis === "settled" && completed && inRange(completed)) {
      revenue += sale(o);
      financial(`${o.id}-sale`, completed, o.id, `${o.customer} · completed sale`, "Revenue", sale(o));
      const parts: [string, number][] = [["Material", productCost(o, "material")], ["Packaging", productCost(o, "packaging")], ["Labour", productCost(o, "labour")], ["Courier", o.deliveryCharge + o.returnCharge], ["Advertising", shares.get(o.id) ?? 0]];
      for (const [name, value] of parts) { if (!value) continue; addOrderCost(name, value); financial(`${o.id}-${name}`, completed, o.id, `${o.customer} · ${name.toLowerCase()}`, name, -value); }
    }
    if (basis === "settled" && o.returnDate && inRange(o.returnDate)) {
      const loss = returnLoss(o) + paymentsOf(o, "recovery"); losses += loss; cost("Other costs", loss);
      financial(`${o.id}-return`, o.returnDate, o.id, `${o.customer} · nonrecoverable return costs`, "Return loss", -loss, !o.recoveryConfirmed);
    }
    if (basis === "settled" && o.returnDate) for (const p of o.payments) if (p.kind === "recovery" && inRange(p.date)) {
      losses -= p.amount; cost("Other costs", -p.amount);
      financial(p.id, p.date, o.id, `${o.customer} · business expense recovery`, "Return recovery", p.amount);
    }
    if (basis === "delivery") for (const e of o.ledger) if (inRange(e.date)) {
      const contribution = ["Revenue", "Recovery"].includes(e.category) ? e.amount : -e.amount;
      if (e.category === "Revenue") revenue += e.amount;
      else addOrderCost(orderCostNames.includes(e.category) ? e.category : "Other costs", -contribution);
      financial(e.id, e.date, o.id, `${o.customer} · ${e.note}`, e.category, contribution, !!o.returnDate && !o.recoveryConfirmed && e.date === o.returnDate);
    }
    if (basis === "payments") for (const p of o.payments) {
      const positive = ["advance", "payout", "recovery"].includes(p.kind);
      financial(p.id, p.date, o.id, `${o.customer} · ${p.note}`, p.kind === "held-refund" || p.kind === "customer-refund" ? "Customer refund (courier)" : positive ? "Cash received" : "Cash paid", positive ? p.amount : -p.amount);
    }
  }
  if (basis !== "payments") for (const d of days) {
    const dayAd = advertising.get(d) ?? 0;
    const recognised = state.orders.some(o => recognizes(o) === d);
    if (dayAd && !recognised) sharedCosts += dayAd;
  }
  for (const e of state.expenses) {
    if (basis !== "payments" && e.category !== "Inventory purchase" && e.category !== "Advertising") for (const d of days) {
      const amount = e.month ? dailyExpense(e.amount, e.month, d) : e.date === d ? e.amount : 0;
      if (amount) sharedCosts += amount;
    }
    if (basis === "payments" && e.paidDate) financial(`${e.id}-paid`, e.paidDate, e.id, e.description, "Cash paid", -e.amount);
  }
  for (const a of state.adjustments) if ((a.basis === basis || (a.basis === "both" && basis !== "payments")) && inRange(a.date)) {
    financial(a.id, a.date, a.reference, a.reason, basis === "payments" ? a.amount >= 0 ? "Cash received" : "Cash paid" : "Correction", a.amount);
    if (basis !== "payments") { directCosts -= a.amount; cost("Other costs", -a.amount); }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.reference.localeCompare(b.reference));
  // Courier-held customer refunds do not leave the business account.
  let received = 0, paid = 0;
  for (const o of state.orders) for (const p of o.payments) if (inRange(p.date)) {
    if (["advance", "payout", "recovery"].includes(p.kind)) received += p.amount;
    if (p.kind === "reversal") paid += p.amount;
  }
  for (const e of state.expenses) if (inRange(e.paidDate)) paid += e.amount;
  for (const a of state.adjustments) if (a.basis === "payments" && inRange(a.date)) a.amount >= 0 ? received += a.amount : paid -= a.amount;
  const series = days.map(date => {
    const entries = rows.filter(r => r.date === date && r.category !== "Customer refund (courier)");
    return { date, revenue: entries.filter(r => ["Revenue", "Cash received"].includes(r.category)).reduce((s, r) => s + r.amount, 0), costs: -entries.filter(r => !["Revenue", "Cash received"].includes(r.category)).reduce((s, r) => s + r.amount, 0), profit: entries.reduce((s, r) => s + r.amount, 0) };
  });
  return { basis, from, to, revenue, directCosts, orderCosts, sharedCosts, returnLoss: losses, profit: basis === "payments" ? received - paid : revenue - directCosts - losses, received, paid,
    held: state.orders.reduce((s, o) => s + heldBalance(o, to), 0), heldOpening: state.orders.reduce((s, o) => s + heldBalance(o, addDays(from, -1)), 0),
    pending: state.orders.filter(o => o.deliveryDate && o.deliveryDate <= to && (!o.returnDate || o.returnDate > to)).reduce((s, o) => s + Math.max(0, payoutDue(o) - paymentsOf(o, "payout", to)), 0),
    completed: state.orders.filter(o => inRange(completionDate(o))).length, placed: state.orders.filter(o => inRange(o.placedDate)).length,
    delivered: state.orders.filter(o => inRange(o.deliveryDate)).length, returned: state.orders.filter(o => inRange(o.returnDate)).length,
    rows, costs: Object.entries(costMap).map(([name, amount]) => ({ name, amount })), series, provisional: rows.some(r => r.provisional) };
}
