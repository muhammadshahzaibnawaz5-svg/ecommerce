# Hisab - How to Use the Finance Demo

This guide explains the honey, makhan and desi ghee sample in simple English. The starting products, prices, customers and charges are examples. You can edit them to demonstrate your business workflow.

## 1. Open the software

From the Ecommerce_finance folder, run:

```powershell
npm run dev
```

Open the Local URL printed in the terminal, normally http://127.0.0.1:3000. If that port is occupied, use the alternative URL printed by Next.js.

Your changes are saved locally and survive page refresh and server restart. Keep the terminal running while using the demo.

## 2. What each screen does

| Screen | What you can do |
| --- | --- |
| Overview | Check profit, sales or cash receipts, costs, courier-held money, charts and recent order activity. |
| Orders | Create orders, search records, open details and record the order's actual progress. |
| Settlements | Review courier balances and record actual advance or final payout receipts. |
| Expenses | Record advertising and operating expenses, actual payment dates and monthly allocations. |
| Products | Edit product prices, product costs, packaging and labour. |
| Reports | See the detailed records behind the selected total and export them. |
| Customer walkthrough | Explain the order and payment workflow using examples. |
| Demo settings | Review activity history and reset the fictional examples when needed. |

On a laptop, use the sidebar. On a phone, tap **Menu**. Order and expense records appear as labelled cards on small screens. Tap an order to open its details.

## 3. Choose the date and report

Use **Today**, **Yesterday**, **Last 7 days**, **This week**, **This month**, **All sample dates**, or **Custom range**. The **From** and **To** dates are included in the selected period. Reporting uses **Pakistan time (Asia/Karachi)** and **PKR**.

There are three separate views:

| Report | Date used | Meaning |
| --- | --- | --- |
| Settled Profit | Final completion date | Profit from delivered orders with complete receipts and verified costs, less return losses. Operating costs (rent, salary, utilities) are tracked separately and do not reduce this profit. This is the default. |
| Delivery Profit | Actual delivery date | Sales and direct costs when delivered, with return adjustments on their recorded dates. Payment may still be pending. |
| Payments | Actual transaction date | Business cash received and paid. This is not profit. |

**Never add Settled Profit and Delivery Profit together.** They are alternative ways to view the same business activity.

If today's orders are empty, choose **All sample dates** to explore the existing examples. The order list uses activity dates, so an order may appear because it was placed, delivered, paid or returned during the selected period.

## 4. Set up your products

Open **Products**, then choose **Add product** or **Edit product costs**.

Enter the name, unique SKU, selling price, material/product cost, packaging cost and labour cost per unit. For example:

| Honey order, quantity 1 | Example amount |
| --- | ---: |
| Selling price | Rs 10,000 |
| Honey/product cost | Rs 4,000 |
| Packaging | Rs 200 |
| Labour | Rs 300 |

Costs are copied into each new order. Updating a product later does not change the costs saved in existing orders. For multiple units, per-unit costs are multiplied by quantity.

## 5. Create and process an order

1. Select **New order** from Overview or Orders.
2. Enter customer, city, courier, order date and optional tracking reference.
3. Select products, quantities and selling prices. You can add multiple products.
4. Enter any discount and delivery charge. New orders suggest Rs 300 delivery charge; check the actual charge.
5. Save the order. Saving alone does not record a payment or profit.
6. Open the order and record **Confirm order**, **Record packing**, then **Record dispatch** with actual dates.
7. Record the actual **70% advance receipt** when the business receives it.
8. Record **Mark delivered** when the customer actually receives the order.
9. Record the courier's actual final payout. Partial receipts remain pending.
10. Verify the final costs after checking the breakdown.

Orders have two independent status columns. Use **Filter order status** and **Filter settlement status** separately; both filters apply together.

| Order status | Meaning |
| --- | --- |
| Unbooked | Order created but not confirmed. |
| Booked | Confirmed; packing remains recorded in the timeline. |
| Transit | Dispatched and travelling to the customer. |
| Delivered | Actual delivery recorded, even if payment is pending. |
| Returned | Returned before final settlement. |
| Cancelled | Cancelled before dispatch. |

| Settlement status | Meaning |
| --- | --- |
| Pending Advance | Full 70% has not yet been received. |
| Advance Received | Full 70% received; actual delivery still pending. |
| Under Verification | Delivered, but full payment or verified costs are missing. |
| Verified / Settled | Delivery, complete receipts and verified costs are all complete. |
| Return Pending | Return recorded, but refund/reversal/recovery conditions are not complete or confirmed. |
| Return Reconciled | Recorded refunds, reversal and recovery are complete and the held balance is cleared. |
| Not Applicable | Cancelled order. |

