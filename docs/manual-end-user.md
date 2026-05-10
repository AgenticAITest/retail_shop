# End User Manual
## Multi-Shop Retail Management System

**Audience:** Daily users — **Managers** (MANAGER role), **Cashiers** (CASHIER role), and other shop staff. This manual covers everything you need to do your job.

---

## Table of Contents

**For Everyone:**
1. [Logging In](#1-logging-in)
2. [The Console Dashboard](#2-the-console-dashboard)

**For Cashiers:**
3. [Point of Sale (POS) — Getting Started](#3-point-of-sale-pos--getting-started)
4. [Opening Your Shift](#4-opening-your-shift)
5. [Making a Sale](#5-making-a-sale)
6. [Handling Payments](#6-handling-payments)
7. [Completing the Sale](#7-completing-the-sale)
8. [Holding & Recalling Transactions](#8-holding--recalling-transactions)
9. [Discounts](#9-discounts)
10. [Closing Your Shift](#10-closing-your-shift)
11. [POS When the Internet is Down](#11-pos-when-the-internet-is-down)

**For Managers:**
12. [Viewing Sales Reports](#12-viewing-sales-reports)
13. [Inventory Counts (Stocktake)](#13-inventory-counts-stocktake)
14. [Transfer Requests](#14-transfer-requests)
15. [Purchase Orders (View & Create)](#15-purchase-orders-view--create)
16. [Pending Approvals](#16-pending-approvals)
17. [Voiding a Transaction](#17-voiding-a-transaction)

**Reference:**
18. [Keyboard Shortcuts (POS)](#18-keyboard-shortcuts-pos)
19. [Common Problems & Solutions](#19-common-problems--solutions)

---

## 1. Logging In

### Standard Login (Username + Password)

1. Open the app URL in your browser
2. The login page appears automatically
3. Enter your **Username** and **Password**
4. Click **Login**

### PIN Login (Cashiers — Faster Method)

If your manager has set up a PIN for you:
1. Go to `[app-url]/auth/pin-login`
2. Enter your **Username** and **PIN** (4–6 digits)
3. Click **Login**

> **Tip:** Bookmark the PIN login page for quick access.

### Forgot Your Password?

Click **Forgot Password** on the login page, enter your email, and check your inbox.

### Logging Out

Click your name or avatar in the **bottom-left corner** of the sidebar, then click **Log out**.

> **Important for cashiers:** Always lock the screen or log out when stepping away from the register (even briefly). The POS will lock automatically after 5 minutes of no activity.

---

## 2. The Console Dashboard

After logging in, you land on the dashboard. What you see depends on your role:

**Managers see:**
- KPI cards (Revenue Today, Revenue MTD, Inventory Value, Pending Approvals, Active Transfers, Low-Stock Alerts)
- Revenue trend chart (last 30 days)
- Inventory by location pie chart
- Quick action buttons: New PO, New Transfer, Stock Count, Open POS

**Cashiers see:**
- A simplified dashboard (most admin sections are hidden)
- The **Open POS** button — your primary action

> **Cashiers:** Your main work screen is the POS terminal, not the console. Click **Open POS** or go directly to the POS URL.

---

# FOR CASHIERS

---

## 3. Point of Sale (POS) — Getting Started

The POS is a full-screen application separate from the management console. It is designed for fast, focused sales transactions.

### Accessing the POS

From the console dashboard, click **Open POS**. The POS opens in full-screen mode.

The POS screen has two panels:
- **Left (60%):** Product browser — categories, search, product grid
- **Right (40%):** Cart — current transaction items and totals

### First Time on a New Device

If this is a new device or browser, you may be asked to:
1. **Select your location** — choose the shop you're working at
2. **Check for an open shift** — if no shift exists, you'll be prompted to open one

---

## 4. Opening Your Shift

Before you can process any sales, you must **open a shift**. A shift tracks all transactions during your working period.

### How to Open a Shift

1. The system will automatically prompt you to open a shift if none is open
2. Or, click the **Shift** button (clock icon) in the POS header
3. Click **Open Shift**
4. Enter the **Opening Float** — the cash amount in the register at the start of your shift (e.g., Rp 500,000)
5. Click **Open Shift** to confirm

You are now ready to sell.

### Cash Drops During Your Shift

If your cash drawer gets too full, you can record a **cash drop** (removing cash from the register) without closing the shift:
1. Click the **Shift** button
2. Click **Cash Drop**
3. Enter the **Amount** being removed
4. Enter a **Reason** (e.g., "Cash to safe")
5. Click **Confirm**

---

## 5. Making a Sale

### Step 1: Find the Product

**Method A — Browse by Category:**
1. Click a category tab at the top of the product grid
2. The products in that category appear below
3. Click a product card to add it to the cart

**Method B — Search:**
1. Click the **Search** box (magnifying glass icon)
2. Type the product name or SKU
3. Click the matching product to add it

**Method C — Barcode Scanner:**
1. Make sure the cursor is in the search box (click it once)
2. Scan the product barcode with your scanner
3. The product is added to the cart automatically

> **Barcode tip:** Most barcode scanners work like a keyboard — they type the barcode number and press Enter. The system detects this automatically.

### Step 2: Review the Cart

The right panel shows your cart:
- Product name
- Unit price
- Quantity (tap +/- to adjust)
- Line total

### Step 3: Adjust Quantities

- Click **+** to increase quantity
- Click **−** to decrease (minimum is 1)
- To remove an item completely: reduce quantity to 1 then click **−** once more, or click the **trash icon**

### Step 4: Check the Totals

At the bottom of the cart:
- **Subtotal** — before tax and discounts
- **Discount** — any transaction-level discount applied
- **Tax (PPN)** — calculated automatically
- **Total** — what the customer pays

---

## 6. Handling Payments

### Starting Checkout

Click the **Pay** button (green, bottom of cart) or press **F1** for Cash.

The checkout dialog opens.

### Payment Methods

You can accept **one or multiple payment methods** in a single transaction (split payment).

| Method | When to Use | Notes |
|--------|-------------|-------|
| **Cash** | Customer pays with physical money | Enter amount tendered; change is calculated automatically |
| **Card** | Debit or credit card | Enter the last 4 digits or authorization code as reference |
| **QRIS** | QR code payment (GoPay, OVO, ShopeePay, etc.) | Enter the payment reference or transaction ID |
| **Transfer** | Bank transfer | Enter the transfer reference number |

### Single Payment

1. Click the payment method (Cash, Card, QRIS, or Transfer)
2. For **Cash:** Enter the amount tendered (use the quick buttons for common denominations: Rp 10,000 / 50,000 / 100,000 / etc.)
3. For **Card/QRIS/Transfer:** Enter the payment reference
4. Click **Pay Now**

### Split Payment (Customer Pays with Multiple Methods)

Example: Customer pays Rp 50,000 cash + the rest by QRIS.

1. Click **+ Add Payment**
2. Select **Cash**, enter Rp 50,000
3. Click **+ Add Payment** again
4. Select **QRIS**, amount auto-fills with the remaining balance
5. Enter the QRIS reference
6. Click **Pay Now**

### Cash Change

For cash payments:
- Enter the amount the customer actually hands you (e.g., Rp 100,000 for a Rp 75,000 sale)
- The system shows the **Change** to give back (Rp 25,000)

---

## 7. Completing the Sale

### After Payment

After clicking **Pay Now**, the system:
1. Records the transaction
2. Deducts stock from inventory
3. Shows the **Completion Screen** with:
   - Transaction ID (e.g., `TPM-20260510-0042`)
   - Total paid and change
   - Receipt print button
   - New Sale button

### Printing a Receipt

**Thermal Printer (if connected):**
- Click **Print Receipt** — the receipt is sent automatically to the connected thermal printer

**PDF Receipt:**
- Click **Download PDF** — a receipt PDF downloads to the device

> **No receipt needed?** Click **New Sale** to immediately start the next transaction.

---

## 8. Holding & Recalling Transactions

Hold a transaction when a customer needs to come back, or when you need to serve another customer first.

### Holding a Transaction

1. While items are in the cart, click the **Hold** button (pause icon)
2. The cart is saved and cleared
3. You can now start a new transaction for the next customer

You can hold multiple transactions at the same time.

### Recalling a Held Transaction

1. Click the **Held** button (list icon)
2. A list of held transactions appears with timestamps
3. Click **Recall** next to the transaction you want
4. The cart is restored and you can continue

> **Note:** Held transactions expire after 24 hours if not recalled.

---

## 9. Discounts

### Per-Item Discount

To discount a specific product in the cart:
1. Click on the item in the cart
2. The item detail expands
3. Click **Discount**
4. Choose **Percentage** (e.g., 10%) or **Fixed Amount** (e.g., Rp 5,000)
5. Enter the value
6. The line total updates immediately

### Transaction Discount

To discount the entire transaction:
1. Click **Discount** at the bottom of the cart (below the subtotal)
2. Choose **Percentage** or **Fixed Amount**
3. Enter the value
4. The total updates immediately

> **Tip:** Per-item discounts and transaction discounts can be combined.

---

## 10. Closing Your Shift

At the end of your working period, close your shift to finalize all transactions.

### How to Close a Shift

1. Click the **Shift** button in the POS header
2. Click **Close Shift**
3. The system shows:
   - **Expected Cash** — based on opening float + all cash sales - cash drops
   - **Actual Cash** — enter the amount you actually count in the register
   - **Variance** — difference between expected and actual
4. If there is a variance, enter a **Variance Reason** (e.g., "Short Rp 5,000 - counting error")
5. Click **Close Shift** to confirm

Your shift is now closed. The system records your shift summary.

> **After closing:** Hand over the cash to your manager per your store procedure. Your manager can see your shift summary in the POS Report.

---

## 11. POS When the Internet is Down

The POS keeps working even when your internet connection drops. Here's what happens:

### Offline Mode Indicator

Look at the top-right of the POS screen. When offline, you'll see:
- A **red WiFi icon** or "Offline" badge
- The **Sync Queue** showing pending transactions

### What Still Works Offline

- ✅ Scanning barcodes and adding products
- ✅ Processing sales and payments
- ✅ Printing receipts (thermal printer)
- ✅ Holding and recalling transactions
- ✅ Viewing products (from cached catalog)

### What Doesn't Work Offline

- ❌ Products added to the catalog AFTER your last sync
- ❌ Price changes made after your last sync
- ❌ Real-time stock levels

### When Internet Returns

When your connection is restored:
- The system automatically syncs pending transactions to the server
- You'll see the sync queue count go down as transactions upload
- A "Sync Complete" indicator appears when everything is uploaded

### Manually Triggering a Sync

Click the **Sync** button (cloud/arrows icon) in the POS header:
- **Full Sync** — upload pending sales AND download latest product/price/inventory data
- **Force Push** — upload pending sales only

> **Important:** Do not close the browser or shut down the device while offline transactions are waiting to sync. Wait for the sync to complete first.

### Sync Queue Warning

If you see the sync queue number turning **yellow** (≥2,000 items) or **red** (≥5,000 items), notify your manager immediately. Very large queues may indicate a system issue.

---

# FOR MANAGERS

---

## 12. Viewing Sales Reports

**Navigation:** Console → Reports

### Quick Summary: Daily Sales

Go to **Reports → POS Report** → select "Last 7 days":
- See today vs yesterday trend
- View which cashiers are performing well
- Check which payment methods customers prefer
- See peak hours

### Revenue by Shop

Go to **Reports → Revenue Report** → "Last 30 days":
- Compare revenue across your locations
- Identify top-selling products
- Track average basket size

### Exporting Reports

Every report page has an **Export** button. Choose from:
- **CSV** — for working with in Excel/Sheets
- **XLSX** — formatted Excel workbook
- **PDF** — for printing or sharing

---

## 13. Inventory Counts (Stocktake)

Periodically count your physical stock to keep the system accurate.

**Navigation:** Console → Inventory Management → Stock Count

### Creating a New Stock Count

1. Click **+ New Count**
2. Select the **Location** to count
3. The system creates a count session with all active products pre-loaded
4. Click **Open** to enter the count session

### Counting Stock

In the count session, you see a table with:
- Product name and SKU
- **System Qty** — what the system thinks you have
- **Counted Qty** — where you enter your physical count
- **Variance** — the difference (calculated automatically)

For each product:
1. Physically count the items on your shelves/stockroom
2. Enter the number in the **Counted Qty** column
3. The variance column updates automatically

You can **save progress** and come back later — the count session stays open.

### Finalizing the Count

When all products are counted:
1. Review all variances (look for large discrepancies that need investigation)
2. Click **Finalize Count**
3. Confirm the finalization

The system will:
- Create adjustment records for every item with a non-zero variance
- Update inventory quantities to match your count
- Create movement records (type: `stock_count`) for full audit trail

> **Best practice:** Finalize counts at end of day or before opening, after the last sale.

---

## 14. Transfer Requests

Request stock to be sent from one location to another.

**Navigation:** Console → Transfer

### Creating a Transfer Request

1. Click **+ New Transfer**
2. **From Location** — where the stock is currently
3. **To Location** — where it needs to go
4. Click **+ Add Item** for each product to transfer:
   - Select the product
   - Enter the quantity to transfer
5. Click **Submit**

The transfer goes to your manager/admin for approval (if approval rules are set up).

### Tracking a Transfer

In the Transfer List, find your transfer. The **Status** column shows where it is in the process:

| Status | What It Means |
|--------|---------------|
| **Requested** | Submitted, awaiting approval |
| **Pending Approval** | Waiting for manager sign-off |
| **Approved** | Approved, source location preparing goods |
| **Picking** | Source location counting out the items |
| **Dispatched** | Goods are on their way |
| **Received** | Destination has received the goods |
| **Closed** | Transfer complete |

### Receiving a Transfer (Destination Location)

When goods arrive at your location and the transfer shows **Dispatched**:
1. Open the transfer
2. Click **Receive**
3. For each item, enter the **actually received quantity**
4. Click **Confirm Receipt**

The system updates your inventory automatically.

---

## 15. Purchase Orders (View & Create)

Purchase Orders are used to buy goods from suppliers.

**Navigation:** Console → Purchase Order

### Viewing Existing POs

The PO List shows all purchase orders with their status. Click on any PO to see its details, including:
- Supplier and delivery location
- Ordered items and quantities
- Received quantities (from GRNs)
- Status timeline

### Creating a Purchase Order

> **Note:** Managers can create POs. Large POs may require admin approval before they are processed.

1. Click **+ Create PO**
2. Select **Supplier**
3. Select the **Delivery Location** (your shop)
4. Set **Expected Delivery Date**
5. Add items:
   - Click **+ Add Item**
   - Search and select a product
   - Enter quantity and price
6. Click **Submit**

If the total exceeds the approval threshold set by your admin, the PO moves to **Pending Approval** and your manager will be notified.

---

## 16. Pending Approvals

If your admin has set up approval workflows, you may be able to **view** pending approvals. Only users with the ADMIN role or the specific approver role can **take action** on approvals.

**Navigation:** Console → Approval Engine → Pending Approvals

You'll see:
- Transaction type (Purchase Order, Transfer, Return)
- Reference number
- Total value
- Who submitted it
- Date submitted

**If you are an authorized approver:**
1. Click **Approve** to authorize the transaction
2. Click **Reject** → enter a reason → confirm rejection

Rejected transactions return to **Draft** status so the creator can revise and resubmit.

---

## 17. Voiding a Transaction

> **Note:** Only users with the `pos.transaction.void` permission (typically ADMIN) can void transactions.

If a transaction was processed incorrectly and needs to be cancelled:

**From the POS Screen:**
1. Click the **Transaction List** icon in the POS header
2. Find the transaction (search by transaction ID or scroll)
3. Click the transaction to open it
4. Click **Void Transaction**
5. Enter the **Void Reason** (required)
6. Confirm

**What happens when you void:**
- Transaction status changes to **Voided**
- Inventory is restored (stock added back)
- Payments are NOT automatically refunded — handle refunds per your store policy
- The void is logged in the audit trail with your username and reason

> **Important:** Voiding does not process a cash refund — it only records the void in the system. Handle the physical cash refund separately and note it in the shift record.

---

## 18. Keyboard Shortcuts (POS)

Speed up your work with these keyboard shortcuts on the POS screen:

| Key | Action |
|-----|--------|
| **F1** | Pay with Cash |
| **F2** | Pay with Card |
| **F3** | Pay with QRIS |
| **F4** | Pay with Bank Transfer |
| **F9** | Toggle product view (Grid ↔ List) |
| **Esc** | Clear the current cart |
| **Enter** (in search box) | Confirm barcode / search |

> **Tip:** F1–F4 open the checkout dialog pre-selected for that payment method, saving you a click.

---

## 19. Common Problems & Solutions

### "I can't find the product I need to sell"

1. Check your search spelling — try the SKU code instead of the name
2. Try searching in a different category tab
3. If the product was recently added: refresh the page or do a **Full Sync** (cloud icon)
4. Contact your manager — the product may not yet be active in the catalog

### "The barcode scanner isn't working"

1. Make sure the cursor is in the **search box** (click it)
2. Try scanning again slowly
3. If the scanner is sending characters but not adding to cart, check that the barcode is in the system (ask your manager)
4. As a fallback, type the barcode number manually and press Enter

### "The payment total doesn't match what I entered"

- Double-check that all payment lines add up to the transaction total
- For split payments: the system requires the total of all payments to equal or exceed the order total
- Remove and re-add payment lines if values look wrong

### "My shift is already open from yesterday" / "There's an old open shift"

Contact your manager. They can view and close open shifts from the management console.

### "The POS is locked / asking for password"

The POS locks automatically after 5 minutes of inactivity. Enter your **password** or **PIN** to unlock. This is a security feature to prevent unauthorized use when you step away.

### "I accidentally added the wrong product to the cart"

Remove it by clicking the **−** button until it's gone, or click the **trash icon** next to the item.

### "The internet went down mid-transaction"

The POS will continue working offline. Complete the transaction normally. The sale will be synced to the server automatically when internet returns. Look for the **Offline** indicator at the top of the POS.

### "I can't void a transaction"

Only managers/admins with the void permission can void transactions. Ask your manager for help.

### "My shift cash count doesn't match"

This is normal from time to time. When closing your shift:
1. Count the cash carefully
2. Enter the **Actual Cash** amount you counted
3. The system will show the **Variance**
4. Enter a reason for the variance (e.g., "Rp 5,000 shortage - suspect overpaid change")
5. Close the shift normally — your manager will review the variance

### "I get a 'Module not authorized' error"

Your account role may not have permission to access that section. Contact your manager.

### "I made a sale but it's not showing in the transaction list"

If you are offline, transactions are held in the sync queue. Wait for internet to return and sync. If you are online, refresh the page or contact your manager.

---

## Quick Reference Card (Print This)

```
╔══════════════════════════════════════════════╗
║        POS QUICK REFERENCE                   ║
╠══════════════════════════════════════════════╣
║  FIND PRODUCT   Search / Browse / Scan       ║
║  ADD TO CART    Click product card           ║
║  QTY ADJUST     + / − buttons in cart        ║
║  ITEM DISCOUNT  Click item → Discount        ║
║  ORDER DISCOUNT Cart footer → Discount       ║
║  HOLD           Hold button (pause icon)     ║
║  RECALL         Held button → Recall         ║
╠══════════════════════════════════════════════╣
║  CHECKOUT       Green PAY button             ║
║  CASH           F1 or Click Cash             ║
║  CARD           F2 or Click Card             ║
║  QRIS           F3 or Click QRIS             ║
║  TRANSFER       F4 or Click Transfer         ║
╠══════════════════════════════════════════════╣
║  CLEAR CART     Esc                          ║
║  TOGGLE VIEW    F9                           ║
╠══════════════════════════════════════════════╣
║  SHIFT OPEN     Shift icon → Open Shift      ║
║  CASH DROP      Shift icon → Cash Drop       ║
║  SHIFT CLOSE    Shift icon → Close Shift     ║
╚══════════════════════════════════════════════╝
```

---

*Last updated: May 2026 | System version: 1.0.0*
