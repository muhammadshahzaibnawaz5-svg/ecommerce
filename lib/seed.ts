import type { Order, Product, Store } from "./types";
import { addDays, money, todayPK } from "./finance";
import { applyAction } from "./actions";

export function seedStore(anchor = todayPK()): Store {
  const products: Product[] = [
    { id: "p1", name: "Honey Family Pack", sku: "HNY-001", price: money(10000), material: money(4000), packaging: money(200), labour: money(300), color: "#c5ad85" },
    { id: "p2", name: "Desi Makhan Pack", sku: "MKN-002", price: money(6500), material: money(2200), packaging: money(120), labour: money(250), color: "#819b87" },
    { id: "p3", name: "Honey Jar", sku: "HNY-003", price: money(2500), material: money(800), packaging: money(80), labour: money(150), color: "#a4b6c6" },
    { id: "p4", name: "Desi Ghee Jar", sku: "GHE-004", price: money(3200), material: money(950), packaging: money(100), labour: money(180), color: "#b68d85" },
  ];
  const state: Store = { version: 1, revision: 0, products, orders: [], expenses: [], adjustments: [], audit: [], seedDate: anchor };
  const people = [["Ayesha Khan", "Lahore"], ["Hamza Ali", "Karachi"], ["Fatima Ahmed", "Islamabad"], ["Usman Malik", "Rawalpindi"], ["Zainab Shah", "Faisalabad"], ["Bilal Hassan", "Multan"], ["Sara Iqbal", "Karachi"], ["Ahmed Raza", "Lahore"]];
  for (let n = 0; n < 24; n++) {
    const p = products[n % products.length]; const [customer, city] = people[n % people.length];
    const qty = n % 6 === 0 ? 2 : 1; const age = n < 8 ? n % 3 : 3 + n % 5;
    const placed = n >= 21 ? anchor : addDays(anchor, -age - 4); const dispatch = addDays(anchor, -age - 3); const delivered = n === 16 ? anchor : addDays(anchor, -age - 1);
    const o: Order = { id: `HB-${1048 + n}`, customer, city, courier: ["Courier A", "Courier B", "Courier C", "Courier D"][n % 4], tracking: `DEMO-${84100 + n}`, items: [{ productId: p.id, name: p.name, quantity: qty, price: p.price, material: p.material, packaging: p.packaging, labour: p.labour }], discount: 0, placedDate: placed, deliveryCharge: money(350), returnCharge: 0, reusable: true, recoveryConfirmed: false, payments: [], ledger: [] };
    state.orders.push(o);
    if (n >= 21) continue;
    applyAction(state, "Owner", "confirm", { id: o.id, date: placed });
    applyAction(state, "Owner", "pack", { id: o.id, date: dispatch });
    applyAction(state, "Owner", "dispatch", { id: o.id, date: dispatch });
    applyAction(state, "Owner", "advance", { id: o.id, date: dispatch, amount: Math.round(p.price * qty * .7) });
    if (n === 18 || n === 19) { applyAction(state, "Owner", "return", { id: o.id, date: addDays(anchor, n === 18 ? 0 : -2), returnCharge: money(150), reusable: n === 18, recovery: 0, recoveryConfirmed: false }); continue; }
    if (n === 20) continue;
    applyAction(state, "Owner", "deliver", { id: o.id, date: delivered });
    if (n === 16) continue;
    if (n === 17) { applyAction(state, "Owner", "payout", { id: o.id, date: addDays(anchor, -age), amount: money(500) }); continue; }
    applyAction(state, "Owner", "payout", { id: o.id, date: addDays(anchor, -age), amount: p.price * qty - Math.round(p.price * qty * .7) - money(500) });
    applyAction(state, "Owner", "verify", { id: o.id, date: addDays(anchor, -age) });
  }
  for (let n = 0; n < 14; n++) {
    const d = addDays(anchor, -n);
    applyAction(state, "Owner", "expense-save", { id: `AD-${n}`, category: "Advertising", description: n % 2 ? "TikTok · honey and makhan" : "Meta · honey and desi ghee", amount: money(650 + (n % 4) * 180), date: d, paidDate: d, month: "", platform: n % 2 ? "TikTok" : "Meta", campaign: n % 2 ? "Honey and makhan" : "Honey and desi ghee" });
  }
  applyAction(state, "Owner", "expense-save", { id: "RENT-1", category: "Rent", description: "Studio rent", amount: money(31000), date: `${anchor.slice(0, 7)}-01`, paidDate: `${anchor.slice(0, 7)}-01`, month: anchor.slice(0, 7), platform: "", campaign: "" });
  applyAction(state, "Owner", "expense-save", { id: "SAL-1", category: "Salary", description: "Operations team salary", amount: money(46500), date: `${anchor.slice(0, 7)}-01`, paidDate: "", month: anchor.slice(0, 7), platform: "", campaign: "" });
  // These are illustrative records, never real customers or courier integrations.
  state.revision = 1;
  return state;
}