List statuses reflect the selected period's end date. The detail drawer shows the latest recorded status. Verification alone never creates settled profit.

Dispatched financial values are locked to preserve history. Customer and shipment details remain editable. Use a dated correction for an exceptional financial adjustment.

## 6. Understand the 70% / 30% split

For the example Rs 10,000 order:

| Payment component | Amount | Recipient |
| --- | ---: | --- |
| 70% advance | Rs 7,000 | Business |
| 30% held | Rs 3,000 | Held by courier until settlement or return |
| Courier charges | Rs 300 | Courier |
| Packaging and labour portion | Rs 500 | Business, covering its recorded costs |
| Remaining business balance on delivery | Rs 2,200 | Business |
| Total final receipt on delivery | Rs 2,700 | Business: Rs 500 + Rs 2,200 |

**On delivery, enter Rs 2,700 as the total final receipt**, if that is the actual amount received. The packaging/labour portion is included in that receipt. Do not add Rs 500 again as another receipt or extra income.

The client's rule is that applicable deductions fit within the held 30%. The software rejects deductions above that balance.

## 7. Calculate one day's Settled Profit

An order contributes settled sales profit only after all four conditions are met:

1. Actual delivery recorded.
2. Full 70% advance actually received.
3. Complete final courier payout actually received.
4. Final costs verified.

The completion date is the date the last condition is satisfied. A partial payout does not complete settlement.

For the example order:

```text
Full sale                           Rs 10,000
Minus material                      Rs  4,000
Minus packaging                     Rs    200
Minus labour                        Rs    300
Minus delivery charge               Rs    300
Order profit (before advertising)   Rs  5,200
```

Advertising is a daily cost allocated to each order. That day's ad spend is divided by the number of orders recognised that day (completion date for Settled Profit, delivery date for Delivery Profit) and added to every order's cost. For example, Rs 500 of ads on a day with 5 recognised orders adds Rs 100 to each order.

Then calculate the day's result. Settled Profit is simply the day's sales minus its exact order costs (material, packaging, labour, delivery charge and allocated advertising):

```text
Order profits for the day (each already includes its allocated advertising)
- return costs recorded that day
+ actual return expense recoveries received that day
= Daily Settled Profit
```

Example: Rs 5,200 order profit - Rs 200 allocated ads = **Rs 5,000 daily profit**, assuming no returns that day.

If dispatch is Monday, delivery is Thursday, and final payment plus cost verification finish Friday, the order's Rs 5,200 settled margin appears **Friday**. Before Friday, its settled-order margin is zero.

The final courier receipt is cash, not profit. The advance alone is also not profit.

## 8. Record a return

Open an eligible order and select **Record return**. Enter the actual return, advance reversal, customer refund and business recovery dates.

Enter any additional return courier charge. The delivery charge already saved in the order is included; do not enter it again as an additional return charge.

Enter the actual packaging and other business expense recovery received from the held 30%, and confirm the amount and receipt date. The form suggests the saved packaging plus labour costs, but you must verify the actual amount. This recovery goes to the **business**. The remaining held money goes to the **customer**.

Example with the same Rs 10,000 order:

| Return component | Amount |
| --- | ---: |
| Advance reversed by business | Rs 7,000 |
| Originally held by courier | Rs 3,000 |
| Courier charges | Rs 300 |
| Packaging + labour recovered by business | Rs 500 |
| Held remainder refunded to customer | Rs 2,200 |
| Total customer refund, including reversed advance | Rs 9,200 |

If only Rs 200 packaging is recovered, enter **Rs 200** instead. The held customer refund becomes **Rs 2,500**, and unrecovered labour remains a return cost.

Mark returned material reusable only when the inspected goods can actually be reused. For non-reusable honey, makhan or ghee, untick that option; the product cost stays in the return loss.

**For new returns, customer-funded courier charges are excluded from business return loss.** With reusable goods and full Rs 500 packaging/labour recovery, the business return loss is **zero**. If only Rs 200 is recovered, the unrecovered labour creates **Rs 300 loss**. Non-reusable goods add their product cost.

Existing saved returns retain their original accounting treatment. They are labelled historical in the details; use a dated correction if an adjustment is required. New/reset sample returns follow the corrected rule.

