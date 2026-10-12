# Hisab — commerce finance customer demo

A working Next.js frontend and backend for demonstrating orders, courier settlements, returns, expenses, and daily profit to a customer. All initial records are fictional. No Shopify, advertising, courier, or real banking connection is required.

For screen-by-screen instructions, payment examples and the daily routine, read [User Guide](USER_GUIDE.md).

## Run

Requires Node.js 20.9 or later and npm.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:3000. For a production-mode local preview:

```powershell
npm run build
npm run start
```

Next.js App Router supplies both screens and the `/api/demo` backend. Sample data is saved atomically in `.data/demo.json`, which is ignored by Git. It survives refresh and server restart on the same machine. Optional `HISAB_DATA_DIR` selects a separate data folder for isolated testing. This local file store is intended for a single running demo server, not distributed hosting.

## Walk through the sample

1. Open **Customer walkthrough** to explain the payment split and open existing examples.
2. As **Owner**, create an order with product quantities, selling prices, and courier fees.
3. Open the order, **confirm**, **pack**, and record **dispatch**, then separately record the **actual 70% advance receipt**. This is cash received, not profit.
4. Record **actual delivery**. The order enters Delivery Profit, but stays out of Settled Profit.
5. Record the courier's actual final payout. Partial payments stay pending.
6. Verify the saved costs. Once delivery, full advance, final net payout, and cost verification are complete, the order enters Settled Profit on the date the last condition was satisfied.
7. For a return before final settlement, record extra courier charges, reusable material, and any actual expense reimbursement. The advance is reversed; the courier refunds the held remainder to the customer. Return costs are provisional until reimbursement is confirmed.

The top-right role selector previews **Owner**, **Operations**, and **Finance** responsibilities. The backend enforces the selected demo role for mutations, but the selector is not authentication. This is a customer demonstration, not production account security.

## Order and settlement statuses

Orders show Unbooked, Booked, Transit, Delivered, Returned or Cancelled independently of payment. Settlement shows Pending Advance, Advance Received, Under Verification, Verified / Settled, Return Pending, Return Reconciled or Not Applicable. Separate filters can be combined. Packing stays in the timeline; verified costs alone do not complete settlement.

New returns explicitly mark courier charges as customer-funded. Those charges reduce the customer's held refund, not business return profit. Business return loss consists of unrecovered packaging, labour and non-reusable product costs. Delivery Profit reverses previously recognised courier costs on the return date without creating a cash reimbursement. Existing saved returns keep their original totals; corrections remain separate and dated.

## Reports

- **Settled Profit**, the default: full sale less saved order costs (material, packaging, labour, delivery charge, allocated advertising) on completion, less nonrecoverable return costs. Operating costs such as rent and salary are tracked but not deducted from profit.
- **Delivery Profit**: sales and direct costs on actual delivery dates, with pre-settlement return adjustments on return dates.
- **Payments**: actual business cash receipts/outflows on transaction dates. Courier-paid customer refunds are shown separately and excluded from business cash totals to prevent counting the same money twice.

Do not add the two alternative profit views together. Exported CSVs include the selected basis, dates, references, categories, amounts in PKR, and provisional flags. Detail rows reconcile to profit totals; in Payments, exclude rows labelled `Customer refund (courier)` when reconciling business net cash.

Monthly operating expenses are allocated evenly across calendar days for tracking, with any paisa rounding remainder assigned to the month's final day. They do not reduce profit. Payment dates remain separate. Inventory purchases affect cash, not immediate profit on all unsold material. All monetary values are stored as integer paisa.

## Editable data and CSV

Products, new orders, shipment/customer details, and expenses are editable. Dispatched financial amounts and historical item costs are preserved. A dated correction can adjust one or both profit views, or business cash, without rewriting an order. Expense corrections require a reason and preserve previous values in Activity history.

Use **Import CSV** from Orders, Settlements, or Expenses. Download the corresponding template, fill in the records, and preview before importing. Only valid new rows are saved; invalid and duplicate rows are clearly skipped. Imports support up to 200 rows, one product per imported order, and advance/final-payout transactions for settlements. Manually created orders support multiple products. Re-importing the same identifiers does not duplicate financial events. Amounts in import files use plain rupees with up to two decimals.

Owner can reset examples from **Demo settings** after confirmation. Export reports first if you want to retain them.

## Deliberate sample limits

- Real credentials, production login, live integrations, warehouse/production inventory, and shared multi-device deployment are deferred.
- Normal returns after final settlement are outside the client's agreed workflow. A traceable dated correction is available for demonstrating an exceptional adjustment.
- The client confirmed that deductions do not exceed the courier-held 30%; the demo rejects amounts outside that rule. Returns after partial final payout are also blocked pending settlement clarification.
- Courier charges go to the courier; packaging and other confirmed business cost recoveries deducted from the held 30% go to the business. On delivery, both the cost-covering portion and the remaining business balance are part of the final receipt, so neither is counted twice. On return, the customer gets only the held remainder after courier charges and business recovery. Actual recovery has its own receipt date and offsets return costs once. Historical demo returns are preserved rather than silently recalculated. New orders default to Rs 300 delivery charge; additional return fees can be entered separately.
- Full-order returns are supported; partial returns and exchanges require separate rules.
- The example products, courier fees, and customers are illustrative, not confirmed business rates.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

The finance tests cover advances versus profit, delivery/completion timing, partial payouts, delayed cost verification, monthly allocation rounding, material purchases, return reversals and refunds, historical cost snapshots, demo role restrictions, CSV duplicates, dated corrections, and invalid date ranges.

The source business specification is in `../speckit_plus/spec-kit-plus/specs/001-daily-finance/spec.md`. The current user instruction authorizes implementation with Next.js; earlier requirements-only scope described the previous documentation step. The original Requirements.md and Specifications.md remain as provided, and their older payment rules are superseded by the agreed specification and chat decisions.
