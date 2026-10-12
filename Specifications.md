# Software Specifications

## E-Commerce Operations, Inventory & Profit Management System
**Shopify-Integrated Software**

| | |
|---|---|
| **Document type** | Software Specification (SS) |
| **Based on** | `Requirements.md` (client requirements) and the developer's handwritten design notes |
| **Status** | Draft for client review |
| **Database** | PostgreSQL |
| **Integrations** | Shopify (GraphQL API + Webhooks), Meta APIs, Courier APIs |

---

## 1. Introduction

### 1.1 Purpose
This document turns the high-level requirements into concrete software specifications: what the system does, how it connects to external platforms, how financial figures are calculated, and what data it stores.

### 1.2 Objective
Provide one central system that answers a single question:

> **How much was spent, how much was earned, and what is the actual profit or loss?**

Shopify remains the online selling store. This system manages the operations and finances behind it.

### 1.3 Business Context
- The business **manufactures its own products** from raw materials supplied by suppliers.
- Orders are placed through **Shopify** and delivered by **four courier companies**.
- Products are promoted through **Meta** and **TikTok** advertising.

### 1.4 Scope

| In scope | Out of scope |
|---|---|
| Shopify integration (products, customers, orders, payments, refunds, inventory) | Replacing the Shopify storefront or checkout |
| Order, delivery, return and payment tracking | Resale / purchased products (unless confirmed by the client) |
| Courier cost and settlement tracking | |
| Raw material, packaging and finished-goods inventory | |
| Advertising and expense tracking | |
| Profit & loss calculation, dashboard and reports | |

---

## 2. System Overview

### 2.1 Business Flow
```
Suppliers → Raw Materials → Production → Finished Inventory
                                              │
                                              ▼
Meta / TikTok Ads → Shopify Store → Orders → Couriers → Customers
                                              │
                                              ▼
                       Software: Profit/Loss · Orders · Returns · Payments
```

### 2.2 Data Sources
The system receives data from two kinds of sources.

| Source type | Source | Data received |
|---|---|---|
| **Automatic (API)** | Shopify APIs | Products, customers, orders, payments, refunds, inventory, order status |
| **Automatic (API)** | Meta APIs | Ad campaigns, ad sets, ads, ad spend |
| **Automatic (API)** | Courier APIs | Shipments, tracking, charges, settlements |
| **Manual (user entry)** | Owner / staff | Supplier costs, packaging costs, other expenses (e.g. salaries) |
| **Manual (fallback)** | Owner | Courier costs and advertising costs, when not available through an API |

### 2.3 High-Level Architecture
```
            ┌─────────────────────── Software ───────────────────────┐
            │                                                        │
   Shopify APIs + Meta APIs                                   Courier APIs
            │                                                        │
 Products · Customers · Orders · Payments                 Shipments · Tracking
 Refunds · Ad campaigns · Ad sets · Ads · Ad spend        Charges · Settlements
            │                                                        │
            └──────────────────────────┬─────────────────────────────┘
                                       ▼
                                  PostgreSQL
                                       ▼
                 Profit/Loss · Orders · Returns · Payments (UI)
```

---

## 3. Functional Specifications

### 3.1 Authentication & Access Control

#### 3.1.1 Authentication
| ID | Specification |
|---|---|
| AUTH-01 | Users can **sign up** and **sign in** using **email + password**. |
| AUTH-02 | **Forgot password** flow: user requests reset → system sends an **OTP** → user verifies OTP → user **resets password** → returns to sign-in. |
| AUTH-03 | Passwords must be stored hashed; OTPs must be time-limited and single-use. |

```
Sign in → Email + Password ──(forgot?)──► Send OTP ──► Reset Password ──┐
   ▲                                                                    │
   └────────────────────────────────────────────────────────────────────┘
```

#### 3.1.2 Roles & Permissions
The **Admin** can assign roles to users.

| Role | Intended responsibility |
|---|---|
| Owner / Admin | Full access; assigns roles; manages store connection |
| Manager | Operational oversight across modules |
| Inventory | Raw materials, packaging, production, finished stock |
| Order Processing | Order lifecycle, packing, shipping, returns handling |
| Finance | Payments, expenses, settlements, profit & loss |

> The final role list is **not yet confirmed** with the client (see §9). Permissions per role will be defined once confirmed.

---

### 3.2 Store Connection (UI)
The settings screen allows the owner to connect their Shopify store.

| Field / action | Description |
|---|---|
| Main store name | Display name of the store |
| Shopify store URL | The store's Shopify domain |
| **Connect Store** button | Starts the Shopify connection and the initial sync |

---

### 3.3 Shopify Integration

#### 3.3.1 Integration Method
- **Shopify GraphQL API** for reading and syncing data.
- **Shopify Webhooks** for real-time event updates.

#### 3.3.2 Integration Flow
```
Shopify integration
   ↓
GraphQL API + Webhooks
   ↓
Initial sync + event handling
   ↓
Store identification
   ↓
PostgreSQL
```

