export type Role = "Owner" | "Operations" | "Finance";
export type Basis = "settled" | "delivery" | "payments";
// All monetary values are integer paisa; calculations never use fractional rupees.
export type Costs = { material: number; packaging: number; labour: number };
export type Product = Costs & { id: string; name: string; sku: string; price: number; color: string };
export type Item = Costs & { productId: string; name: string; quantity: number; price: number };
export type Payment = { id: string; kind: "advance" | "payout" | "reversal" | "customer-refund" | "held-refund" | "recovery"; amount: number; date: string; note: string; fromHeld?: boolean };
export type LedgerEntry = { id: string; date: string; category: "Revenue" | "Material" | "Packaging" | "Labour" | "Courier" | "Recovery"; amount: number; note: string };
export type Order = {
  id: string; customer: string; city: string; courier: string; tracking: string;
  items: Item[]; discount: number; placedDate: string; confirmedDate?: string; packedDate?: string; dispatchDate?: string;
  deliveryDate?: string; returnDate?: string; verifiedDate?: string; cancelledDate?: string;
  deliveryCharge: number; returnCharge: number;
  customerFundedReturnCourier?: boolean;
  reusable: boolean; recoveryConfirmed: boolean; payments: Payment[]; ledger: LedgerEntry[];
};
export type Expense = { id: string; category: string; description: string; amount: number; date: string; paidDate: string; month: string; platform: string; campaign: string };
export type Audit = { id: string; time: string; role: Role; action: string; description: string; before?: unknown };
export type Adjustment = { id: string; reference: string; date: string; basis: Basis | "both"; amount: number; reason: string };
export type Store = { version: number; revision: number; products: Product[]; orders: Order[]; expenses: Expense[]; adjustments: Adjustment[]; audit: Audit[]; seedDate: string };
export type ReportRow = { id: string; date: string; reference: string; description: string; category: string; amount: number; provisional?: boolean };
export type Report = { basis: Basis; from: string; to: string; revenue: number; directCosts: number; orderCosts: number; sharedCosts: number; returnLoss: number; profit: number; received: number; paid: number; held: number; heldOpening: number; pending: number; completed: number; placed: number; delivered: number; returned: number; rows: ReportRow[]; costs: { name: string; amount: number }[]; series: { date: string; revenue: number; costs: number; profit: number }[]; provisional: boolean };
export type ImportKind = "orders" | "expenses" | "settlements";
export type ImportRow = { line: number; values: Record<string, string>; errors: string[]; duplicate: boolean };
