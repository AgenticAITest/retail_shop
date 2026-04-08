# Page Object Model (POM) Report

**Application:** Multi-Shop Retail Management System  
**Generated:** 2026-04-08  
**Scope:** All actionable elements (buttons, inputs, selects, textareas, checkboxes, links, dialogs) across all pages

---

## Table of Contents

1. [Location Management](#1-location-management)
2. [Tax Configuration](#2-tax-configuration)
3. [Product Catalog](#3-product-catalog)
4. [Approval Engine](#4-approval-engine)
5. [Supplier Management](#5-supplier-management)
6. [Purchase Order](#6-purchase-order)
7. [Goods Received Note](#7-goods-received-note)
8. [Supplier Returns & Credit Notes](#8-supplier-returns--credit-notes)
9. [Point of Sale (POS)](#9-point-of-sale-pos)
10. [Inter-Shop Transfers](#10-inter-shop-transfers)
11. [Inventory Management](#11-inventory-management)
12. [Reports & Analytics](#12-reports--analytics)

---

## 1. Location Management

### 1.1 Location List

**Route:** `/console/modules/location-management/location`  
**Source:** `src/modules/location-management/client/pages/location/Location.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Add Location | `getByRole('button', { name: /add location/i })` |
| 2 | Input | Search filter | `getByPlaceholder('Search...')` — DebouncedInput, 500ms |
| 3 | Button | Clear search (X icon) | `svg` X icon inside InputGroup, `onClick={clearFilter}` |
| 4 | Button | Sort by Code | SortButton `column="code"` |
| 5 | Button | Sort by Name | SortButton `column="name"` |
| 6 | Button | Sort by Type | SortButton `column="type"` |
| 7 | Button | Sort by City | SortButton `column="city"` |
| 8 | Button | Sort by Status | SortButton `column="status"` |
| 9 | Link | Location code → detail | `Link to="/console/modules/location-management/location/{id}"` |
| 10 | Button | Edit location (pencil icon) | Per-row secondary button, navigates to edit |
| 11 | Button | Delete location (X icon) | Per-row destructive button |
| 12 | Dialog (Confirm) | Confirm delete | ConfirmDialog `title="Confirm Delete"` |
| 13 | Pagination | Page navigation | DataPagination component |

---

### 1.2 Location Add / Edit

**Route:** `/console/modules/location-management/location/add` (or `/:id/edit`)  
**Source:** `src/modules/location-management/client/pages/location/LocationAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (text) | Code | FormField `name="code"` |
| 2 | Input (text) | Name | FormField `name="name"` |
| 3 | Select | Type | FormField `name="type"` — options: shop, warehouse, distribution_center |
| 4 | Select | Parent Location | FormField `name="parentId"` — dynamic locations |
| 5 | Textarea | Address | FormField `name="address"` |
| 6 | Input (text) | City | FormField `name="city"` |
| 7 | Input (text) | Province | FormField `name="province"` |
| 8 | Input (text) | Phone | FormField `name="phone"` |
| 9 | Input (text) | Timezone | FormField `name="timezone"` |
| 10 | Select | Status | FormField `name="status"` — options: active, inactive |
| 11 | Select | Sync Frequency | FormField `name="syncConfig.frequency"` — conditional (type=shop) |
| 12 | Input (text) | Sync Windows | FormField `name="syncConfig.windows"` — conditional |
| 13 | Select | Bandwidth Mode | FormField `name="syncConfig.bandwidthMode"` — conditional |
| 14 | Switch | Manual Sync Enabled | FormField `name="syncConfig.manualSyncEnabled"` — conditional |
| 15 | Switch | Auto Sync on Reconnect | FormField `name="syncConfig.autoSyncOnReconnect"` — conditional |
| 16 | Button | Save (submit) | `type="submit"` with Save icon |
| 17 | Button | Cancel | `type="button"` navigates back to list |

---

## 2. Tax Configuration

### 2.1 Tax Config List

**Route:** `/console/modules/tax-configuration/config`  
**Source:** `src/modules/tax-configuration/client/pages/config/TaxConfig.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Update Tax Rate | Button with Plus icon, navigates to add |

---

### 2.2 Tax Config Add / Edit

**Route:** `/console/modules/tax-configuration/config/add`  
**Source:** `src/modules/tax-configuration/client/pages/config/TaxConfigAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (number) | PPN Rate (%) | FormField `name="ratePercent"`, min=0, max=100, step=0.01 |
| 2 | Button (Popover) | Effective Date | Popover trigger → Calendar component |
| 3 | Calendar | Date picker | `mode="single"` Calendar in PopoverContent |
| 4 | Select | Calculation Mode | FormField `name="calcMode"` — options: inclusive, exclusive |
| 5 | Button | Save (submit) | `type="submit"` with Save icon |
| 6 | Button | Cancel | `type="button"` navigates back |

---

## 3. Product Catalog

### 3.1 Category List

**Route:** `/console/modules/product-catalog/category`  
**Source:** `src/modules/product-catalog/client/pages/category/Category.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Add Category | Button with Plus icon, navigates to add |
| 2 | Button | List View toggle | Toggle button for list mode |
| 3 | Button | Tree View toggle | Toggle button with TreePine icon |
| 4 | Input | Search filter | DebouncedInput `placeholder="Search..."` |
| 5 | Button | Clear search (X icon) | `onClick={clearFilter}` |
| 6 | Button | Sort by Name | SortButton `column="name"` |
| 7 | Button | Sort by Level | SortButton `column="level"` |
| 8 | Button | Sort by Parent | SortButton `column="parentName"` |
| 9 | Button | Sort by Status | SortButton `column="status"` |
| 10 | Button | View category (Eye icon) | Per-row, navigates to view |
| 11 | Button | Edit category (Pencil icon) | Per-row, navigates to edit |
| 12 | Button | Delete category (X icon) | Per-row destructive |
| 13 | Input | Tree View search | TreeView `searchPlaceholder="Search categories..."` |
| 14 | Button | Expand All (tree) | TreeView expand all |
| 15 | Dialog (Confirm) | Confirm delete | ConfirmDialog |
| 16 | Pagination | Page navigation | DataPagination |

---

### 3.2 Category Add / Edit

**Route:** `/console/modules/product-catalog/category/add`  
**Source:** `src/modules/product-catalog/client/pages/category/CategoryAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (text) | Category Name | FormField `name="name"` |
| 2 | Select | Parent Category | FormField `name="parentId"` |
| 3 | Input (number) | Sort Order | FormField `name="sortOrder"` |
| 4 | Button | Save (submit) | `type="submit"` |
| 5 | Button | Cancel | `type="button"` |

---

### 3.3 Product List

**Route:** `/console/modules/product-catalog/product`  
**Source:** `src/modules/product-catalog/client/pages/product/Product.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Add Product | Button with Plus icon |
| 2 | Button | Import Products | Button with FileUp icon |
| 3 | Input | Search filter | DebouncedInput `placeholder="Search..."` |
| 4 | Button | Clear search (X icon) | `onClick={clearFilter}` |
| 5 | Button | Sort by SKU Code | SortButton `column="skuCode"` |
| 6 | Button | Sort by Name | SortButton `column="name"` |
| 7 | Button | Sort by Category | SortButton `column="categoryName"` |
| 8 | Button | Sort by UoM | SortButton `column="uom"` |
| 9 | Button | Sort by Selling Price | SortButton `column="sellingPrice"` |
| 10 | Button | Sort by Status | SortButton `column="status"` |
| 11 | Link | Product row → detail | `Link to="/console/modules/product-catalog/product/{id}"` |
| 12 | Button | Edit product (Pencil) | Per-row secondary |
| 13 | Button | Delete product (X) | Per-row destructive |
| 14 | Dialog (Confirm) | Confirm delete | ConfirmDialog |
| 15 | Pagination | Page navigation | DataPagination |

---

### 3.4 Product Add / Edit

**Route:** `/console/modules/product-catalog/product/add`  
**Source:** `src/modules/product-catalog/client/pages/product/ProductAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (text) | SKU Code | FormField `name="skuCode"` |
| 2 | Input (text) | Product Name | FormField `name="name"` |
| 3 | Textarea | Description | FormField `name="description"` |
| 4 | Select | Category | FormField `name="categoryId"` |
| 5 | Input (text) | Brand | FormField `name="brand"` |
| 6 | Input (text) | UoM | FormField `name="uom"` |
| 7 | Input (number) | Base Cost Price | FormField `name="baseCostPrice"` |
| 8 | Input (number) | Selling Price | FormField `name="sellingPrice"` |
| 9 | Switch | Tax Applicable | FormField `name="taxApplicable"` |
| 10 | Select | Status | FormField `name="status"` — options: draft, active, discontinued, archived |
| 11 | Button | Save (submit) | `type="submit"` |
| 12 | Button | Cancel | `type="button"` |

---

## 4. Approval Engine

### 4.1 Approval Config

**Route:** `/console/modules/approval-engine/config`  
**Source:** `src/modules/approval-engine/client/pages/config/ApprovalConfig.tsx`

Per transaction type row (purchase_order, supplier_return, transfer, stock_adjustment):

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Switch | Required toggle | Per-row `checked={config.required}` |
| 2 | Select | Approver Role | Per-row `onValueChange` |
| 3 | Input (number) | Threshold Amount | Per-row `placeholder="Optional"` |
| 4 | Input (number) | Timeout Hours | Per-row |
| 5 | Select | Timeout Action | Per-row — options: escalate, auto_approve |
| 6 | Button | Save Configuration | Per-row `size="sm"` with Save icon |

---

### 4.2 Audit Log

**Route:** `/console/modules/approval-engine/audit-log`  
**Source:** `src/modules/approval-engine/client/pages/audit/AuditLog.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (text) | Module filter | `placeholder="Filter by module"` |
| 2 | Select | Action filter | Options: all, create, update, delete |
| 3 | Input (text) | User filter | `placeholder="Filter by user"` |
| 4 | Input (text) | Date From | `placeholder="YYYY-MM-DD"` |
| 5 | Input (text) | Date To | `placeholder="YYYY-MM-DD"` |
| 6 | Input | Search filter | DebouncedInput `placeholder="Search..."` |
| 7 | Button | Clear search (X) | `onClick={clearFilter}` |
| 8 | Button | Sort by Timestamp | SortButton |
| 9 | Button | Sort by User | SortButton |
| 10 | Button | Sort by Module | SortButton |
| 11 | Button (Row) | Expand/Collapse row | Toggle ChevronRight/ChevronDown to show Before/After JSON |
| 12 | Pagination | Page navigation | DataPagination |

---

## 5. Supplier Management

### 5.1 Supplier List

**Route:** `/console/modules/supplier-management/supplier`  
**Source:** `src/modules/supplier-management/client/pages/supplier/Supplier.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Add Supplier | Button with Plus icon |
| 2 | Input | Search filter | DebouncedInput `placeholder="Search..."` |
| 3 | Button | Clear search (X) | `onClick={clearFilter}` |
| 4 | Button | Sort by Code | SortButton `column="code"` |
| 5 | Button | Sort by Name | SortButton `column="name"` |
| 6 | Button | Sort by NPWP | SortButton `column="npwp"` |
| 7 | Button | Sort by Payment Terms | SortButton `column="paymentTerms"` |
| 8 | Button | Sort by Status | SortButton `column="status"` |
| 9 | Link | Supplier code → detail | `Link to="{id}"` |
| 10 | Button | View supplier (Eye) | Per-row |
| 11 | Button | Edit supplier (Pencil) | Per-row |
| 12 | Button | Delete supplier (X) | Per-row destructive |
| 13 | Pagination | Page navigation | DataPagination |

---

### 5.2 Supplier Add

**Route:** `/console/modules/supplier-management/supplier/add`  
**Source:** `src/modules/supplier-management/client/pages/supplier/SupplierAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (text) | Code | FormField `name="code"` |
| 2 | Input (text) | Name | FormField `name="name"` |
| 3 | Input (text) | NPWP | FormField `name="npwp"` |
| 4 | Textarea | Address | FormField `name="address"` |
| 5 | Input (text) | Payment Terms | FormField `name="paymentTerms"` |
| 6 | Input (number) | Lead Time (Days) | FormField `name="leadTimeDays"` |
| 7 | Select | Status | FormField `name="status"` — options: active, inactive |
| 8 | Input (text) | Bank Name | FormField `name="bankDetails.bankName"` |
| 9 | Input (text) | Account Number | FormField `name="bankDetails.accountNumber"` |
| 10 | Input (text) | Account Holder | FormField `name="bankDetails.accountHolder"` |
| 11 | Button | Save (submit) | `type="submit"` |
| 12 | Button | Cancel | `type="button"` |

---

### 5.3 Supplier View

**Route:** `/console/modules/supplier-management/supplier/:id`  
**Source:** `src/modules/supplier-management/client/pages/supplier/SupplierView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Edit supplier | Pencil icon |
| 2 | Button | Delete supplier | X icon, opens confirm dialog |
| 3 | Dialog (Confirm) | Confirm delete supplier | ConfirmDialog |
| **Contacts Section** | | |
| 4 | Button | Add Contact | Plus icon |
| 5 | Button | Delete contact (per row) | Trash2 icon |
| 6 | Dialog (Confirm) | Confirm delete contact | ConfirmDialog |
| **Contact Dialog** | | |
| 7 | Input (text) | Contact Name | `value={contactName}` |
| 8 | Select | Contact Role | Options: sales, ar, logistics, general |
| 9 | Input (text) | Phone | `value={contactPhone}` |
| 10 | Input (email) | Email | `value={contactEmail}` |
| 11 | Switch | Primary Contact | `checked={contactIsPrimary}` |
| 12 | Button | Cancel (dialog) | Close dialog |
| 13 | Button | Add / Save (dialog) | `onClick={saveContact}` |
| **Linked Products Section** | | |
| 14 | Button | Link Product | Plus icon |
| 15 | Button | Delete product link (per row) | Trash2 icon |
| 16 | Dialog (Confirm) | Confirm unlink product | ConfirmDialog |
| **Link Product Dialog** | | |
| 17 | Select | Product | `value={linkProductId}` |
| 18 | Input (number) | Supplier Price | `value={linkSupplierPrice}` |
| 19 | Input (number) | Min Order Qty (MOQ) | `value={linkMinOrderQty}` |
| 20 | Input (text) | Supplier SKU | `value={linkSupplierSku}` |
| 21 | Button | Cancel (dialog) | Close dialog |
| 22 | Button | Link (dialog) | `onClick={saveLinkedProduct}` |

---

## 6. Purchase Order

### 6.1 Purchase Order List

**Route:** `/console/modules/purchase-order/po`  
**Source:** `src/modules/purchase-order/client/pages/po/PurchaseOrder.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Create PO | Plus icon, navigates to add |
| 2 | Select | Status Filter | Options: all, draft, pending_approval, approved, sent, partially_received, fully_received, closed, cancelled |
| 3 | Input | Search PO# or supplier | DebouncedInput `placeholder="Search PO# or supplier..."` |
| 4 | Button | Clear search (X) | `onClick={clearFilter}` |
| 5 | Button | Sort by PO Number | SortButton `column="poNumber"` |
| 6 | Button | Sort by Order Date | SortButton `column="orderDate"` |
| 7 | Button | Sort by Total Amount | SortButton `column="totalAmount"` |
| 8 | Button | Sort by Status | SortButton `column="status"` |
| 9 | Link | PO Number → detail | `Link to="{id}"` |
| 10 | Button | View PO (Eye) | Per-row |
| 11 | Button | Edit PO (Pencil) | Per-row, conditional (draft/approved only) |
| 12 | Pagination | Page navigation | DataPagination |

---

### 6.2 Purchase Order Add / Edit

**Route:** `/console/modules/purchase-order/po/add` (or `/:id/edit`)  
**Source:** `src/modules/purchase-order/client/pages/po/PurchaseOrderAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Supplier | FormField `name="supplierId"` |
| 2 | Select | Delivery Location | FormField `name="locationId"` |
| 3 | Input (date) | Order Date | FormField `name="orderDate"` |
| 4 | Input (date) | Expected Delivery Date | FormField `name="expectedDeliveryDate"` |
| 5 | Textarea | Notes | FormField `name="notes"` |
| 6 | Button | Add Item | Plus icon, disabled until supplier selected |
| **Per Line Item:** | | |
| 7 | Select | Product | `items.{index}.productId` |
| 8 | Input (number) | Quantity | `items.{index}.quantity` |
| 9 | Input (number) | Unit Price | `items.{index}.unitPrice` |
| 10 | Input (number) | Discount % | `items.{index}.discountPercent` |
| 11 | Input (text) | UOM | `items.{index}.uom` |
| 12 | Button | Remove item (Trash2) | Per-row |
| 13 | Button | Create PO (submit) | `type="submit"` |
| 14 | Button | Cancel | `type="button"` |

---

### 6.3 Purchase Order View

**Route:** `/console/modules/purchase-order/po/:id`  
**Source:** `src/modules/purchase-order/client/pages/po/PurchaseOrderView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Approve | Conditional (status=draft or pending_approval), Check icon |
| 2 | Button | Mark as Sent | Conditional (status=approved), Send icon |
| 3 | Button | Reject / Back to Draft | Conditional (status=pending_approval) |
| 4 | Button | Close PO | Conditional (status=fully_received) |
| 5 | Button | Edit | Conditional (draft/approved), Pencil icon |
| 6 | Button | Cancel PO | Conditional (draft/approved), X icon, opens dialog |
| 7 | Button | Download PDF | Download icon, always available |
| **Cancel Dialog:** | | |
| 8 | Textarea | Cancellation Reason | `value={cancelReason}` |
| 9 | Button | Cancel (dismiss dialog) | AlertDialogCancel |
| 10 | Button | Confirm Cancel | AlertDialogAction |
| **Amendment History:** | | |
| 11 | Button | Toggle amendments section | ChevronUp/ChevronDown |

---

## 7. Goods Received Note

### 7.1 GRN List

**Route:** `/console/modules/grn/grn`  
**Source:** `src/modules/grn/client/pages/grn/Grn.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Receive Goods | Plus icon, navigates to add |
| 2 | Select | Status Filter | Options: all, draft, quality_inspection, accepted, stock_updated |
| 3 | Input | Search GRN# or PO# | DebouncedInput `placeholder="Search GRN# or PO#..."` |
| 4 | Button | Clear search (X) | `onClick={clearFilter}` |
| 5 | Button | Sort by GRN Number | SortButton `column="grnNumber"` |
| 6 | Button | Sort by Received Date | SortButton `column="receivedDate"` |
| 7 | Button | Sort by Status | SortButton `column="status"` |
| 8 | Link | GRN Number → detail | `Link to="{id}"` |
| 9 | Button | View GRN (Eye) | Per-row |
| 10 | Pagination | Page navigation | DataPagination |

---

### 7.2 GRN Add (Receive Goods)

**Route:** `/console/modules/grn/grn/add`  
**Source:** `src/modules/grn/client/pages/grn/GrnAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Purchase Order | `value={selectedPoId}`, required |
| 2 | Select | Delivery Location | FormField `name="locationId"` |
| 3 | Input (date) | Received Date | FormField `name="receivedDate"` |
| 4 | Input (text) | Delivery Note Ref | FormField `name="deliveryNoteRef"` |
| 5 | Input (text) | Invoice Ref | FormField `name="invoiceRef"` |
| 6 | Textarea | Notes | FormField `name="notes"` |
| **Per Line Item (auto-populated from PO):** | | |
| 7 | Input (number) | Received Qty | `items.{index}.receivedQuantity` |
| 8 | Input (number, readonly) | Accepted Qty | `items.{index}.acceptedQuantity` — auto-calculated |
| 9 | Input (number) | Rejected Qty | `items.{index}.rejectedQuantity` |
| 10 | Select | Rejection Reason | `items.{index}.rejectionReasonCode` — conditional (rejected > 0) — options: defective, damaged, expired, wrong_item, short_quantity, other |
| 11 | Input (text) | Batch Number | `items.{index}.batchNumber` |
| 12 | Input (date) | Expiry Date | `items.{index}.expiryDate` |
| 13 | Button | Create GRN (submit) | `type="submit"`, disabled until items exist |
| 14 | Button | Cancel | `type="button"` |

---

### 7.3 GRN View

**Route:** `/console/modules/grn/grn/:id`  
**Source:** `src/modules/grn/client/pages/grn/GrnView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Send to QI | Conditional (status=draft), ClipboardCheck icon |
| 2 | Button | Accept / Skip QI | Conditional (status=draft), ShieldCheck icon |
| 3 | Button | Mark Accepted | Conditional (status=quality_inspection), opens QI dialog |
| 4 | Button | Back to Draft | Conditional (status=quality_inspection), RotateCcw icon |
| 5 | Button | Update Stock | Conditional (status=accepted), PackageCheck icon |
| 6 | Button | Download PDF | Download icon, always available |
| **QI Dialog:** | | |
| 7 | Button | Passed (toggle) | Default selected |
| 8 | Button | Rejected (toggle) | |
| 9 | Textarea | Quality Notes | `value={qualityNotes}` |
| 10 | Button | Cancel (dialog) | AlertDialogCancel |
| 11 | Button | Confirm QI | AlertDialogAction |

---

## 8. Supplier Returns & Credit Notes

### 8.1 Return List

**Route:** `/console/modules/supplier-return/return`  
**Source:** `src/modules/supplier-return/client/pages/supplier-return/SupplierReturn.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | New Return | Plus icon, navigates to add |
| 2 | Select | Status Filter | Options: all, requested, pending_approval, approved, dispatched, acknowledged, credit_note_received, closed, rejected |
| 3 | Input | Search return# or supplier | DebouncedInput `placeholder="Search return# or supplier..."` |
| 4 | Button | Clear search (X) | `onClick={clearFilter}` |
| 5 | Link | Return Number → detail | `Link to="{id}"` |
| 6 | Button | View return (Eye) | Per-row secondary |
| 7 | Pagination | Page navigation | DataPagination |

---

### 8.2 Return Create

**Route:** `/console/modules/supplier-return/return/add`  
**Source:** `src/modules/supplier-return/client/pages/supplier-return/SupplierReturnAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Goods Received Note (GRN) | `value={selectedGrnId}`, `onValueChange` |
| 2 | Input (date) | Return Date | Controlled by react-hook-form |
| 3 | Textarea | Notes | `placeholder="Reason for return..."` |
| **Per Line Item (auto-populated from returnable endpoint):** | | |
| 4 | Input (number) | Return Quantity | `name="items.{index}.returnQuantity"`, max=returnable |
| 5 | Select | Reason Code | Conditional (returnQty > 0) — options: defective, damaged, expired, excess, wrong_item |
| 6 | Input (text) | Reason Notes | Conditional (returnQty > 0) |
| 7 | Button | Create Return (submit) | `type="submit"`, disabled if no items |
| 8 | Button | Cancel | `type="button"` |

---

### 8.3 Return View

**Route:** `/console/modules/supplier-return/return/:id`  
**Source:** `src/modules/supplier-return/client/pages/supplier-return/SupplierReturnView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Submit for Approval | Conditional (status=requested) |
| 2 | Button | Approve (Skip) | Conditional (status=requested), outlined |
| 3 | Button | Reject | Conditional (status=requested or pending_approval), destructive, X icon |
| 4 | Button | Approve | Conditional (status=pending_approval) |
| 5 | Button | Mark Dispatched | Conditional (status=approved), Truck icon |
| 6 | Button | Mark Acknowledged | Conditional (status=dispatched), ThumbsUp icon |
| 7 | Button | Record Credit Note | Conditional (status=acknowledged or credit_note_received), CreditCard icon |
| 8 | Button | Close (No Credit) / Close Return | Conditional (status=acknowledged or credit_note_received), Lock icon |
| 9 | Button | Download PDF | Always available |
| **Reject Dialog:** | | |
| 10 | Textarea | Rejection Reason | `value={rejectionReason}`, required |
| 11 | Button | Cancel (dialog) | AlertDialogCancel |
| 12 | Button | Reject (dialog) | AlertDialogAction, destructive |
| **Credit Note Dialog:** | | |
| 13 | Input (text) | Credit Note Number | `value={creditNoteNumber}`, required |
| 14 | Input (number) | Amount (IDR) | `value={creditAmount}`, min=0, step=0.01 |
| 15 | Input (date) | Credit Date | `value={creditDate}` |
| 16 | Checkbox | Is Replacement | `id="isReplacement"` — "This is a replacement receipt" |
| 17 | Textarea | Credit Note Notes | `value={creditNotes}` |
| 18 | Button | Cancel (dialog) | AlertDialogCancel |
| 19 | Button | Record Credit Note (dialog) | AlertDialogAction |

---

### 8.4 Credit Note List

**Route:** `/console/modules/supplier-return/credit-note`  
**Source:** `src/modules/supplier-return/client/pages/supplier-return/CreditNoteList.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input | Search CN# or return# | DebouncedInput `placeholder="Search CN# or return#..."` |
| 2 | Button | Clear search (X) | `onClick={clearFilter}` |
| 3 | Link | Return Number → return detail | `Link to="/console/modules/supplier-return/return/{id}"` |
| 4 | Pagination | Page navigation | DataPagination |

---

## 9. Point of Sale (POS)

### 9.1 POS Sales Screen (Full-Screen)

**Route:** `/pos`  
**Source:** `src/modules/pos/client/pages/pos/PosScreen.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Select Location | Top bar, shows `selectedLocation.name` |
| 2 | Button | Open Shift | Shown when no shift open |
| 3 | Button | Drop Cash | Small button in shift area, DollarSign/down icon |
| 4 | Button | Close Shift | Small button in shift area |
| 5 | Button | Exit POS | Top right, LogOut icon, navigates to `/console/dashboard` |
| 6 | Tab Button | Products (mobile) | `onClick={() => setMobileView('products')}` — < 1024px |
| 7 | Tab Button | Cart (mobile) | `onClick={() => setMobileView('cart')}` — < 1024px |
| **Location Picker Dialog:** | | |
| 8 | Button (per location) | Select Location | Renders location name, `onClick={() => selectLocation(loc)}` |
| 9 | Button | Cancel (location picker) | Close dialog |

**Keyboard Shortcuts (non-visual, but actionable):**

| Key | Action |
|-----|--------|
| F1 | Pay with Cash |
| F2 | Pay with Card |
| F3 | Pay with QRIS |
| F4 | Pay with Transfer |
| F9 | Toggle grid/list view |
| Esc | Clear cart |

---

### 9.2 Product Grid

**Source:** `src/modules/pos/client/pages/pos/ProductGrid.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input | Search products/barcode | `data-testid="pos-search"`, `placeholder="Search products or scan barcode..."`, `ref={searchRef}`, autoFocus |
| 2 | Button | Toggle View (grid/list) | Icon button, List or Grid3X3 icon |
| 3 | Tab | All Categories | TabsTrigger `value="all"` |
| 4 | Tab (multiple) | Category Tab | TabsTrigger `value={cat.id}` per active category |
| 5 | Button (grid) | Product Tile | `data-testid="product-tile-{skuCode}"`, adds to cart |
| 6 | Button (list) | Product Row | Adds to cart |

---

### 9.3 Cart Panel

**Source:** `src/modules/pos/client/pages/pos/CartPanel.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Clear Cart | Ghost button, X icon, `onClick={clear}` |
| **Per Cart Item:** | | |
| 2 | Button | Remove item | Trash2 icon, `onClick={() => removeItem(item.id)}` |
| 3 | Button | Decrease qty (-) | Outline, Minus icon, 40px touch target |
| 4 | Input (number) | Quantity | `value={item.quantity}`, `min=1`, `className="w-16 text-center"` |
| 5 | Button | Increase qty (+) | Outline, Plus icon, 40px touch target |
| 6 | Button (Popover) | Item Discount (Tag icon) | Opens discount popover |
| **Item Discount Popover:** | | |
| 7 | Select | Discount Type | Options: "%" (percent), "Rp" (fixed) |
| 8 | Input (number) | Discount Value | `placeholder="0"` |
| 9 | Button | Apply | `onClick={handleApply}` |
| 10 | Button | Clear | Resets discount to null |
| **Transaction Discount:** | | |
| 11 | Button (Popover) | Transaction Discount | Percent icon, "Add Transaction Discount" |
| 12 | Select | Discount Type | Options: "%", "Rp" |
| 13 | Input (number) | Discount Value | `placeholder="0"` |
| 14 | Button | Apply | Transaction discount apply |
| 15 | Button | Clear | Transaction discount clear |
| **Footer Actions:** | | |
| 16 | Button | Hold | `data-testid="pos-hold-button"`, Pause icon, disabled if cart empty |
| 17 | Button | Pay | `data-testid="pos-pay-button"`, disabled if cart empty |

---

### 9.4 Checkout Dialog

**Source:** `src/modules/pos/client/pages/pos/CheckoutDialog.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Cash method | Payment method selector, toggles to default variant when selected |
| 2 | Button | Card method | Payment method selector |
| 3 | Button | QRIS method | Payment method selector |
| 4 | Button | Transfer method | Payment method selector |
| 5 | Input (number) | Payment Amount | `value={addAmount}`, autoFocus |
| 6 | Input (number) | Amount Tendered | Conditional (cash only) |
| 7 | Input (text) | Payment Reference | Conditional (non-cash only) |
| 8 | Button | Add Payment | Plus icon |
| 9 | Button (multiple) | Quick Amount | Rounded-up amount buttons (10k, 50k, 100k, etc.) |
| 10 | Button (multiple) | Pay Full ({method}) | One per payment method, pays remaining balance |
| 11 | Button (per payment) | Remove Payment | Trash2 icon per payment line |
| 12 | Textarea | Order Notes | `value={notes}` |
| 13 | Button | Cancel Checkout | AlertDialogCancel or cancel button |
| 14 | Button | Complete Sale | Primary, disabled until fully paid |
| **Success Screen:** | | |
| 15 | Button | Print Receipt | `onClick={handlePrintReceipt}` |
| 16 | Button | Download PDF | `onClick={handleDownloadReceipt}` |
| 17 | Button | New Sale | `data-testid="pos-new-sale"`, clears cart and closes |

---

### 9.5 Shift Dialog

**Source:** `src/modules/pos/client/pages/pos/ShiftDialog.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| **Open Shift mode:** | | |
| 1 | Input (number) | Opening Float | `value={openingFloat}`, autoFocus |
| 2 | Button | Cancel | Outline, `onClick={onClose}` |
| 3 | Button | Open Shift | Primary |
| **Close Shift mode:** | | |
| 4 | Input (number) | Actual Cash Count | `value={actualCash}`, autoFocus |
| 5 | Textarea | Variance Reason | Conditional (variance > 0.01) |
| 6 | Textarea | Shift Notes | Optional |
| 7 | Button | Cancel | Outline |
| 8 | Button | Close Shift | Primary, disabled if no actualCash |
| **Cash Drop mode:** | | |
| 9 | Input (number) | Cash Drop Amount | `value={dropAmount}`, autoFocus |
| 10 | Input (text) | Cash Drop Reason | `value={dropReason}` |
| 11 | Button | Cancel | Outline |
| 12 | Button | Record Drop | Primary |

---

### 9.6 Held Transactions

**Source:** `src/modules/pos/client/pages/pos/HeldTransactions.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button (Sheet) | Held Transactions badge | `data-testid="pos-held-badge"`, opens drawer, shows count |
| **Per Held Item in drawer:** | | |
| 2 | Button | Recall Transaction | Play icon, restores cart |
| 3 | Button | Release Transaction | Trash2 icon, destructive, deletes held |

---

### 9.7 Lock Screen

**Source:** `src/modules/pos/client/pages/pos/LockScreen.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input (password) | Password | `type="password"`, autoFocus, `autoComplete="current-password"` |
| 2 | Button | Unlock | `type="submit"`, disabled if empty password or loading |

---

### 9.8 Printer Status

**Source:** `src/modules/pos/client/pages/pos/PrinterStatus.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button (Popover) | Printer Status icon | Popover trigger, shows status color |
| 2 | Select | Paper Width | Options: mapped from PAPER_WIDTHS (58mm, 80mm) |
| 3 | Select | Connection Interface | Options: usb, serial |
| 4 | Button | Connect / Disconnect | Toggles based on status |
| 5 | Button | Test Print | Conditional (connected only), outline |

---

### 9.9 Sync Status

**Source:** `src/modules/pos/client/pages/pos/SyncStatus.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button (Popover) | Sync Status icon | `data-testid="pos-sync-status"`, shows online/offline |
| 2 | Button | Full Sync | Primary, disabled when offline/syncing |
| 3 | Button | Force Push | Conditional (pending > 0), Upload icon |

---

### 9.10 Transaction List

**Route:** `/console/modules/pos/transaction`  
**Source:** `src/modules/pos/client/pages/transactions/TransactionList.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Open POS Terminal | Navigates to `/pos` |
| 2 | Select | Status Filter | Options: all, completed, voided |
| 3 | Input | Search Transaction ID | DebouncedInput |
| 4 | Button | Clear search (X) | `onClick={clearFilter}` |
| 5 | Button | Sort by Transaction ID | SortButton |
| 6 | Button | Sort by Total | SortButton |
| 7 | Button | Sort by Status | SortButton |
| 8 | Button | Sort by Date | SortButton |
| 9 | Link | Transaction ID → detail | `Link to="{id}"` |
| 10 | Button | View Transaction (Eye) | Per-row |
| 11 | Pagination | Page navigation | DataPagination |

---

### 9.11 Transaction View

**Route:** `/console/modules/pos/transaction/:id`  
**Source:** `src/modules/pos/client/pages/transactions/TransactionView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Void Transaction | Conditional (status=completed, admin + pos.transaction.void) |
| 2 | Button | Reprint Receipt | `onClick={handleReprintReceipt}` |
| 3 | Button | Download PDF | `onClick={handleDownloadPdf}` |
| **Void Dialog:** | | |
| 4 | Textarea | Void Reason | `value={voidReason}`, required |
| 5 | Button | Cancel (dialog) | AlertDialogCancel |
| 6 | Button | Confirm Void (dialog) | AlertDialogAction |

---

### 9.12 Shift List

**Route:** `/console/modules/pos/shift`  
**Source:** `src/modules/pos/client/pages/shifts/ShiftList.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Status Filter | Options: all, open, closed |
| 2 | Button | View Shift (Eye) | Per-row |
| 3 | Pagination | Page navigation | DataPagination |

---

### 9.13 Shift View

**Route:** `/console/modules/pos/shift/:id`  
**Source:** `src/modules/pos/client/pages/shifts/ShiftView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| — | *(display-only page — no actionable elements)* | | |

---

## 10. Inter-Shop Transfers

### 10.1 Transfer List

**Route:** `/console/modules/transfer/transfer`  
**Source:** `src/modules/transfer/client/pages/transfer/Transfer.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | New Transfer | Plus icon, navigates to add |
| 2 | Select | Status Filter | Options: all, requested, pending_approval, approved, picking, dispatched, received, closed |
| 3 | Input | Search Transfer # | DebouncedInput |
| 4 | Button | Clear search (X) | `onClick={clearFilter}` |
| 5 | Button | Sort by Transfer # | SortButton `column="transferNumber"` |
| 6 | Button | Sort by Status | SortButton `column="status"` |
| 7 | Button | Sort by Date | SortButton `column="createdAt"` |
| 8 | Link | Transfer # → detail | `Link to="{id}"` |
| 9 | Button | View Transfer (Eye) | Per-row |
| 10 | Pagination | Page navigation | DataPagination |

---

### 10.2 Transfer Create

**Route:** `/console/modules/transfer/transfer/add`  
**Source:** `src/modules/transfer/client/pages/transfer/TransferAdd.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Source Location | Controller + Select `name="sourceLocationId"` |
| 2 | Select | Destination Location | Controller + Select `name="destLocationId"` |
| 3 | Textarea | Notes | Controller + Textarea `name="notes"` |
| 4 | Select | Add Product (to items) | Dropdown for product selection |
| **Per Line Item:** | | |
| 5 | Input (number) | Requested Qty | Controller + Input `name="items.{index}.requestedQty"` |
| 6 | Button | Remove item (Trash2) | Per-row |
| 7 | Button | Create Transfer (submit) | `type="submit"`, disabled if no items |
| 8 | Button | Cancel | `type="button"` |

---

### 10.3 Transfer View

**Route:** `/console/modules/transfer/transfer/:id`  
**Source:** `src/modules/transfer/client/pages/transfer/TransferView.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Submit for Approval | Conditional (status=requested) |
| 2 | Button | Approve (Skip) | Conditional (status=requested) |
| 3 | Button | Approve | Conditional (status=pending_approval) |
| 4 | Button | Start Picking | Conditional (status=approved) |
| 5 | Button | Dispatch | Conditional (status=picking) |
| 6 | Button | Receive | Conditional (status=dispatched) |
| 7 | Button | Close | Conditional (status=received) |
| 8 | Button | Download PDF | Always available |

---

## 11. Inventory Management

### 11.1 Stock Count List

**Route:** `/console/modules/inventory-management/stock-count`  
**Source:** `src/modules/inventory-management/client/pages/stock-count/StockCountList.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | New Count | Opens create dialog |
| 2 | Button | View Count (Eye) | Per-row |
| 3 | Pagination | Page navigation | DataPagination |
| **Create Dialog:** | | |
| 4 | Select | Location | `value={selectedLoc}` |
| 5 | Button | Cancel (dialog) | AlertDialogCancel |
| 6 | Button | Start Count (dialog) | AlertDialogAction |

---

### 11.2 Stock Count Session

**Route:** `/console/modules/inventory-management/stock-count/:id`  
**Source:** `src/modules/inventory-management/client/pages/stock-count/StockCountSession.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Save Counts | `onClick={handleSaveLines}`, hidden if finalized |
| 2 | Button | Finalize | `onClick={handleFinalize}`, hidden if finalized |
| **Per Line Item:** | | |
| 3 | Input (number) | Counted Qty | `value={countedValues[line.productId]}`, min=0, hidden if finalized |

---

### 11.3 Adjustment List

**Route:** `/console/modules/inventory-management/adjustment`  
**Source:** `src/modules/inventory-management/client/pages/adjustment/AdjustmentList.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | New Adjustment | Opens create dialog |
| 2 | Pagination | Page navigation | DataPagination |
| **Create Dialog:** | | |
| 3 | Select | Location | `value={formLoc}` |
| 4 | Select | Product | `value={formProd}` |
| 5 | Input (number) | Quantity (+ or -) | `value={formQty}`, `placeholder="e.g. -5 or +10"` |
| 6 | Select | Reason | Options: damage, theft, write_off, correction, other |
| 7 | Textarea | Notes | `value={formNotes}`, `placeholder="Details..."`, rows=2 |
| 8 | Button | Cancel (dialog) | AlertDialogCancel |
| 9 | Button | Record Adjustment (dialog) | AlertDialogAction |

---

### 11.4 Movement Ledger

**Route:** `/console/modules/inventory-management/movement`  
**Source:** `src/modules/inventory-management/client/pages/movement/MovementLedger.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Movement Type Filter | Options: all, sale, return, grn, transfer_out, transfer_in, adjustment, stock_count, opening_balance |
| 2 | Pagination | Page navigation | DataPagination |

---

### 11.5 Low-Stock Alerts

**Route:** `/console/modules/inventory-management/alerts`  
**Source:** `src/modules/inventory-management/client/pages/alerts/AlertConfig.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | Add Alert Rule | Opens create dialog |
| **Create Dialog:** | | |
| 2 | Select | Location | Required |
| 3 | Select | Product | Required |
| 4 | Input (number) | Min Qty | Default: 10, min=0 |
| 5 | Input (number) | Max Qty | Optional, `placeholder="Optional"` |
| 6 | Button | Cancel (dialog) | AlertDialogCancel |
| 7 | Button | Save Rule (dialog) | AlertDialogAction |

---

### 11.6 Consolidated Inventory

**Route:** `/console/modules/inventory-management/consolidated`  
**Source:** `src/modules/inventory-management/client/pages/consolidated/ConsolidatedInventory.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Input | Search product/SKU | DebouncedInput, 500ms debounce |
| 2 | Button | Clear search (X) | `onClick={() => setSearch('')}` |
| 3 | TableRow (clickable) | Drill-down to product detail | `onClick={() => openDrillDown(productId)}`, cursor-pointer |
| 4 | Pagination | Page navigation | DataPagination |
| **Drill-Down Dialog:** | | |
| 5 | Button | Close (dialog) | AlertDialogCancel |

---

### 11.7 Inventory Valuation

**Route:** `/console/modules/inventory-management/valuation`  
**Source:** `src/modules/inventory-management/client/pages/consolidated/ValuationSummary.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| — | *(display-only page — no actionable elements)* | | |

---

## 12. Reports & Analytics

### 12.1 Dashboard

**Route:** `/console/modules/report/dashboard`  
**Source:** `src/modules/report/client/pages/Dashboard.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Button | New Purchase Order | Quick action, navigates to `/console/modules/purchase-order/po/add` |
| 2 | Button | New Transfer | Quick action, navigates to `/console/modules/transfer/transfer/add` |
| 3 | Button | Stock Count | Quick action, navigates to `/console/modules/inventory-management/stock-count` |
| 4 | Button | Open POS | Quick action, navigates to `/pos` |

---

### 12.2 Revenue Report

**Route:** `/console/modules/report/revenue`  
**Source:** `src/modules/report/client/pages/RevenueReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Period Filter | Options: 7 (Last 7 days), 30 (Last 30 days), 90 (Last 90 days) |

---

### 12.3 Inventory Report

**Route:** `/console/modules/report/inventory`  
**Source:** `src/modules/report/client/pages/InventoryReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| — | *(display-only page — no actionable elements)* | | |

---

### 12.4 POS Report

**Route:** `/console/modules/report/pos`  
**Source:** `src/modules/report/client/pages/PosReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Period Filter | Options: 7 (Last 7 days), 30 (Last 30 days), 90 (Last 90 days) |

---

### 12.5 Tax (PPN) Report

**Route:** `/console/modules/report/tax`  
**Source:** `src/modules/report/client/pages/TaxReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| 1 | Select | Period Filter | Options: 7 (Last 7 days), 30 (Last 30 days), 90 (Last 90 days) |

---

### 12.6 Procurement Report

**Route:** `/console/modules/report/procurement`  
**Source:** `src/modules/report/client/pages/ProcurementReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| — | *(display-only page — no actionable elements)* | | |

---

### 12.7 Transfer Report

**Route:** `/console/modules/report/transfer`  
**Source:** `src/modules/report/client/pages/TransferReport.tsx`

| # | Element Type | Label / Purpose | Selector Strategy |
|---|---|---|---|
| — | *(display-only page — no actionable elements)* | | |

---

## Appendix: Element Summary

| Module | Pages | Total Actionable Elements |
|--------|-------|--------------------------|
| Location Management | 2 | 30 |
| Tax Configuration | 2 | 7 |
| Product Catalog | 4 | 43 |
| Approval Engine | 2 | 18 |
| Supplier Management | 3 | 35 |
| Purchase Order | 3 | 37 |
| Goods Received Note | 3 | 25 |
| Supplier Returns & Credit Notes | 4 | 30 |
| Point of Sale (POS) | 13 | 105 |
| Inter-Shop Transfers | 3 | 26 |
| Inventory Management | 7 | 30 |
| Reports & Analytics | 7 | 7 |
| **Total** | **53 pages** | **~393 elements** |

---

## Appendix: Common Shared Components

These reusable components appear across many pages:

| Component | Element Type | Usage Pattern |
|-----------|-------------|---------------|
| `DebouncedInput` | Input (text) | Search filter with 500ms debounce on all list pages |
| `SortButton` | Button | Column header sort toggle, accepts `column` and `sortBy` props |
| `DataPagination` | Pagination | Page navigation with `page`, `perPage`, `count`, `gotoPage` |
| `ConfirmDialog` | Dialog | Destructive action confirmation with `onConfirm` callback |
| `AlertDialog` | Dialog | Multi-field dialogs (create adjustment, credit note, etc.) |
| `Select` (shadcn) | Select | Dropdown with `SelectTrigger`, `SelectContent`, `SelectItem` |
| `Switch` (shadcn) | Toggle | Boolean switches, `checked` + `onCheckedChange` |
| `Popover` (shadcn) | Popover | Flyout panels (item discount, transaction discount, printer, sync) |
| `Sheet` (shadcn) | Drawer | Slide-in panels (held transactions) |
| `Tabs` (shadcn) | Tabs | Tab navigation (category tabs in POS) |
| `Calendar` (shadcn) | Calendar | Date picker within Popover |
| `FormField` | Wrapper | react-hook-form field wrapper, uses `name` prop for targeting |

---

*End of POM Report*