The returned order never contributes a completed-sale margin. Costs remain visible, and actual recovery offsets them once. A recovery received later appears on its own date. An earlier Delivery Profit entry is reversed through dated return entries rather than silently erased.

In Payments, courier customer-refund rows are informational. They are excluded from business cash paid because the business advance reversal is already counted; the courier's refund must not be counted as another business payment.

Normal returns after final payout and returns after partial final payout are outside this demo workflow. A dated correction can demonstrate an exceptional report adjustment, but does not execute a customer refund.

## 9. Record expenses without counting them twice

Open **Expenses** and add the amount, category and expense date. Enter an actual payment date only if paid.

- Advertising is allocated across the orders recognised that day, so each order carries its share in its order cost. You can record the platform and campaign.
- Salary, rent, utilities and other operating costs can be spread across a covered month. They are tracked for reference but **do not reduce Settled Profit**, which stays at sales minus order costs.
- Monthly amounts are allocated across calendar days for tracking. For example, Rs 31,000 rent in a 31-day month shows as Rs 1,000 per day. Any paisa rounding remainder is allocated to the last day.
- Inventory purchases affect cash when paid. Product costs affect profit through order costs; unsold stock purchases are not expensed again.
- Product cost, packaging, labour and delivery charge saved in an order are already direct profit costs. Do not duplicate them as shared expenses.

The **Where your money goes** panel and the Overview **Order costs** card show material, packaging, labour, courier and advertising separately. Operating costs (salary, rent, utilities) are tracked on the Expenses page but are not subtracted from profit.

Direct order cost fields do not automatically create business cash-payment entries. Payments shows the actual receipts, reversals, expense payments and cash corrections that you record.

Editing an expense requires a correction reason. Previous values stay in activity history.

## 10. Reports, CSV and corrections

In **Reports**, select the report basis and date range, then review the detailed entries. Positive amounts add to the result; negative amounts subtract.

Select **Export report** to download a CSV for the chosen report and dates. Profit detail rows reconcile to their total. For Payments, exclude **Customer refund (courier)** rows when reconciling business net cash.

To import from Orders, Settlements or Expenses:

1. Choose **Import CSV** and the import type.
2. Download its template and fill it with your sample records.
3. Upload or paste the CSV.
4. Select **Preview & validate**.
5. Review valid, invalid and duplicate rows before importing.

Imports support up to 200 rows. Only valid new rows are saved. Repeated IDs/payment references are skipped. Amounts use plain rupees with up to two decimal places. Order CSV rows contain one product; manually created orders can contain multiple products.

For an exceptional adjustment, open an order and select **Record a dated financial correction**. Choose the affected report, date, signed amount and reason. A positive amount increases the selected report; a negative amount decreases it. A Payments correction changes cash reporting only. A correction does not change the original order status or manufacture a refund transaction.

## 11. Roles, history and saved changes

| Demo role | Responsibilities |
| --- | --- |
| Owner | All modules, reset and corrections. |
| Operations | Orders, confirmation, packing, dispatch and delivery. |
| Finance | Product costs, expenses, receipts, verification, returns and corrections. |

The role selector demonstrates responsibilities; it is not a production login system.

**Demo settings** shows activity history, including previous records for changes. **Reset example data** replaces saved demo edits after confirmation. Export reports before resetting if you want to retain them.

The local store is `.data/demo.json`. This is a customer demonstration using manual data, not live courier/bank integrations or a full warehouse inventory system.

## 12. A daily routine

1. Record new orders and shipment/delivery activity.
2. Record actual advance receipts, courier payouts and returns.
3. Check costs and complete eligible settlements.
4. Enter advertising and other expenses with the correct dates.
5. Select **Today** and **Settled Profit** for the day's settled result.
6. Check **Payments** separately for actual cash movement.
7. Review pending settlements and export the required report.

For a customer presentation, open **Customer walkthrough**, show an advance-only order, then explain why delivery and full settlement are separate steps.

## Delete an order

Open an order and choose **Delete order** as Owner or Finance. Review the linked-record counts, then confirm **Delete order and linked records**. This permanently removes the order, its payments, refunds, recovery records, cost ledger, return details and corrections referencing that order. Related activity entries are removed; a short deletion receipt remains in Activity history. Products, other orders and shared expenses are kept. All report views and CSV exports reflect the deletion, including historical dates. Deletion cannot be undone; export reports first if needed. Use Cancel order for a real cancellation you want to retain in history.
