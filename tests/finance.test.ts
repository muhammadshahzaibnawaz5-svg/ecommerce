import test from "node:test";
import assert from "node:assert/strict";
import type { Store } from "../lib/types";
import { applyAction } from "../lib/actions";
import { addDays, advanceDue, buildReport, completionDate, dailyExpense, heldBalance, money, orderMargin, orderStatus, fulfillmentStatus, settlementStatus, todayPK } from "../lib/finance";
import { previewImport } from "../lib/csv";

const today = todayPK(), dispatch = addDays(today, -5), delivered = addDays(today, -2), settled = addDays(today, -1);
function fixture(): Store {
  return { version: 1, revision: 0, seedDate: today, adjustments: [], audit: [], expenses: [], products: [{ id: "p", sku: "TOTE", name: "Tote", price: money(10000), material: money(4000), packaging: money(200), labour: money(300), color: "#819b87" }], orders: [] };
}
function create() {
  const state = fixture();
  applyAction(state, "Owner", "order-save", { id: "TEST-1", customer: "Test Customer", city: "Lahore", courier: "Courier A", tracking: "", placedDate: addDays(dispatch, -1), discount: 0, deliveryCharge: money(500), items: [{ productId: "p", quantity: 1, price: money(10000) }] });
  applyAction(state, "Owner", "confirm", { id: "TEST-1", date: dispatch });
  applyAction(state, "Owner", "pack", { id: "TEST-1", date: dispatch });
  applyAction(state, "Owner", "dispatch", { id: "TEST-1", date: dispatch });
  return state;
}
function advance(state: Store) { applyAction(state, "Owner", "advance", { id: "TEST-1", date: dispatch, amount: money(7000) }); }
function deliver(state: Store) { applyAction(state, "Owner", "deliver", { id: "TEST-1", date: delivered }); }
function complete(state: Store) { advance(state); deliver(state); applyAction(state, "Owner", "payout", { id: "TEST-1", date: settled, amount: money(2500) }); applyAction(state, "Owner", "verify", { id: "TEST-1", date: settled }); }

