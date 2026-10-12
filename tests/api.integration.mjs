import assert from 'node:assert/strict';

const base = process.env.DEMO_BASE_URL || 'http://127.0.0.1:3010';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const offset = n => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
async function read(from = today, to = today, basis = 'settled') { const r = await fetch(`${base}/api/demo?from=${from}&to=${to}&basis=${basis}`); assert.equal(r.status, 200); return r.json(); }
async function post(action, data, role = 'Owner', expected = 200, revision) {
  const current = await read(); const r = await fetch(`${base}/api/demo`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-role': role }, body: JSON.stringify({ action, data, revision: revision ?? current.state.revision }) });
  const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body;
}
const start = await read();
const sameOrigin = await fetch(`${base}/api/demo`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ action: 'import-preview', data: { kind: 'expenses', csv: `id,category,description,amount,date\nORIGIN-PREVIEW,Advertising,Origin check,1,${today}` } }) });
assert.equal(sameOrigin.status, 200, 'A browser request from the actual page origin must be accepted');
const wrongOrigin = await fetch(`${base}/api/demo`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://unrelated.example' }, body: JSON.stringify({ action: 'reset', revision: start.state.revision, data: { confirm: true } }) });
assert.equal(wrongOrigin.status, 403, 'Unrelated origins must be rejected');
const p = start.state.products.find(p => p.id === 'p1');
await post('order-save', { id: 'QA-ORDER', customer: 'QA customer', city: 'Lahore', courier: 'Courier A', placedDate: offset(-6), discount: 0, deliveryCharge: 50000, items: [{ productId: p.id, quantity: 1, price: 1000000 }] });
await post('confirm', { id: 'QA-ORDER', date: offset(-5) });
await post('pack', { id: 'QA-ORDER', date: offset(-5) });
await post('dispatch', { id: 'QA-ORDER', date: offset(-5) });
await post('advance', { id: 'QA-ORDER', date: offset(-5), amount: 700000 }, 'Operations', 403);
await post('advance', { id: 'QA-ORDER', date: offset(-5), amount: 700000 });
await post('deliver', { id: 'QA-ORDER', date: offset(-2) });
await post('payout', { id: 'QA-ORDER', date: offset(-1), amount: 100000 });
let current = await read();
assert.equal(current.report.revenue, start.report.revenue, 'Partial payout must not create settled revenue');
await post('payout', { id: 'QA-ORDER', date: offset(-1), amount: 150000 });
await post('verify', { id: 'QA-ORDER', date: today });
current = await read();
assert.equal(current.report.revenue - start.report.revenue, 1000000);
assert.equal(current.report.profit - start.report.profit, 500000);
assert.equal(current.report.rows.filter(r => r.reference === 'QA-ORDER').reduce((sum, r) => sum + r.amount, 0), 500000);
await post('return', { id: 'QA-ORDER', date: today, returnCharge: 0, reusable: true, recovery: 0, recoveryConfirmed: true }, 'Owner', 400);
await post('product-save', { ...p, name: 'Stale edit' }, 'Owner', 409, start.state.revision);
const csv = `id,category,description,amount,date,paid_date\nQA-AD,Advertising,QA ad spend,12.50,${today},${today}\nQA-AD,Advertising,Duplicate,12.50,${today},${today}\nQA-BAD,Advertising,Invalid spend,not-a-number,${today},${today}`;
const preview = await post('import-preview', { kind: 'expenses', csv });
assert.equal(preview.rows.length, 3); assert.equal(preview.rows[1].duplicate, true); assert.equal(preview.rows[2].errors.length, 1);
const imported = await post('import', { kind: 'expenses', csv }); assert.equal(imported.imported, 1); assert.equal(imported.skipped, 2);
await post('import', { kind: 'expenses', csv }, 'Owner', 400);
const exportResponse = await fetch(`${base}/api/demo?from=${today}&to=${today}&basis=settled&export=csv`);
assert.equal(exportResponse.status, 200); assert.ok((await exportResponse.text()).includes('QA-ORDER'));
const badRange = await fetch(`${base}/api/demo?from=2026-02-30&to=${today}`); assert.equal(badRange.status, 400);
const persisted = await read(); assert.ok(persisted.state.orders.some(o => o.id === 'QA-ORDER'));
const html = await fetch(base); assert.equal(html.status, 200); assert.ok((await html.text()).includes('Business overview'));
console.log('PASS: API lifecycle, roles, completion timing, partial receipts, stale revisions, CSV preview/import/duplicates, export, invalid dates, persistence, and rendered page.');

for (const wasDelivered of [false, true]) {
  const ref = wasDelivered ? 'QA-RETURN-DELIVERED' : 'QA-RETURN-TRANSIT';
  await post('order-save', { id: ref, customer: 'QA return example', city: 'Lahore', courier: 'Courier A', placedDate: offset(-6), discount: 0, deliveryCharge: 30000, items: [{ productId: p.id, quantity: 1, price: 1000000 }] });
  await post('confirm', { id: ref, date: offset(-5) });
  await post('pack', { id: ref, date: offset(-5) });
  await post('dispatch', { id: ref, date: offset(-5) });
  await post('advance', { id: ref, date: offset(-5), amount: 700000 });
  if (wasDelivered) await post('deliver', { id: ref, date: offset(-2) });
  await post('return', { id: ref, date: today, returnCharge: 0, reusable: true, recovery: 50000, recoveryConfirmed: true });
  const returned = (await read()).state.orders.find(o => o.id === ref);
  assert.equal(returned.customerFundedReturnCourier, true);
  assert.equal(returned.payments.find(p => p.kind === 'held-refund').amount, 220000);
  assert.equal(returned.payments.filter(p => p.kind === 'recovery').reduce((s,p) => s+p.amount, 0), 50000);
  for (const basis of ['settled', 'delivery']) {
    const result = await read(offset(-6), today, basis);
    assert.equal(result.report.rows.filter(r => r.reference === ref).reduce((s,r) => s+r.amount, 0), 0);
  }
}
console.log('PASS: customer-funded returns before/after delivery, refund splits and no double-counted profit/cash recovery.');