| Step | Specification |
|---|---|
| 1. Connect | Owner enters store name and URL and clicks **Connect Store**. |
| 2. Initial sync | System imports existing products, customers, orders, payments, refunds and inventory through the GraphQL API. |
| 3. Event sync | Webhooks keep the system current (new order, order update, cancellation, refund, product/inventory change). |
| 4. Store identification | Every record is tagged with the connected store so data is attributed to the correct store. |
| 5. Persist | Data is saved to PostgreSQL. |

#### 3.3.3 Data Synced from Shopify

| Entity | Notes |
|---|---|
| Products | Catalogue and product details |
| Customers | Customer records |
| Orders | Including order status |
| Payments | Prepaid and Cash on Delivery |
| Refunds | Linked to the original order |
| Inventory | Stock levels |

#### 3.3.4 Reliability Requirements
- Webhook handling must be **idempotent** (a repeated event must not create duplicate records).
- Failed syncs must be logged and retried.
- Shopify remains the source of truth for storefront data.

---

### 3.4 Advertising Integration & Management
- **Meta APIs** supply ad campaigns, ad sets, ads and ad spend.
- **TikTok** ad spend is recorded in the system (see open item in §9 on API vs manual entry).
- Ad spend is recorded **by campaign and date** and treated as a **selling expense**.
- The owner can also **enter advertising costs manually**.

---

### 3.5 Courier Integration & Management
- **Courier APIs** supply shipments, tracking, charges and settlements for all four couriers.
- The system records courier details, tracking and delivery status per order.
- Courier charges (shipping and return) are tracked as **business expenses (selling costs)**.
- The owner can also **enter courier costs manually**.
- Each courier must be mapped to its own adapter so a new courier can be added without changing core logic.

---

### 3.6 Order & Delivery Management

| ID | Specification |
|---|---|
| ORD-01 | Order lifecycle: **New → Confirmed → Packed → Shipped → Delivered**. |
| ORD-02 | Additional outcomes: **Cancelled, Returned, Failed Delivery, Refunded**. |
| ORD-03 | Order status is tracked from placement through delivery, cancellation or return. |
| ORD-04 | Each order shows its items, customer, payment, courier, tracking and cost breakdown. |

---

### 3.7 Payments

| ID | Specification |
|---|---|
| PAY-01 | Record **prepaid** and **Cash on Delivery** payments separately. |
| PAY-02 | Each delivered order is settled in two parts: **25% on delivery** and the **remaining 75% the next day**. |
| PAY-03 | Show **received**, **pending** and **settled** amounts. |

---

### 3.8 Returns

| ID | Specification |
|---|---|
| RET-01 | Track returned and failed-delivery orders. |
| RET-02 | For a returned order, **deduct the courier cost from the 25% advance** and **return the remaining amount** to the customer. |
| RET-03 | Returned items go back into stock **only if inspected and sellable**. |
| RET-04 | Refunds are reflected in net revenue (see §4). |

---

### 3.9 Inventory Management

| ID | Specification |
|---|---|
| INV-01 | Add raw materials purchased from suppliers to inventory. |
| INV-02 | Show **used** and **remaining** raw-material quantities. |
| INV-03 | Track **packaging materials** and **finished-product stock**. |
| INV-04 | Record **production** (raw materials consumed → finished goods produced) and update stock accordingly. |
| INV-05 | Show **low-stock alerts**. |
| INV-06 | Finished-goods stock is reflected back to Shopify inventory where applicable. |

---

### 3.10 Supplier Management
- Maintain supplier records and **purchase history**.
- Record supplier purchases as costs (treatment in the P&L is defined in §4.2).

---

### 3.11 Manual Data Entry
Costs not available through APIs are entered manually.

| Entry | Category |
|---|---|
| Supplier costs | Inventory purchase |
| Packaging costs | Inventory purchase |
| Other expenses (e.g. **salaries**) | Operating expense |
| Courier costs *(owner, if needed)* | Selling cost |
| Advertising costs *(owner, if needed)* | Selling cost |

Each expense is stored with **category, amount, date** and an optional note.

---

### 3.12 Dashboard & Reports
The system must show, at minimum:

1. **Profit / Loss** (overall and per product)
2. **Orders**
3. **Returns**
4. **Payments**

Additional requirements:
- Dashboard covers orders, deliveries, returns, payments, expenses and profit or loss.
- Reports support **date filters** and **export** (formats to be confirmed).

---

## 4. Profit & Loss Specification

### 4.1 Calculation Flow
```
Sales
  ↓
Revenue Recognition
  ├── Cost of Goods Sold (COGS)
  │      ├── Manufacturing costs
  │      └── (Packaging costs)
  │
  └── Others
         ├── Courier costs
         └── Advertising costs
                  ↓
        Other expenses (salary etc.)
                  ↓
              Profit / Loss
```

### 4.2 Definitions

| Term | Definition |
|---|---|
| **Net Revenue** | Recognized sales revenue minus refunds/returns. |
| **COGS** | Only the cost of items **consumed from inventory** to produce what was sold (raw materials, manufacturing, packaging). |
| **Selling costs** | Courier charges and advertising spend. |
| **Operating expenses** | Other business costs such as salaries. |