test("dispatch and an actual advance produce cash, never profit", () => {
  const state = create(); advance(state);
  const report = buildReport(state, dispatch, dispatch, "settled");
  assert.equal(report.profit, 0); assert.equal(report.received, money(7000)); assert.equal(report.held, money(3000));
  assert.equal(orderStatus(state.orders[0]), "Advance Received");
});
test("delivery and settlement use different dates without duplicated courier deductions", () => {
  const state = create(); complete(state);
  assert.equal(buildReport(state, delivered, delivered, "settled").profit, 0);
  assert.equal(buildReport(state, delivered, delivered, "delivery").profit, money(5000));
  const result = buildReport(state, settled, settled, "settled");
  assert.equal(result.profit, money(5000)); assert.equal(result.received, money(2500)); assert.equal(result.held, 0);
  assert.equal(result.rows.reduce((s, r) => s + r.amount, 0), result.profit);
  assert.equal(completionDate(state.orders[0]), settled);
});
test("a partial payout cannot complete an order", () => {
  const state = create(); advance(state); deliver(state);
  applyAction(state, "Owner", "payout", { id: "TEST-1", date: settled, amount: money(1000) });
  applyAction(state, "Owner", "verify", { id: "TEST-1", date: settled });
  assert.equal(completionDate(state.orders[0]), undefined);
  assert.equal(buildReport(state, settled, settled, "settled").profit, 0);
  assert.equal(heldBalance(state.orders[0], settled), money(1500));
  assert.equal(orderStatus(state.orders[0]), "Settlement Pending");
});
test("cost verification is the final completion condition when delayed", () => {
  const state = create(); advance(state); deliver(state);
  applyAction(state, "Owner", "payout", { id: "TEST-1", date: settled, amount: money(2500) });
  applyAction(state, "Owner", "verify", { id: "TEST-1", date: today });
  assert.equal(buildReport(state, settled, settled, "settled").profit, 0);
  assert.equal(buildReport(state, today, today, "settled").profit, money(5000));
});
test("monthly allocations add exactly to their original amount, including rounding", () => {
  const month = "2026-10", amount = money(1000.01);
  assert.equal(Array.from({ length: 31 }, (_, n) => dailyExpense(amount, month, `2026-10-${String(n + 1).padStart(2, "0")}`)).reduce((a, b) => a + b, 0), amount);
  assert.equal(dailyExpense(money(31000), month, "2026-10-10"), money(1000));
});
test("operating costs are tracked but do not reduce the order-based settled result", () => {
  const state = fixture();
  applyAction(state, "Owner", "expense-save", { category: "Advertising", description: "Ads", amount: money(1000), date: today, paidDate: "", month: "", platform: "Meta", campaign: "Test" });
  const report = buildReport(state, today, today, "settled");
  assert.equal(report.profit, 0);
  assert.equal(report.sharedCosts, money(1000));
  assert.equal(buildReport(state, today, today, "payments").paid, 0);
});
test("a material purchase affects cash, not profit on the purchase date", () => {
  const state = fixture();
  applyAction(state, "Owner", "expense-save", { category: "Inventory purchase", description: "Fabric", amount: money(50000), date: today, paidDate: today, month: "", platform: "", campaign: "" });
  assert.equal(buildReport(state, today, today, "settled").profit, 0);
  assert.equal(buildReport(state, today, today, "payments").profit, -money(50000));
});
test("returns before delivery reverse cash without creating negative sales or duplicate business refunds", () => {
  const state = create(); advance(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: 0, reusable: true, recovery: 0, recoveryConfirmed: false });
  const o = state.orders[0];
  assert.equal(o.payments.find(p => p.kind === "held-refund")?.amount, money(2500));
  const report = buildReport(state, dispatch, today, "settled");
  assert.equal(report.revenue, 0); assert.equal(report.received, money(7000)); assert.equal(report.paid, money(7000));
  assert.equal(report.provisional, true); assert.equal(report.returnLoss, money(500)); // Packaging + labour, recovery unknown; courier is customer-funded.
  assert.equal(completionDate(o), undefined);
});
test("return after delivery reverses sales/material, preserves spent costs once", () => {
  const state = create(); advance(state); deliver(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: money(150), reusable: true, recovery: 0, recoveryConfirmed: true });
  const delivery = buildReport(state, dispatch, today, "delivery");
  const settledView = buildReport(state, dispatch, today, "settled");
  assert.equal(delivery.revenue, 0); assert.equal(delivery.profit, -money(500));
  assert.equal(settledView.profit, -money(500));
  assert.equal(buildReport(state, delivered, delivered, "delivery").profit, money(5000));
});
test("normal returns after final settlement are rejected", () => {
  const state = create(); complete(state);
  assert.throws(() => applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: 0, reusable: true, recovery: 0, recoveryConfirmed: true }), /outside this demo workflow/);
});
test("oversized deductions cannot create negative refunds", () => {
  const state = create(); advance(state);
  assert.throws(() => applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: money(4000), reusable: true, recovery: 0, recoveryConfirmed: false }), /exceed the held 30%/);
});
test("product default changes preserve historical order costs", () => {
  const state = create(); const previous = orderMargin(state.orders[0]);
  applyAction(state, "Finance", "product-save", { ...state.products[0], material: money(6000) });
  assert.equal(productCostForTest(state), money(4000)); assert.equal(orderMargin(state.orders[0]), previous);
});
function productCostForTest(state: Store) { return state.orders[0].items[0].material; }
test("full cost recovery gives zero return loss before or after delivery, without fake courier receipts", () => {
  for (const wasDelivered of [false, true]) {
    const state = create(); const o = state.orders[0]; o.deliveryCharge = money(300); advance(state);
    if (wasDelivered) deliver(state);
    applyAction(state, "Owner", "return", { id: o.id, date: today, returnCharge: 0, reusable: true, recovery: money(500), recoveryConfirmed: true });
    assert.equal(o.customerFundedReturnCourier, true);
    assert.equal(o.payments.find(p => p.kind === "held-refund")?.amount, money(2200));
    assert.equal(buildReport(state, today, today, "payments").received, money(500));
    assert.equal(buildReport(state, today, today, "payments").paid, money(7000));
    assert.equal(heldBalance(o, today), 0);
    for (const basis of ["settled", "delivery"] as const) {
      const r = buildReport(state, dispatch, today, basis);
      assert.equal(r.profit, 0); assert.equal(r.rows.reduce((s, r) => s + r.amount, 0), 0);
    }
    assert.equal(settlementStatus(o), "Return Reconciled");
  }
});
test("unusable returned product remains a business loss even when packaging and labour are recovered", () => {
  const state = create(); advance(state); deliver(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: money(150), reusable: false, recovery: money(500), recoveryConfirmed: true });
  for (const basis of ["settled", "delivery"] as const) assert.equal(buildReport(state, dispatch, today, basis).profit, -money(4000));
});
test("legacy returns retain original courier cost accounting and reports do not mutate records", () => {
  const state = create(); advance(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: 0, reusable: true, recovery: money(500), recoveryConfirmed: true });
  const o = state.orders[0]; delete o.customerFundedReturnCourier;
  // Represents a previously persisted return ledger with business-funded courier expense.
  o.ledger.push({ id: "LEGACY-COST", date: today, category: "Courier", amount: money(500), note: "original courier cost" });
  const snapshot = JSON.stringify(state);
  for (const basis of ["settled", "delivery"] as const) assert.equal(buildReport(state, dispatch, today, basis).profit, -money(500));
  assert.equal(JSON.stringify(state), snapshot);
});
test("order progress and financial settlement are independent and date-aware", () => {
  const state = create(); const o = state.orders[0];
  assert.equal(fulfillmentStatus(o, o.placedDate), "Unbooked");
  o.confirmedDate = o.placedDate;
  assert.equal(fulfillmentStatus(o, o.placedDate), "Booked");
  assert.equal(fulfillmentStatus(o, dispatch), "Transit");
  assert.equal(settlementStatus(o, dispatch), "Pending Advance");
  advance(state); assert.equal(settlementStatus(o, dispatch), "Advance Received");
  deliver(state); assert.equal(fulfillmentStatus(o, delivered), "Delivered");
  applyAction(state, "Owner", "verify", { id: o.id, date: delivered });
  assert.equal(settlementStatus(o, delivered), "Under Verification");
  applyAction(state, "Owner", "payout", { id: o.id, date: settled, amount: money(1000) });
  assert.equal(settlementStatus(o, settled), "Under Verification");
  applyAction(state, "Owner", "payout", { id: o.id, date: today, amount: money(1500) });
  assert.equal(settlementStatus(o, today), "Verified / Settled");
  assert.equal(settlementStatus(o, settled), "Under Verification");
  assert.equal(fulfillmentStatus(o, today), "Delivered");
});
test("return reconciliation waits for dated reversals, refunds, recovery and confirmation", () => {
  const state = create(); advance(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: delivered, reversalDate: settled, refundDate: settled, recoveryDate: today, returnCharge: 0, reusable: true, recovery: money(500), recoveryConfirmed: true });
  const o = state.orders[0];
  assert.equal(fulfillmentStatus(o, delivered), "Returned");
  assert.equal(settlementStatus(o, delivered), "Return Pending");
  assert.equal(settlementStatus(o, settled), "Return Pending");
  assert.equal(settlementStatus(o, today), "Return Reconciled");
  o.recoveryConfirmed = false; assert.equal(settlementStatus(o, today), "Return Pending");
});
test("cancelled orders have no settlement requirement", () => {
  const state = create(); const o = state.orders[0]; o.cancelledDate = today;
  assert.equal(fulfillmentStatus(o), "Cancelled"); assert.equal(settlementStatus(o), "Not Applicable");
});
test("held return balance splits between courier, business recovery, and customer", () => {
  const state = create(); const o = state.orders[0]; o.deliveryCharge = money(300); advance(state);
  applyAction(state, "Owner", "return", { id: o.id, date: today, returnCharge: 0, reusable: true, recovery: money(200), recoveryConfirmed: true });
  assert.equal(o.payments.find(p => p.kind === "held-refund")?.amount, money(2500));
  assert.equal(o.payments.find(p => p.kind === "recovery")?.amount, money(200));
  assert.equal(heldBalance(o, today), 0);
  assert.equal(buildReport(state, today, today, "payments").received, money(200));
  for (const basis of ["settled", "delivery"] as const) {
    const report = buildReport(state, today, today, basis);
    assert.equal(report.profit, -money(300)); // Only labour 300 remains; packaging recovered, courier customer-funded.
    assert.equal(report.rows.reduce((s, r) => s + r.amount, 0), report.profit);
  }
});
test("delayed business recovery affects its own day and clears held money on receipt", () => {
  const state = create(); advance(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: delivered, reversalDate: settled, refundDate: settled, recoveryDate: today, returnCharge: 0, reusable: true, recovery: money(500), recoveryConfirmed: true });
  assert.equal(heldBalance(state.orders[0], settled), money(500));
  assert.equal(heldBalance(state.orders[0], today), 0);
  for (const basis of ["settled", "delivery"] as const) {
    assert.equal(buildReport(state, delivered, delivered, basis).profit, -money(500));
    assert.equal(buildReport(state, today, today, basis).profit, money(500));
    assert.equal(buildReport(state, delivered, today, basis).profit, 0);
  }
});
test("business recovery cannot overdraw held money or be recorded without confirmation", () => {
  const state = create(); advance(state);
  assert.throws(() => applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: money(2300), reusable: true, recovery: money(500), recoveryConfirmed: true }), /exceed the held 30%/);
  assert.throws(() => applyAction(state, "Owner", "return", { id: "TEST-1", date: today, returnCharge: 0, reusable: true, recovery: money(200), recoveryConfirmed: false }), /Confirm the actual/);
});
test("Operations cannot write financial transactions and Finance cannot dispatch", () => {
  const state = create();
  assert.throws(() => applyAction(state, "Operations", "advance", { id: "TEST-1", date: dispatch, amount: money(7000) }), /only Owner or Finance/);
  assert.throws(() => applyAction(state, "Finance", "deliver", { id: "TEST-1", date: delivered }), /Owner or Operations/);
});
test("CSV preview detects existing and within-file duplicates without mutating state", () => {
  const state = create(); const before = JSON.stringify(state);
  const csv = `id,customer,city,product_sku,quantity,unit_price,placed_date,courier\nTEST-1,Duplicate,Lahore,TOTE,1,10000,${today},Courier A\nNEW-1,New Customer,Lahore,TOTE,1,10000,${today},Courier A\nNEW-1,Duplicate Again,Lahore,TOTE,1,10000,${today},Courier A\nBAD-1,Bad Customer,Lahore,UNKNOWN,1,10000,${today},Courier A`;
  const rows = previewImport(state, "orders", csv, "Owner");
  assert.equal(rows[0].duplicate, true); assert.equal(rows[1].errors.length, 0); assert.equal(rows[2].duplicate, true); assert.equal(rows[3].errors.length, 1);
  assert.equal(JSON.stringify(state), before);
});
test("settlement CSV detects duplicate payment references", () => {
  const state = create(); advance(state); deliver(state);
  const rows = previewImport(state, "settlements", `payment_id,order_id,type,amount,date\nPAY-1,TEST-1,payout,1000,${settled}\nPAY-1,TEST-1,payout,1000,${settled}`, "Finance");
  assert.equal(rows[0].errors.length, 0); assert.equal(rows[1].duplicate, true);
});
test("corrections are separate dated entries and preserve completed-order history", () => {
  const state = create(); complete(state); const original = JSON.stringify(state.orders[0]);
  applyAction(state, "Owner", "correction", { reference: "TEST-1", date: today, basis: "both", amount: -money(100), reason: "Correct an additional actual cost" });
  assert.equal(JSON.stringify(state.orders[0]), original);
  assert.equal(buildReport(state, settled, settled, "settled").profit, money(5000));
  assert.equal(buildReport(state, today, today, "settled").profit, -money(100));
  assert.equal(buildReport(state, today, today, "delivery").profit, -money(100));
});
test("invalid date ranges are rejected before report generation", () => {
  assert.throws(() => buildReport(fixture(), "2026-02-30", today, "settled"), /valid date range/);
  assert.throws(() => buildReport(fixture(), today, dispatch, "settled"), /valid date range/);
});
test("return, advance reversal, and customer refund use their own actual dates", () => {
  const state = create(); advance(state);
  applyAction(state, "Owner", "return", { id: "TEST-1", date: delivered, reversalDate: settled, refundDate: today, returnCharge: 0, reusable: true, recovery: 0, recoveryConfirmed: true });
  assert.equal(buildReport(state, delivered, delivered, "payments").paid, 0);
  assert.equal(buildReport(state, settled, settled, "payments").paid, money(7000));
  assert.equal(heldBalance(state.orders[0], delivered), money(2500));
  assert.equal(heldBalance(state.orders[0], today), 0);
  assert.equal(buildReport(state, today, today, "payments").rows.filter(r => r.category === "Customer refund (courier)").reduce((s, r) => s + r.amount, 0), -money(9500));
});
test("auto-generated order references do not collide with existing seed references", () => {
  const state = create(); state.orders[0].id = "HB-1048";
  applyAction(state, "Owner", "order-save", { customer: "Another Customer", city: "Lahore", courier: "Courier A", placedDate: today, discount: 0, deliveryCharge: 0, items: [{ productId: "p", quantity: 1, price: money(10000) }] });
  assert.equal(state.orders[1].id, "HB-1049");
});


