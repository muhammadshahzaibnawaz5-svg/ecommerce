# Requirements Document

## E-Commerce Operations, Inventory & Profit Management System
**Shopify-Integrated Software**

---

## 1. Introduction

### 1.1 Purpose
This document outlines the high-level requirements for a management system that works alongside the client's Shopify store. It describes what the client needs and what the system will deliver.

### 1.2 Project Objective
The client needs one central system that clearly answers a single question:

> **How much was spent, how much was earned, and what is the actual profit or loss?**

Shopify remains the online selling store. The proposed system manages the business operations and finances behind it.

### 1.3 Business Context
- The business manufactures its own products from raw materials provided by suppliers.
- Orders are placed through Shopify and delivered to customers through four courier companies.
- Products are promoted through Meta and TikTok advertising.

---

## 2. Scope

### 2.1 In Scope
- Shopify integration for products, customers and orders
- Order, delivery, return and payment tracking
- Courier cost and settlement tracking
- Raw material, packaging and finished-product inventory
- Advertising and expense tracking
- Profit and loss calculation
- Dashboard and reports

### 2.2 Out of Scope
- Replacing the Shopify storefront or checkout
- Resale or purchased products (unless confirmed by the client)

---

## 3. System Overview

```
Suppliers → Raw Materials → Production → Finished Inventory
                                              │
                                              ▼
Meta / TikTok Ads → Shopify Store → Orders → Couriers → Customers
                                              │
                                              ▼
                       Software: Profit/Loss · Orders · Returns · Payments
```

---

## 4. Functional Requirements

### 4.1 Shopify Integration
- Automatically sync products, customers and orders from Shopify.
- Track order status from placement through delivery, cancellation or return.

### 4.2 Order & Delivery Management
- Manage the order lifecycle: New → Confirmed → Packed → Shipped → Delivered.
- Handle additional outcomes: Cancelled, Returned, Failed Delivery and Refunded.

### 4.3 Courier Management
- Record courier details, tracking and delivery status for all four couriers.
- Track courier charges (shipping and return) as business expenses.

### 4.4 Payments
- Record prepaid and Cash on Delivery payments separately.
- Settle each delivered order in two parts: **25% on delivery** and the **remaining 75% on the next day**.
- Show received, pending and settled amounts.

### 4.5 Returns
- Track returned and failed orders.
- Deduct the courier cost from the 25% advance, and return the remaining amount to the customer.
- Return items to stock only if they are inspected and sellable.

### 4.6 Raw Material & Inventory
- Add raw materials purchased from suppliers to inventory.
- Show used and remaining raw material quantities.
- Track packaging materials and finished-product stock.
- Record production and update stock accordingly.
- Show low-stock alerts.

### 4.7 Supplier Management
- Maintain supplier records and purchase history.
- Record supplier purchases as expenses.

### 4.8 Advertising Management
- Record Meta and TikTok ad spend by campaign and date.
- Treat ad spend as an expense.

### 4.9 Expense Management
- Record other business expenses by category, amount and date.

### 4.10 Profit & Loss
- Calculate net profit using the formula in Section 5.
- Show profit or loss overall and per product.

### 4.11 Dashboard & Reports
- Provide a dashboard showing orders, deliveries, returns, payments, expenses and profit or loss.
- Provide reports with date filters and export options.

### 4.12 User Roles
- Provide role-based access for staff (e.g. Owner, Manager, Inventory, Order Processing, Finance).

---

## 5. Business Rules

### 5.1 Net Profit

```
Net Profit = Revenue − Total Expense
```

### 5.2 Total Expense
Total expense includes:

| Expense | Source |
|---|---|
| Raw materials & packaging | Suppliers |
| Advertising | Meta and TikTok Ads |
| Courier charges | Four courier companies |
| Other operational costs | Manual expense entries |

### 5.3 Payment & Return Rules
- 25% of the payment is received on delivery and 75% on the next day.
- For returned orders, the courier cost is deducted from the 25% advance and the remaining amount is returned to the customer.

---

## 6. Non-Functional Requirements

- **Usability:** Simple, easy-to-use interface for non-technical staff.
- **Security:** Secure login with role-based access.
- **Reliability:** Accurate, consistent data synchronized with Shopify.
- **Performance:** Fast dashboard and report loading.

---

## 7. Assumptions & Open Items

- All current products are manufactured by the business.
- Final scope will be confirmed through the client confirmation questions (courier details, expense categories, reports to export, warehouses and user roles).

---

## 8. Approval

| | Name | Signature | Date |
|---|---|---|---|
| **Client** | | | |
| **Developer** | | | |