> **Key rule:** *All COGS is expense, but not all expense is COGS.* An expense is COGS only if it is drawn from inventory.

### 4.3 Formulas

```
Gross Profit     = Net Revenue − COGS
Operating Profit = Gross Profit − Selling Costs − Operating Expenses
Order Profit     = Revenue − Manufacturing − Packaging − Courier − Advertising
Net Profit       = Order Profit − Other Expenses
```

This is equivalent to the client's rule: **Net Profit = Revenue − Total Expense**, where Total Expense = raw materials & packaging + advertising + courier charges + other operational costs.

### 4.4 Worked Example (from design notes)
Two orders:

| Item | Calculation | Amount |
|---|---|---|
| Revenue | 2 × 5,000 | 10,000 |
| Manufacturing | 2 × 2,200 | 4,400 |
| Packaging | 2 × 100 | 200 |
| Courier | | 300 |
| Advertising | | 400 |
| **Order Profit** | 10,000 − 4,400 − 200 − 300 − 400 | **4,700** |
| **Net Profit** | Order Profit − other expenses (e.g. salaries) | *depends on other expenses* |

> ⚠️ **Note:** The handwritten example writes `2 × 2,200 = 4,000` and an order profit of `5,100`. Since 2 × 2,200 = 4,400, the order profit works out to 4,700. If the intended unit manufacturing cost is 2,000 (total 4,000), the order profit is 5,100. Please confirm the intended figure.

### 4.5 Rules
- Profit/loss is available **overall and per product**.
- COGS is calculated from inventory consumption (production records), not from purchase dates.
- Courier and advertising costs are reported as selling costs, separate from COGS.
- Returned/refunded orders reduce net revenue; courier cost on returns remains a cost.

---

## 5. Business Rules Summary

| # | Rule |
|---|---|
| BR-01 | Net Profit = Revenue − Total Expense (expanded in §4.3). |
| BR-02 | Total expense = raw materials & packaging + advertising + courier charges + other operational costs. |
| BR-03 | Payment is split **25% on delivery / 75% next day**. |
| BR-04 | On return: courier cost is deducted from the 25% advance; the remainder is returned to the customer. |
| BR-05 | Returned items re-enter stock only if inspected and sellable. |
| BR-06 | Only expenses drawn from inventory are COGS. |
| BR-07 | Every synced record is linked to a store identifier. |

---

## 6. Data Model (Logical)

Core tables stored in **PostgreSQL**:

| Group | Entities |
|---|---|
| **Access** | users, roles, user_roles, otp_tokens |
| **Store** | stores (name, Shopify URL, connection status) |
| **Shopify data** | products, customers, orders, order_items, order_status_history, payments, refunds, inventory |
| **Operations** | couriers, shipments, tracking_events, courier_charges, courier_settlements |
| **Inventory & production** | raw_materials, packaging_materials, finished_goods, production_runs, stock_movements |
| **Suppliers** | suppliers, purchases |
| **Marketing** | ad_campaigns, ad_sets, ads, ad_spend |
| **Finance** | expenses (category, amount, date), profit/loss views |

Design notes:
- All Shopify-synced tables carry a `store_id` (store identification).
- Order status changes are stored as history for auditing.
- Profit/loss figures are derived from these tables (views or reports), not stored as hand-entered values.

---

## 7. Non-Functional Specifications

| Area | Specification |
|---|---|
| **Usability** | Simple interface suitable for non-technical staff. |
| **Security** | Secure login, hashed passwords, OTP-based reset, role-based access, secured API credentials/tokens. |
| **Reliability** | Accurate, consistent data synchronized with Shopify; retry and logging for failed syncs. |
| **Performance** | Fast dashboard and report loading, including with date filters. |
| **Auditability** | Order status changes and manual expense entries are traceable to a user and time. |

---

## 8. Assumptions

- All current products are manufactured by the business.
- Shopify remains the storefront and checkout.
- Manual entry is available for any cost without an API feed.
- Revenue is recognized when an order is **delivered** (to be confirmed).

---

## 9. Open Items for Client Confirmation

| # | Item |
|---|---|
| 1 | **Roles:** final role list and permissions (Manager, Inventory, Order Processing, Finance — *not yet confirmed*). |
| 2 | **Couriers:** names of the four couriers and whether each provides an API. |
| 3 | **TikTok Ads:** the notes mention Meta APIs only; confirm whether TikTok is API-integrated or manual. |
| 4 | **Supplier purchases:** treated as inventory and recognized as COGS when consumed (per notes) versus a direct expense (per requirements) — confirm. |
| 5 | **Packaging:** confirm it is counted within COGS (used from inventory). |
| 6 | **Revenue recognition:** confirm timing (on delivery vs on payment settlement). |
| 7 | **Expense categories** and **reports/export formats** required. |
| 8 | **Warehouses:** single or multiple. |
| 9 | **Resale products:** confirm none are sold. |
| 10 | **Worked example:** confirm manufacturing figure (see §4.4). |

---

## 10. Approval

| | Name | Signature | Date |
|---|---|---|---|
| **Client** | | | |
| **Developer** | | | |
