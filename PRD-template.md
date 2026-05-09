# Multi-Shop Retail Management System — Product Requirements Document (PRD)

**Version:** 3.0  
**Last Updated:** 2026-04-07  
**Status:** Draft  
**Author:** System Architecture Team  

---

## Table of Contents

1. [Document Overview](#1-document-overview)
2. [Module Reference](#2-module-reference)
   - 2.1 [Location Management](#21-location-management)
   - 2.2 [Tax Configuration](#22-tax-configuration)
   - 2.3 [Product Catalog](#23-product-catalog)
   - 2.4 [Approval Engine](#24-approval-engine)
   - 2.5 [Supplier Management](#25-supplier-management)
   - 2.6 [Purchase Order](#26-purchase-order)
   - 2.7 [Goods Received Note (GRN)](#27-goods-received-note-grn)
   - 2.8 [Supplier Returns & Credit Notes](#28-supplier-returns--credit-notes)
   - 2.9 [Point of Sale (POS)](#29-point-of-sale-pos)
   - 2.10 [Inter-Shop Transfers](#210-inter-shop-transfers)
   - 2.11 [Inventory Management](#211-inventory-management)
   - 2.12 [Reports & Analytics](#212-reports--analytics)
3. [Cross-Cutting Concerns](#3-cross-cutting-concerns)
4. [Appendix: Entity Reference](#4-appendix-entity-reference)

---

## 1. Document Overview

### 1.1 Purpose
This PRD documents all functional requirements, validation rules, conditional logic, and entity/table references for the Multi-Shop Retail Management System. Each screen is documented with:
- **Screenshot** (captured from the live application)
- **Functional requirements** (what the screen does)
- **Field specifications** (each input/display field with type, source entity, validation)
- **Validation requirements** (client-side and server-side rules)
- **Conditional requirements** (field visibility, button state, workflow logic)
- **Entity/table references** (which DB tables and columns are read/written)
- **API endpoints** (server routes used by the screen)

### 1.2 Module Summary

| # | Module | Screens | Description |
|---|--------|---------|-------------|
| 1 | Location Management | 2 | Shop/warehouse/DC location registry |
| 2 | Tax Configuration | 2 | Indonesian PPN tax rates and calc mode |
| 3 | Product Catalog | 4 | Products, categories, variants, barcodes, pricing |
| 4 | Approval Engine | 4 | Configurable approval workflows |
| 5 | Supplier Management | 3 | Supplier master data and catalog mapping |
| 6 | Purchase Order | 4 | PO lifecycle with approval integration |
| 7 | Goods Received Note | 3 | Receive goods against POs with QI |
| 8 | Supplier Returns | 4 | Return lifecycle with credit notes |
| 9 | Point of Sale | 8 | Full-screen POS with shift/hold/print |
| 10 | Inter-Shop Transfers | 3 | Transfer inventory between locations |
| 11 | Inventory Management | 6 | Stock counts, adjustments, movement ledger, alerts |
| 12 | Reports & Analytics | 7 | Dashboard, revenue, inventory, POS, tax, procurement, transfer reports |

---

## 2. Module Reference

---

### 2.1 Location Management

**Module ID:** `location-management`  
**Permissions:** `retail.location.view`, `retail.location.create`, `retail.location.edit`, `retail.location.delete`  
**API Base:** `/api/modules/location-management/location`

#### 2.1.1 Location List

**Route:** `/console/modules/location-management/location`  
**Screenshot:**  
![Location List](screenshots/location-list.png)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-LOC-001 | Display paginated list of all locations |
| FR-LOC-002 | Support search by location name or code |
| FR-LOC-003 | Support sorting by name, code, type, status |
| FR-LOC-004 | "Add Location" button visible to users with `retail.location.create` permission |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| Code | Display (text) | `locations` | `code` | Unique identifier |
| Name | Display (text) | `locations` | `name` | Location display name |
| Type | Display (badge) | `locations` | `type` | Enum: shop, warehouse, distribution_center |
| Status | Display (badge) | `locations` | `status` | Enum: active, inactive |
| Address | Display (text) | `locations` | `address` | Optional |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-LOC-001 | Page number must be >= 1 | Client |
| VR-LOC-002 | Search debounced 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-LOC-001 | User has `retail.location.create` permission | Show "Add Location" button |
| CR-LOC-002 | No locations found | Show "No locations found" empty state |
| CR-LOC-003 | Loading state | Show loading dialog |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/location-management/location` | List locations with pagination/filter/sort |

---

#### 2.1.2 Location Add/Edit

**Route:** `/console/modules/location-management/location/add`  
**Screenshot:**  
![Location Add](screenshots/location-add.png)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-LOC-010 | Form to create a new location |
| FR-LOC-011 | Code field: uppercase alphanumeric with hyphens |
| FR-LOC-012 | Type selector: shop, warehouse, distribution_center |
| FR-LOC-013 | Optional fields: address, city, province, phone, timezone |
| FR-LOC-014 | Sync config: frequency, windows, bandwidth mode |

**Field Specifications:**
| Field | Type | Source Entity | Column | Validation |
|-------|------|--------------|--------|------------|
| Code | Input (text) | `locations` | `code` | Required, unique, max 50 chars, uppercase pattern |
| Name | Input (text) | `locations` | `name` | Required, max 255 chars |
| Type | Select | `locations` | `type` | Required, enum: shop/warehouse/distribution_center |
| Parent | Select | `locations` | `parent_id` | Optional, references `locations.id` |
| Address | Textarea | `locations` | `address` | Optional |
| City | Input (text) | `locations` | `city` | Optional, max 100 chars |
| Province | Input (text) | `locations` | `province` | Optional, max 100 chars |
| Phone | Input (text) | `locations` | `phone` | Optional, max 30 chars |
| Timezone | Select | `locations` | `timezone` | Default: Asia/Jakarta |
| Status | Select | `locations` | `status` | Default: active |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-LOC-010 | Code is required and unique | Server |
| VR-LOC-011 | Name is required | Client + Server |
| VR-LOC-012 | Type must be valid enum value | Client + Server |
| VR-LOC-013 | Code format: `^[A-Z0-9_-]+$` | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-LOC-010 | Form submitted successfully | Redirect to list with success toast |
| CR-LOC-011 | Server returns validation error | Display error message below field |
| CR-LOC-012 | Cancel button clicked | Navigate back to list |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/location-management/location` | Create location |
| PUT | `/api/modules/location-management/location/:id` | Update location |

---

> **[TEMPLATE NOTE — POS EXAMPLE]**  
> Below shows how the complex POS module would be documented:

---

### 2.9 Point of Sale (POS)

**Module ID:** `pos`  
**Permissions:** `pos.sale.create`, `pos.transaction.view`, `pos.transaction.void`, `pos.inventory.view`, `pos.inventory.adjust`  
**API Base:** `/api/modules/pos/transaction`

#### 2.9.1 POS Sales Screen (Full-Screen)

**Route:** `/pos`  
**Layout:** Full-screen (no sidebar) — separate layout from ConsoleLayout  
**Screenshot:**  
![POS Screen](screenshots/pos-screen.png)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-POS-001 | Full-screen POS interface with product grid (left) and cart (right) |
| FR-POS-002 | Top bar: location name, cashier name, shift status, held count, printer status, sync status, clock, exit |
| FR-POS-003 | Product grid: searchable, category-filterable, grid/list toggle |
| FR-POS-004 | Cart: add items, adjust quantity, per-item discount, transaction discount |
| FR-POS-005 | Barcode scanner: HID keyboard wedge detection (< 100ms gap + Enter) |
| FR-POS-006 | Keyboard shortcuts: F1-F4 payments, F9 toggle view, Esc clear |
| FR-POS-007 | Requires open shift — blocked if no shift open |
| FR-POS-008 | Hold/recall: park cart, recall later |
| FR-POS-009 | Session timeout: 5-minute idle locks screen, password to unlock |
| FR-POS-010 | Responsive: tab toggle (Products/Cart) below 1024px |

**Field Specifications — Product Grid:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| Search | Input (text) | — | — | Queries `products.name` and `products.sku_code` via ILIKE |
| Category Tabs | Tab buttons | `categories` | `id`, `name` | Level-1 categories, status=active |
| Product Tile: Name | Display | `products` | `name` | |
| Product Tile: Price | Display | `products` | `selling_price` | Overridden by `product_location_prices.selling_price` if exists |
| Product Tile: Image | Display | `product_images` | `image_url` | Primary image (is_primary=true) |
| Product Tile: Stock | Display | `inventory` | `qty_on_hand` | Per-location, shows "Out of stock" if <= 0 |

**Field Specifications — Cart Panel:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| Item Name | Display | Cart state | — | From product when added |
| Item SKU | Display | Cart state | — | |
| Quantity | Input (number) | Cart state | — | Min 1, +/- buttons (40px touch target) |
| Unit Price | Display | Cart state | — | |
| Item Discount | Popover (% or fixed) | Cart state | — | Applied per item |
| Line Total | Computed | — | — | qty * unitPrice - discount |
| Subtotal | Computed | — | — | Sum of line totals before tax |
| Tax (PPN) | Computed | `tax_configs` | `rate_percent`, `calc_mode` | Per-item based on `taxApplicable` flag |
| Total | Computed | — | — | Subtotal - transaction discount + tax |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-POS-001 | Cannot checkout with empty cart | Client |
| VR-POS-002 | Cannot checkout without open shift | Server (400) |
| VR-POS-003 | Payment total must >= grand total | Server (400) |
| VR-POS-004 | Cash: amount tendered must >= cash payment amount | Client |
| VR-POS-005 | At least one payment method required | Server (400) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-POS-001 | No shift open | Show "Open Shift" dialog (blocking) |
| CR-POS-002 | Cart empty | Pay and Hold buttons disabled |
| CR-POS-003 | Screen width < 1024px | Show Products/Cart tab toggle |
| CR-POS-004 | Screen width >= 1024px | Show side-by-side layout |
| CR-POS-005 | Printer connected | Auto-print receipt on checkout |
| CR-POS-006 | Idle > 5 minutes | Show lock screen overlay |
| CR-POS-007 | Product has `taxApplicable = false` | Skip tax calculation for that item |

**Entity/Table References:**
| Table | Usage |
|-------|-------|
| `products` | Product search and display |
| `categories` | Category tab filter |
| `product_location_prices` | Location-specific pricing override |
| `product_images` | Primary product image |
| `inventory` | Stock quantity display |
| `tax_configs` | Active tax rate and calc mode |
| `pos_transactions` | Created on checkout |
| `pos_transaction_items` | Line items on checkout |
| `pos_transaction_payments` | Payment records on checkout |
| `pos_shifts` | Shift validation |
| `pos_held_transactions` | Hold/recall |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/transaction/products` | Search products for POS grid |
| GET | `/api/modules/pos/transaction/categories` | Get active categories |
| POST | `/api/modules/pos/transaction/checkout` | Complete sale |
| POST | `/api/modules/pos/transaction/hold` | Hold current cart |
| GET | `/api/modules/pos/transaction/held` | List held transactions |
| POST | `/api/modules/pos/transaction/held/:id/recall` | Recall held cart |
| GET | `/api/modules/pos/shift/current` | Get current open shift |

---

## 3. Cross-Cutting Concerns

### 3.1 Error Handling
| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (Zod) or business rule violation |
| 401 | Not authenticated |
| 403 | Not authorized (permission denied) |
| 404 | Resource not found |
| 500 | Internal server error |

### 3.2 Pagination
All list endpoints support:
- `page` (default: 1)
- `perPage` (default: 10)
- `sort` (column name)
- `order` (asc/desc)
- `filter` (search term)

---

## 4. Appendix: Entity Reference

### 4.1 Tenant Schema Tables (tenant_{code})

| Table | Module | Purpose |
|-------|--------|---------|
| `locations` | Location Management | Shop/warehouse/DC locations |
| `user_locations` | Location Management | User-location assignments |
| `tax_configs` | Tax Configuration | PPN tax rates and calc mode |
| `categories` | Product Catalog | Hierarchical product categories |
| `products` | Product Catalog | Product master data |
| `product_variants` | Product Catalog | Product size/color variants |
| `barcodes` | Product Catalog | EAN-13/UPC-A/internal barcodes |
| `product_location_prices` | Product Catalog | Location-specific pricing |
| `product_images` | Product Catalog | Product images |
| `uom_conversions` | Product Catalog | Unit of measure conversions |
| `approval_configs` | Approval Engine | Approval workflow configuration |
| `approval_logs` | Approval Engine | Approval history |
| `audit_logs` | Approval Engine | System audit trail |
| `suppliers` | Supplier Management | Supplier master data |
| `supplier_contacts` | Supplier Management | Supplier contact persons |
| `supplier_products` | Supplier Management | Supplier-product catalog mapping |
| `po_sequences` | Purchase Order | PO number generation |
| `purchase_orders` | Purchase Order | Purchase order headers |
| `purchase_order_items` | Purchase Order | PO line items |
| `purchase_order_amendments` | Purchase Order | PO version history |
| `grn_sequences` | GRN | GRN number generation |
| `goods_received_notes` | GRN | Goods received headers |
| `grn_items` | GRN | GRN line items |
| `sr_sequences` | Supplier Returns | Return number generation |
| `supplier_returns` | Supplier Returns | Return headers |
| `supplier_return_items` | Supplier Returns | Return line items |
| `credit_notes` | Supplier Returns | Credit notes linked to returns |
| `inventory` | POS / Inventory | Stock on hand + in transit |
| `pos_sequences` | POS | Transaction ID generation |
| `pos_transactions` | POS | Sale transaction headers |
| `pos_transaction_items` | POS | Sale line items |
| `pos_transaction_payments` | POS | Split payment records |
| `pos_shifts` | POS | Shift open/close |
| `pos_cash_drops` | POS | Mid-shift cash drops |
| `pos_held_transactions` | POS | Held/parked carts |
| `transfer_sequences` | Transfers | Transfer number generation |
| `transfers` | Transfers | Transfer headers |
| `transfer_items` | Transfers | Transfer line items |
| `stock_counts` | Inventory Mgmt | Stock count sessions |
| `stock_count_lines` | Inventory Mgmt | Count lines (system vs counted) |
| `stock_adjustments` | Inventory Mgmt | Manual stock adjustments |
| `inventory_movements` | Inventory Mgmt | Movement ledger |
| `stock_alert_configs` | Inventory Mgmt | Low-stock alert thresholds |
| `sync_logs` | Sync | Sync operation history |

---

> **[TEMPLATE REVIEW NOTES]**
>
> This template shows the **complete format** applied to:
> - Location Management (2 screens fully documented)
> - POS Sales Screen (1 screen fully documented as complex example)
>
> The full PRD will follow this exact pattern for ALL ~50 screens across ALL 12 modules.
>
> **What the full document will contain:**
> - ~50 screen documentation blocks (each with screenshot, FR, field specs, VR, CR, entity refs, API endpoints)
> - Live screenshots captured from the running application
> - Complete entity reference with all 40+ tables
>
> **Please review and confirm:**
> 1. Is the format and detail level what you need?
> 2. Should I add/remove any sections?
> 3. Any specific formatting preferences?
> 4. Should screenshots be embedded or linked?