test("delete order removes linked finances across reports and keeps products and other records", () => {
  const state = create(); complete(state);
  const other = structuredClone(state.orders[0]); other.id = "OTHER"; state.orders.push(other);
  state.adjustments.push({ id: "linked", reference: "TEST-1", date: today, basis: "both", amount: money(100), reason: "test correction" }, { id: "unrelated", reference: "OTHER", date: today, basis: "both", amount: money(50), reason: "other correction" });
  const products = structuredClone(state.products), expenses = structuredClone(state.expenses);
  applyAction(state, "Finance", "order-delete", { id: "TEST-1", confirm: true });
  assert.deepEqual(state.products, products); assert.deepEqual(state.expenses, expenses);
  assert.deepEqual(state.orders.map(o => o.id), ["OTHER"]);
  assert.deepEqual(state.adjustments.map(a => a.id), ["unrelated"]);
  for (const basis of ["settled", "delivery", "payments"] as const) {
    const report = buildReport(state, dispatch, today, basis);
    assert.ok(report.rows.every(row => row.reference !== "TEST-1"));
  }
  assert.equal(state.audit[0].action, "order-delete");
  assert.ok(state.audit.slice(1).every(a => !a.description.includes("TEST-1")));
});

test("order deletion needs financial access and explicit confirmation", () => {
  const state = create(), before = structuredClone(state);
  assert.throws(() => applyAction(state, "Operations", "order-delete", { id: "TEST-1", confirm: true }), /only Owner or Finance/);
  assert.throws(() => applyAction(state, "Owner", "order-delete", { id: "TEST-1", confirm: false }));
  assert.throws(() => applyAction(state, "Owner", "order-delete", { id: "missing", confirm: true }), /Order not found/);
  assert.deepEqual(state, before);
});
