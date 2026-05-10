# Tenant Admin (Shop Owner) User Manual
## Multi-Shop Retail Management System

**Audience:** ADMIN role — the shop owner or operations manager who sets up and runs the entire retail operation within your tenant. You have full access to all retail modules.

---

## Table of Contents

1. [Overview & Your Role](#1-overview--your-role)
2. [Logging In](#2-logging-in)
3. [First-Time Setup Guide](#3-first-time-setup-guide)
4. [Location Management](#4-location-management)
5. [Tax Configuration](#5-tax-configuration)
6. [Product Catalog](#6-product-catalog)
7. [Supplier Management](#7-supplier-management)
8. [Approval Engine](#8-approval-engine)
9. [Purchase Orders](#9-purchase-orders)
10. [Goods Received Notes (GRN)](#10-goods-received-notes-grn)
11. [Supplier Returns & Credit Notes](#11-supplier-returns--credit-notes)
12. [Inventory Management](#12-inventory-management)
13. [Inter-Shop Transfers](#13-inter-shop-transfers)
14. [Reports & Analytics](#14-reports--analytics)
15. [User Management](#15-user-management)
16. [Importing Data from MokaPOS](#16-importing-data-from-mokapos)
17. [Common Tasks Reference](#17-common-tasks-reference)

---

## 1. Overview & Your Role

As the **Tenant Admin (ADMIN role)**, you are the shop owner or operations manager. You:

- Set up your business's locations, products, suppliers, and tax settings
- Run the full procurement cycle (buy → receive → pay)
- Monitor and manage inventory across all your locations
- Transfer stock between locations
- View all reports and analytics
- Create and manage staff accounts (managers, cashiers)
- Configure approval workflows

You do **not** operate the POS cash register yourself (that's the cashier's job), but you have full access to all POS data and can void transactions.

---

## 2. Logging In

1. Open the application URL provided by your system administrator
2. Enter your **username** and **password**
3. Click **Login**

> **Tip:** If you also work as a cashier, you can use a **PIN login** at `/auth/pin-login` — enter your 4–6 digit PIN instead of a password.

### Forgot your password?
Click **Forgot Password** on the login page. Enter your email address and check your inbox for a reset link.

---

## 3. First-Time Setup Guide

When you first log in, follow this sequence. Each step depends on the previous one.

```
1. Add Locations         → your shops/warehouses
2. Configure Tax         → PPN rate and calculation mode
3. Set Up Categories     → organize your products
4. Add Products          → with pricing and barcodes
5. Add Suppliers         → companies you buy from
6. Configure Approvals   → optional, for controlled purchasing
7. Create Staff Accounts → managers, cashiers
8. Import Opening Stock  → from MokaPOS or manual entry
```

---

## 4. Location Management

Locations are your physical shop outlets, warehouses, or distribution centers. Every product, inventory count, POS transaction, and transfer is tied to a location.

**Navigation:** Console → Location Management

### 4.1 Adding a Location

**Navigation:** Location Management → **+ Add Location**

| Field | Required | Notes |
|-------|----------|-------|
| **Name** | Yes | e.g., "Toko Pusat Menteng" |
| **Code** | Yes | Short code, e.g., `TPM`. Used in transaction IDs. Unique across your tenant. |
| **Type** | Yes | `shop` (POS enabled), `warehouse`, or `distribution_center` |
| **Address** | No | Full address for reference |
| **Phone** | No | Contact number |
| **Status** | Yes | Active / Inactive |

Click **Save**. The location is immediately available for use.

### 4.2 Editing a Location

Click on any location name → **Edit**. You can change name, address, phone, and status.

> **You cannot change the location code** after creation — it appears in all transaction IDs.

### 4.3 Deactivating a Location

Edit the location → set Status to **Inactive**. Inactive locations:
- Cannot be used for new POS transactions
- Cannot be selected for new transfers
- Existing historical data is preserved

---

## 5. Tax Configuration

Configure the PPN (Pajak Pertambahan Nilai) tax rate that applies to all your sales.

**Navigation:** Console → Tax Configuration

### 5.1 Setting Up Tax

**Navigation:** Tax Configuration → **Add/Edit Tax Config**

| Field | Notes |
|-------|-------|
| **Tax Name** | e.g., "PPN 11%" |
| **Rate** | Percentage, e.g., `11` for 11% |
| **Calculation Mode** | See below |
| **Status** | Only one config should be Active at a time |

### Tax Calculation Modes

**Exclusive (tax added on top of price):**
- Customer sees price = Rp 10,000
- Tax = Rp 10,000 × 11% = Rp 1,100
- Total = Rp 11,100

**Inclusive (tax already in the price):**
- Customer sees price = Rp 11,100
- Tax portion = Rp 11,100 / 1.11 × 0.11 = Rp 1,100
- Total = Rp 11,100 (same number shown)

> **Tip:** Most Indonesian retail businesses use **Inclusive** pricing so the shelf price is what customers pay.

### 5.2 Products Exempt from Tax

When adding products, you can uncheck **Tax Applicable** for specific items (e.g., basic food staples). Those items will not have PPN applied at the POS.

---

## 6. Product Catalog

Products are the items you sell. This section covers categories, products, variants, and barcodes.

**Navigation:** Console → Product Catalog

### 6.1 Managing Categories

Organize your products into a hierarchy (e.g., Beverages → Coffee → Espresso-Based).

**Navigation:** Product Catalog → **Category**

#### Adding a Category
1. Click **+ Add Category**
2. Enter the **Category Name**
3. Optionally select a **Parent Category** for sub-categories
4. Set **Status** to Active
5. Save

#### Category Hierarchy
- Level 1: Top-level (e.g., "Beverages")
- Level 2: Sub-category (e.g., "Coffee")
- Level 3: Sub-sub-category (e.g., "Espresso-Based")

### 6.2 Adding a Product

**Navigation:** Product Catalog → **+ Add Product**

#### Basic Information

| Field | Required | Notes |
|-------|----------|-------|
| **SKU Code** | Yes | Your internal stock code. Must be unique. Example: `BEV-001` |
| **Product Name** | Yes | Display name |
| **Category** | No | Select from your category list |
| **Brand** | No | Optional brand name |
| **Unit of Measure** | Yes | Default: `pcs`. Others: `kg`, `liter`, `box`, etc. |
| **Status** | Yes | `Draft` (not yet active), `Active` (can be sold), `Discontinued`, `Archived` |

#### Pricing

| Field | Notes |
|-------|-------|
| **Base Cost Price** | What you paid for it (purchase cost). Used for inventory valuation. |
| **Selling Price** | Default retail price shown in POS |
| **Tax Applicable** | Check if PPN applies to this product |

#### Location-Specific Pricing (Optional)
If you want different prices at different shops, add location price overrides in the Location Prices section.

#### Variants
For products that come in multiple sizes/colors/flavors:
1. Scroll to the **Variants** section
2. Click **+ Add Variant**
3. Fill in variant attributes (e.g., Size: Large), its own SKU, cost price, and selling price
4. Each variant is treated as a separate inventory item

#### Barcodes
1. Scroll to **Barcodes**
2. Click **+ Add Barcode**
3. Scan or type the barcode value
4. Select the type: `EAN-13`, `UPC-A`, or `Internal`
5. Assign to the product or a specific variant

### 6.3 Editing a Product

Click on a product name → **Edit**. All fields are editable.

> **Tip:** When a product is discontinued (no longer sold but has remaining stock), set status to `Discontinued` instead of deleting it. This preserves the transaction history.

### 6.4 Importing Products from CSV

If you have a large catalog, import all products at once.

**Navigation:** Product Catalog → **Import/Export → Import**

1. Download the **CSV Template** to see the required format
2. Fill in your product data
3. Upload the completed CSV
4. Review the import results (imported / skipped / errors)

**Required CSV columns:**
`sku_code, name, category, uom, cost_price, selling_price, tax_applicable, status`

> **Tip:** If you're migrating from MokaPOS, use the dedicated **MokaPOS Migration** tool instead (see Section 16).

---

## 7. Supplier Management

Suppliers are the companies you purchase goods from.

**Navigation:** Console → Supplier Management

### 7.1 Adding a Supplier

**Navigation:** Supplier Management → **+ Add Supplier**

#### Basic Details

| Field | Notes |
|-------|-------|
| **Supplier Code** | Unique code, e.g., `SUP-001` |
| **Company Name** | Full legal name |
| **NPWP** | Tax ID number |
| **Payment Terms** | e.g., `NET30`, `COD`, `NET60` |
| **Credit Limit** | Maximum credit amount in IDR |
| **Currency** | Default: `IDR` |
| **Status** | Active / Inactive |

#### Contact Persons
Add one or more contact people with their role:
- **Sales** — your account manager
- **AR** (Accounts Receivable) — for payment inquiries
- **Logistics** — for delivery coordination
- **General** — other contacts

For each contact: name, phone, email, position.

#### Bank Details (Optional)
Add bank account details for payment transfers: bank name, account number, account name.

### 7.2 Linking Supplier Products

After creating a supplier, link the products you purchase from them:
1. Open the supplier detail view
2. Click **Linked Products** or **+ Add Product**
3. Select a product from your catalog
4. Enter the supplier's own SKU for this product
5. Enter the supplier's listed price

This makes creating purchase orders faster — prices are pre-filled.

---

## 8. Approval Engine

The Approval Engine lets you require manager approval before certain transactions are processed. This is important for financial control — for example, preventing staff from placing large purchase orders without your sign-off.

**Navigation:** Console → Approval Engine → Configuration

### 8.1 Setting Up Approval Rules

**Navigation:** Approval Engine → Configuration → **+ Add Rule**

| Field | Notes |
|-------|-------|
| **Transaction Type** | `purchase_order`, `supplier_return`, or `transfer` |
| **Approval Required** | Toggle on to activate |
| **Threshold (IDR)** | Transactions above this amount require approval. Set to `0` to require approval for all. |
| **Approver Role** | Which role can approve (e.g., `ADMIN`) |

**Example:** Require ADMIN approval for all purchase orders above Rp 5,000,000.

### 8.2 How Approval Works

When a user submits a transaction that requires approval:
1. The transaction moves to **Pending Approval** status
2. The system notifies approvers (users with the approver role)
3. An approver reviews and clicks **Approve** or **Reject**
4. If approved → transaction continues to the next stage
5. If rejected → transaction returns to **Draft** for revision

### 8.3 Reviewing Pending Approvals

**Navigation:** Approval Engine → Pending Approvals

You see a list of all transactions waiting for your decision. For each one:
- Click **Approve** to authorize it
- Click **Reject** → enter a reason → confirm

### 8.4 Audit Log

Every action in the system is logged here: who did what, when, and what changed.

**Navigation:** Approval Engine → Audit Log

Filter by date, user, module, or action type.

---

## 9. Purchase Orders

Purchase Orders (POs) are the formal documents you send to suppliers when you want to buy goods.

**Navigation:** Console → Purchase Order

### 9.1 PO Status Flow

```
Draft → (Submit) → Pending Approval → (Approve) → Approved → (Send) → Sent
  → (GRN Created) → Partially Received / Fully Received → (Close) → Closed
```

At any point before receiving: `→ Cancelled`

### 9.2 Creating a Purchase Order

**Navigation:** Purchase Order → **+ Create PO**

1. **Select Supplier** — choose from your supplier list
2. **Select Delivery Location** — which shop to deliver to
3. **Set Expected Delivery Date**
4. **Add Line Items:**
   - Click **+ Add Item**
   - Search and select a product
   - Enter quantity, unit price, discount (%)
   - Tax is calculated automatically
5. Review the **Total** at the bottom
6. Click **Save as Draft** to save without submitting

### 9.3 Submitting a PO for Approval

When your PO is ready:
1. Open the PO
2. Click **Submit**
3. If the total exceeds your approval threshold → status becomes **Pending Approval** (you'll see a message)
4. If no approval required → status becomes **Approved** immediately

### 9.4 Sending a PO to Your Supplier

After approval, notify your supplier that the PO is placed:
1. Open the approved PO
2. Click **Mark as Sent**
3. Status becomes **Sent**
4. (Optional) Print or download the PO to email/WhatsApp to your supplier

### 9.5 Tracking PO Status

The PO List shows all POs with their current status. Filter by status using the tabs or filter dropdown:
- **Draft** — not yet submitted
- **Pending Approval** — awaiting manager sign-off
- **Approved** — approved, not yet sent
- **Sent** — sent to supplier, awaiting delivery
- **Partially Received** — some items received via GRN
- **Fully Received** — all items received
- **Closed** — completed and closed
- **Cancelled** — abandoned

---

## 10. Goods Received Notes (GRN)

When supplier goods arrive at your shop, you record a **GRN** (Goods Received Note) to officially receive them into inventory.

**Navigation:** Console → GRN

### 10.1 GRN Status Flow

```
Draft → Quality Inspection → Accepted → Stock Updated (Final)
```

### 10.2 Creating a GRN

1. **Navigation:** GRN → **+ Create GRN**
2. Select the **Purchase Order** from the dropdown (only POs with status `Sent` or `Partially Received` appear)
3. The system pre-fills all ordered items with their expected quantities
4. For each item, enter:
   - **Received Quantity** — how many physically arrived
   - **Rejected Quantity** — how many you are rejecting (damaged, wrong item, etc.)
   - **Rejection Reason** — required if rejected qty > 0

> **Tip:** If everything arrived correctly, just click **Save** — received quantities are pre-filled with the ordered amounts.

### 10.3 Quality Inspection

After saving the GRN:
1. Click **Move to Quality Inspection**
2. The GRN form shows a quality section for each item
3. Mark each item as **Passed** or **Failed**
4. If all items pass → click **Accept**
5. If items fail → they are returned to the rejection pool

### 10.4 Updating Stock

After acceptance:
1. Click **Update Stock**
2. The system:
   - Adds accepted quantities to inventory (`qty_on_hand`)
   - Updates the PO's received quantities
   - Changes PO status to Partially Received or Fully Received
   - Creates inventory movement records (type: `grn`)

---

## 11. Supplier Returns & Credit Notes

When you need to return goods to a supplier (defective, wrong delivery, excess stock), use the Supplier Return flow.

**Navigation:** Console → Supplier Return

### 11.1 Return Status Flow

```
Requested → Pending Approval → Approved → Dispatched → Acknowledged 
→ Credit Note Received → Closed
```

Or if rejected: `→ Rejected (Final)`

### 11.2 Creating a Return

1. **Navigation:** Supplier Return → **+ Create Return**
2. Select the **GRN** you are returning from (must be in `accepted` or `stock_updated` status)
3. The system shows all receivable items and how many can still be returned
4. For each item to return:
   - Enter **Return Quantity**
   - Select **Reason**: Defective, Damaged, Expired, Excess, Wrong Item
5. Save

### 11.3 Processing the Return

Follow the status progression:
1. **Submit for Approval** (if configured) or skip to Approved
2. **Mark as Dispatched** — goods have been physically sent back to supplier
3. **Mark as Acknowledged** — supplier confirmed receipt
4. **Record Credit Note** — enter the credit note details:
   - Credit Note Number
   - Amount (IDR)
   - Date
   - Is it a replacement? (Yes/No)
5. Status automatically moves to **Credit Note Received**
6. **Close** the return to finalize

---

## 12. Inventory Management

Monitor and control your stock levels across all locations.

**Navigation:** Console → Inventory Management

### 12.1 Stock Counts (Stocktake)

A stock count is a physical count of your actual inventory, used to reconcile with system quantities.

**Navigation:** Inventory Management → Stock Count → **+ New Count**

1. Select the **Location** to count
2. The system loads all active products with their system quantities
3. Enter the **Counted Quantity** for each item
4. **Save** to preserve progress (you can return and continue)
5. When finished, click **Finalize**
6. The system creates adjustment records for all items with a variance (counted ≠ system)

**Variance color coding:**
- 🟢 Green number = Overage (more than system expected)
- 🔴 Red number = Shortage (less than system expected)
- Dash = No variance

> **Tip:** Do stock counts at end-of-day or before opening to minimize active sales affecting the count.

### 12.2 Manual Adjustments

For one-off corrections without a full stocktake.

**Navigation:** Inventory Management → Adjustments → **+ New Adjustment**

| Field | Notes |
|-------|-------|
| **Location** | Which shop |
| **Product** | Item to adjust |
| **Quantity** | Positive to add stock, negative to remove |
| **Reason** | Damage, Theft, Write-off, Correction, Other |
| **Notes** | Optional explanation |

The adjustment is recorded immediately in the movement ledger.

### 12.3 Movement Ledger

Every stock change is recorded here for full traceability.

**Navigation:** Inventory Management → Movement Ledger

| Movement Type | What It Means |
|--------------|---------------|
| `sale` | Stock sold at POS |
| `return` | Customer return (stock added back) |
| `grn` | Goods received from supplier |
| `transfer_out` | Stock sent to another location |
| `transfer_in` | Stock received from another location |
| `adjustment` | Manual adjustment |
| `stock_count` | Stocktake variance correction |
| `opening_balance` | Initial stock entry (MokaPOS import or manual) |

Filter by movement type, location, or date range to trace any stock discrepancy.

### 12.4 Low-Stock Alerts

Set minimum stock thresholds per product per location. You'll see which products are running low.

**Navigation:** Inventory Management → Alerts

1. Click **+ Add Alert Rule**
2. Select Location and Product
3. Set **Minimum Quantity** — an alert triggers when `qty_on_hand ≤ min_qty`
4. Optionally set **Maximum Quantity** — for over-stocking alerts
5. Save

The **Active Alerts** panel at the top of the Alerts page shows all products currently below threshold. Use this as your reorder trigger.

### 12.5 Consolidated Inventory View

See all your inventory across all locations in one table.

**Navigation:** Inventory Management → Consolidated

For each product you see:
- **On Hand** — physical stock across all locations
- **In Transit** — stock on its way in a transfer
- **On Order** — stock on open Purchase Orders (not yet received)
- **Available** — On Hand + In Transit + On Order
- **Value** — stock × cost price in IDR

Click on a product to see a breakdown by location.

### 12.6 Inventory Valuation

**Navigation:** Inventory Management → Valuation

Summary of your total inventory value with:
- Total inventory value (IDR)
- Total units
- Number of products with stock
- Value breakdown by location

> **Note:** Valuation uses the **base cost price** per product (Weighted Average Cost method).

---

## 13. Inter-Shop Transfers

Move stock between your locations without creating a purchase order.

**Navigation:** Console → Transfer

### 13.1 Transfer Status Flow

```
Requested → Pending Approval → Approved → Picking → Dispatched 
→ Received → Closed
```

### 13.2 Creating a Transfer

**Navigation:** Transfer → **+ New Transfer**

1. Select **Source Location** (where stock is coming from)
2. Select **Destination Location** (where stock is going)
3. Add items:
   - Click **+ Add Item**
   - Select product
   - Enter quantity to transfer
4. Click **Submit**

### 13.3 Processing a Transfer

| Stage | Who Does It | How |
|-------|------------|-----|
| **Pending Approval** | Admin/Approver | Click Approve |
| **Approved → Picking** | Source location staff | Click "Start Picking", enter actual picked quantities per item |
| **Picking → Dispatched** | Source location staff | Click "Dispatch". System deducts from source inventory. |
| **Dispatched → Received** | Destination location staff | Click "Receive", enter received quantities. System updates destination inventory. |
| **Received → Closed** | Admin | Click "Close" to finalize |

### 13.4 Discrepancies

When receiving, if the received quantity differs from the dispatched quantity, the system flags a discrepancy:
- **Short** — received less than sent (items may have been lost or damaged in transit)
- **Over** — received more than sent (counting error at dispatch)
- **Damaged** — items arrived damaged

The transfer view shows the discrepancy per item. Investigate any significant discrepancies with the transporting staff.

---

## 14. Reports & Analytics

Understand your business performance through reports.

**Navigation:** Console → Reports

All reports support **CSV, XLSX, and PDF export** via the export button.

### 14.1 Dashboard (KPIs)

**Navigation:** Reports → Dashboard

Real-time overview:
- **Revenue Today** — total sales today (IDR)
- **Revenue MTD** — month-to-date revenue
- **Inventory Value** — total stock value across all locations
- **Pending Approvals** — POs/transfers awaiting your approval
- **Active Transfers** — transfers in progress
- **Low-Stock Alerts** — products below minimum threshold

**Charts:**
- Revenue trend (last 30 days)
- Inventory value by location (pie chart)

**Quick Actions:** Jump directly to New PO, New Transfer, Stock Count, Open POS.

### 14.2 Revenue Report

**Navigation:** Reports → Revenue Report | Period: Last 7 / 30 / 90 days

- Revenue trend chart
- Revenue by shop (location, revenue, number of transactions, average basket size)
- Top 10 selling products by revenue

### 14.3 Inventory Report

**Navigation:** Reports → Inventory Report

- Stock by location (on hand, in transit, value)
- Slow-moving stock — products with stock but zero sales in 30 days (potential dead stock)

### 14.4 POS Report

**Navigation:** Reports → POS Report | Period: Last 7 / 30 / 90 days

- Hourly sales distribution (which hours are busiest)
- Payment method breakdown (Cash vs Card vs QRIS vs Transfer)
- Cashier performance (transactions and revenue per cashier)
- Voided transactions list (with reasons)

### 14.5 Tax (PPN) Report

**Navigation:** Reports → Tax Report | Period: Last 7 / 30 / 90 days

- Total PPN collected
- PPN breakdown by location
- PPN breakdown by product category

Use this for your monthly tax filing.

### 14.6 Procurement Report

**Navigation:** Reports → Procurement Report

- PO status summary (how many POs in each state)
- Supplier scorecard (total POs, completed POs, returns per supplier)
- GRN timeliness (average days from PO sent to GRN received)

### 14.7 Transfer Report

**Navigation:** Reports → Transfer Report

- Transfer volume between locations
- Discrepancy summary (products that frequently have transit discrepancies)

### 14.8 Scheduled Reports

**Navigation:** Reports → Scheduled Reports

Automatically email reports to yourself or your team.

1. Click **+ Add Schedule**
2. Configure:
   - **Report Type** (Revenue, Inventory, POS, Tax, Procurement, Transfer)
   - **Frequency** (Daily, Weekly, Monthly)
   - **Time** — when to send
   - **Format** (CSV, XLSX, PDF)
   - **Recipients** — one or more email addresses
3. Save

Use **Run Now** to immediately send the report without waiting for the schedule.

---

## 15. User Management

Create and manage accounts for your staff.

**Navigation:** Console → System → User

> As an ADMIN, you manage users **within your tenant only**. You cannot see other tenants' users.

### 15.1 Creating a Staff Account

**Navigation:** System → User → **+ Add User**

| Field | Notes |
|-------|-------|
| **Full Name** | Staff member's name |
| **Username** | Login ID. Suggestion: first initial + last name, e.g., `budi.santoso` |
| **Email** | For password reset |
| **Password** | Minimum 8 characters. Share securely with the staff member. |
| **Status** | Set to Active |

After creating, assign a **Role**:
1. Go to System → Role
2. Find the appropriate role (MANAGER or CASHIER)
3. Add the user to that role

### 15.2 Role Guide for Staff

| Role | Give To | What They Can Do |
|------|---------|-----------------|
| **ADMIN** | Shop owners, operations managers | Full access to everything |
| **MANAGER** | Store managers | Reports, inventory counts, view orders, transfer requests |
| **CASHIER** | Cash register operators | POS terminal only |

### 15.3 Resetting a Staff Password

**Navigation:** System → User → click on the user → **Reset Password**

### 15.4 PIN Login for Cashiers

Cashiers can log into the POS using a short PIN instead of a full password.

To set a PIN:
1. Go to the user's profile
2. Click **Set PIN**
3. Enter a 4–6 digit PIN
4. Save

The cashier can then log in at `/auth/pin-login` using their username and PIN.

### 15.5 Deactivating a Staff Account

When a staff member leaves, immediately deactivate their account:
1. Go to System → User
2. Click on their name → **Edit**
3. Set **Status → Inactive**
4. Save

Their historical records (transactions, movements) are preserved, but they can no longer log in.

---

## 16. Importing Data from MokaPOS

If you are migrating from MokaPOS, use the built-in import tool to bring in your existing products and opening stock levels.

**Navigation:** Console → MokaPOS Migration → Import CSV

### 16.1 Exporting from MokaPOS

In MokaPOS:
1. Go to **Menu → Product**
2. Click **Export**
3. Download the CSV file (named something like `items_export.csv`)

The export includes: product name, category, type (Regular/Variant/Modifier), SKU, barcode, price, cost, track inventory, stock.

### 16.2 Importing into the System

1. **Navigate:** MokaPOS Migration → Import CSV
2. **Select Target Location** — which shop this opening stock applies to
3. **Click the upload zone** and select your exported CSV file
4. Click **Parse CSV**

### 16.3 Reviewing the Preview

Before importing, review the parsed data:
- **Categories** — unique category names found
- **Products** — regular products
- **Variant Products** — products with multiple variants (e.g., Coffee in Small/Medium/Large)
- **Modifiers Skipped** — MokaPOS modifiers are not imported (they don't have an equivalent)
- **Warnings** — any data issues (missing SKUs, duplicate names, etc.)

Review the product table preview (first 20 rows). Check that names, prices, and types look correct.

### 16.4 Running the Import

Click **Import {N} products**.

The system will:
1. Create product categories (new ones only; existing categories with the same name are reused)
2. Create products (skips if SKU already exists)
3. Create variants for variant-type products
4. Add barcodes where provided
5. Set opening stock quantities at your selected location
6. Create `opening_balance` inventory movement records

When complete, you'll see a summary:
- Categories created
- Products created
- Variants created
- Barcodes created
- Stock entries set
- Modifiers skipped
- Any warnings

### 16.5 Rollback

If the import had problems and you need to undo it:
1. Go to **MokaPOS Migration → Import History**
2. Find the batch
3. Click the **Rollback** button (trash icon)
4. Confirm

This deletes all entities created by that batch (categories, products, variants, barcodes, stock entries). The rollback cannot undo changes to pre-existing records.

---

## 17. Common Tasks Reference

### How do I see total stock across all my shops?
Go to **Inventory Management → Consolidated**. You see On Hand, In Transit, On Order, and Value for every product.

### How do I find which products are running low?
Go to **Inventory Management → Alerts**. The red banner at the top shows products currently below their minimum threshold.

### How do I reorder from a supplier?
1. Go to **Purchase Order → + Create PO**
2. Select the supplier
3. Check your low-stock alerts to know what quantities you need
4. Add items and quantities
5. Submit

### A staff member forgot their POS PIN
Go to **System → User → [their name]** → **Set PIN** → enter new PIN → Save.

### How do I see yesterday's sales?
Go to **Reports → POS Report** and select "Last 7 days". You can also go to **Reports → Revenue Report** for a revenue-focused view.

### How do I find a specific transaction to void it?
You need the ADMIN role and the `pos.transaction.void` permission. The cashier can access the Transaction List from the POS screen, but only you (ADMIN) can void.

### How do I generate a tax report for VAT filing?
Go to **Reports → Tax Report** → select the relevant period (last month) → click **Export** → choose PDF or XLSX.

### I received goods but the system says the PO is not available for GRN
The PO must be in **Sent** or **Partially Received** status before a GRN can be created. Check:
1. Is the PO in **Approved** status? → Click "Mark as Sent" first
2. Is the PO in **Draft/Pending Approval**? → Complete the approval process first

---

*Last updated: May 2026 | System version: 1.0.0*
