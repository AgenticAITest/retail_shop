# Multi-Shop Retail Management System — Product Requirements Document (PRD)

**Version:** 3.0  
**Last Updated:** 2026-04-07  
**Status:** Complete  
**Platform:** PERN Stack (PostgreSQL, Express, React 19, Node.js) with Drizzle ORM  

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
This PRD documents all functional requirements, validation rules, conditional logic, and entity/table references for each screen of the Multi-Shop Retail Management System.

Each screen includes:
- **Source file** reference (TSX component path)
- **Functional requirements** table
- **Field specifications** with source entity/column
- **Validation requirements** (client + server)
- **Conditional requirements** (visibility, state, workflow)
- **API endpoints** used

### 1.2 Module Summary

| # | Module ID | Module Name | Screens | Source Path |
|---|-----------|-------------|---------|------------|
| 1 | `location-management` | Location Management | 4 | `src/modules/location-management/` |
| 2 | `tax-configuration` | Tax Configuration | 2 | `src/modules/tax-configuration/` |
| 3 | `product-catalog` | Product Catalog | 7 | `src/modules/product-catalog/` |
| 4 | `approval-engine` | Approval Engine | 4 | `src/modules/approval-engine/` |
| 5 | `supplier-management` | Supplier Management | 5 | `src/modules/supplier-management/` |
| 6 | `purchase-order` | Purchase Order | 4 | `src/modules/purchase-order/` |
| 7 | `grn` | Goods Received Note | 3 | `src/modules/grn/` |
| 8 | `supplier-return` | Supplier Returns & Credit Notes | 4 | `src/modules/supplier-return/` |
| 9 | `pos` | Point of Sale | 13 | `src/modules/pos/` |
| 10 | `transfer` | Inter-Shop Transfers | 3 | `src/modules/transfer/` |
| 11 | `inventory-management` | Inventory Management | 7 | `src/modules/inventory-management/` |
| 12 | `report` | Reports & Analytics | 7 | `src/modules/report/` |

---

## 2. Module Reference

---

### 2.1 Location Management

**Module ID:** `location-management`  
**Permissions:** `retail.location.view`, `retail.location.create`, `retail.location.edit`, `retail.location.delete`  
**API Base:** `/api/modules/location-management/location`

#### 2.1.1 Location List

**Route:** `/console/modules/location-management/location`  
**Source:** [Location.tsx](src/modules/location-management/client/pages/location/Location.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-001 | The system shall display a paginated table of all locations in the current tenant |
| FR-002 | The system shall allow searching locations by name or code using case-insensitive partial matching (ILIKE) |
| FR-003 | The search input shall be debounced at 500ms to reduce API calls while the user types |
| FR-004 | The system shall support sorting by code, name, type, city, and status columns, with ascending as the default order |
| FR-005 | Clicking a sort column that is already the active sort shall toggle between ascending and descending |
| FR-006 | The Code column shall be rendered as a clickable link that navigates to the location view page |
| FR-007 | The Type column shall display human-readable labels: "Shop", "Warehouse", "Distribution Center" |
| FR-008 | The City column shall display "-" when the city value is null |
| FR-009 | The Status column shall display a color-coded badge: green for active, red for inactive |
| FR-010 | Each row shall display Edit (pencil icon) and Delete (X icon) action buttons |
| FR-011 | The Delete action shall perform a soft delete by setting the location status to inactive (not a hard delete) |
| FR-012 | The Delete action shall show a confirmation dialog with the message "This action cannot be undone. This will set the location status to inactive." before proceeding |
| FR-013 | After successful deletion, the system shall display a success toast and reload the list |
| FR-014 | The list shall preserve pagination, sort, order, and filter state in URL query parameters |
| FR-015 | A loading overlay dialog shall be shown while data is being fetched |
| FR-016 | The default sort shall be by name ascending, page 1, 10 items per page |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-001 | Page number must be >= 1 | Client |
| VR-002 | Page number must not exceed total pages (count / perPage) | Client |
| VR-003 | Search input shall be debounced at 500ms before triggering an API call | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-001 | User has ADMIN role AND `retail.location.create` permission | Show "Add Location" button |
| CR-002 | User does not have `retail.location.create` permission | Hide "Add Location" button |
| CR-003 | API returns empty locations array | Table body shows no rows (empty state) |
| CR-004 | Data is being fetched (loading=true) | Show full-screen AlertDialog with spinner and "Please wait..." |
| CR-005 | Filter text is not empty | Show X (clear) icon in search input |
| CR-006 | Filter text is empty | Show magnifying glass icon in search input |
| CR-007 | Delete confirmation dialog confirmed | Call DELETE API, show success toast, reload list |
| CR-008 | Delete API call fails | Show error toast "Failed to delete location" |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| # | Computed | — | — | Row number: (page-1)*perPage + index + 1 |
| Code | Display (link) | `locations` | `code` | Links to `/console/modules/location-management/location/{id}` |
| Name | Display | `locations` | `name` | |
| Type | Display (label) | `locations` | `type` | Mapped via typeLabels: shop→"Shop", warehouse→"Warehouse", distribution_center→"Distribution Center" |
| City | Display | `locations` | `city` | Shows "-" if null |
| Status | Badge | `locations` | `status` | Green badge="Active", Red badge="Inactive" |

**API Endpoints:**
| Method | Path | Query Params | Purpose |
|--------|------|-------------|---------|
| GET | `/api/modules/location-management/location` | page, perPage, sort, order, filter | List with pagination/filter/sort |
| DELETE | `/api/modules/location-management/location/:id` | — | Soft-delete (status→inactive) |

---

#### 2.1.2 Location Add

**Route:** `/console/modules/location-management/location/add`  
**Source:** [LocationAdd.tsx](src/modules/location-management/client/pages/location/LocationAdd.tsx), [LocationForm.tsx](src/modules/location-management/client/pages/location/LocationForm.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-017 | The system shall provide a form to create a new location with code, name, type, and optional fields |
| FR-018 | The Code field shall be validated for uniqueness against existing locations via an async server call on form submission |
| FR-019 | The uniqueness check shall exclude the current location's own ID when editing (to allow saving without changing the code) |
| FR-020 | The Parent Location dropdown shall list all existing locations except the current location being edited (to prevent self-referencing) |
| FR-021 | The Parent Location dropdown shall display locations in format "{code} - {name}" and include a "None" option |
| FR-022 | The Sync Configuration section shall only be visible when the Type field is set to "shop" |
| FR-023 | When Type is changed away from "shop", the sync config section shall hide but values are preserved in form state |
| FR-024 | The Sync Windows field shall accept a comma-separated string of HH:MM values and convert them to an array on change |
| FR-025 | The form shall display breadcrumb navigation: list page link > "Add Location" |
| FR-026 | On successful form submission, the system shall redirect to the location list page and show a success toast |
| FR-027 | On failed submission, the system shall display the server error message below the relevant field |
| FR-028 | Empty string values for optional fields shall be converted to null before sending to the API |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-004 | Code is required (min 1 character) | Client (Zod) |
| VR-005 | Code must be unique across all locations in the tenant | Client (async) + Server |
| VR-006 | Name is required (min 1 character) | Client (Zod) |
| VR-007 | Type is required and must be one of: shop, warehouse, distribution_center | Client (Zod enum) |
| VR-008 | Parent ID, if provided, must be a valid UUID | Client (Zod) |
| VR-009 | Timezone defaults to "Asia/Jakarta" if not specified | Client (Zod default) |
| VR-010 | Status defaults to "active" if not specified | Client (Zod default) |
| VR-011 | Sync config frequency must be one of: once_daily, twice_daily, custom | Client (Zod enum, only when type=shop) |
| VR-012 | Sync config bandwidth mode must be one of: full, compressed | Client (Zod enum) |
| VR-013 | Server validates code uniqueness: checks `locations` table where `code = input AND id != current id` | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-009 | Type field value = "shop" | Show "Sync Configuration" section with frequency, windows, bandwidth, manual sync, auto reconnect fields |
| CR-010 | Type field value != "shop" (warehouse or distribution_center) | Hide entire "Sync Configuration" section |
| CR-011 | Form is in readonly mode (view page) | All input fields disabled; Show Edit + Delete buttons instead of Save + Cancel |
| CR-012 | Form is in edit mode | All input fields enabled; Show Save + Cancel buttons |
| CR-013 | Form submission succeeds (200/201) | Navigate to list, show success toast |
| CR-014 | Server returns validation error (400) | Display error message from Zod below the relevant field via FormMessage |
| CR-015 | Cancel button clicked | Navigate back to location list without saving |
| CR-016 | Async code validation fails | Display "Code must be unique" below the Code field |

**Field Specifications:**
| Field | Type | Source Entity | Column | Required | Default | Validation |
|-------|------|--------------|--------|----------|---------|------------|
| Code | Input (text) | `locations` | `code` | Yes | "" | min 1, unique async |
| Name | Input (text) | `locations` | `name` | Yes | "" | min 1 |
| Type | Select | `locations` | `type` | Yes | — | Enum: shop, warehouse, distribution_center |
| Parent Location | Select | `locations` | `parent_id` | No | null | UUID or null, excludes self |
| Address | Textarea | `locations` | `address` | No | "" | Nullable |
| City | Input (text) | `locations` | `city` | No | "" | Nullable |
| Province | Input (text) | `locations` | `province` | No | "" | Nullable |
| Phone | Input (text) | `locations` | `phone` | No | "" | Nullable |
| Timezone | Input (text) | `locations` | `timezone` | No | "Asia/Jakarta" | |
| Status | Select | `locations` | `status` | No | "active" | Enum: active, inactive |
| Sync Frequency | Select | `locations` | `sync_config→frequency` | No | "once_daily" | Only if type=shop |
| Sync Windows | Input (csv) | `locations` | `sync_config→windows` | No | ["06:00"] | Comma-separated HH:MM |
| Bandwidth Mode | Select | `locations` | `sync_config→bandwidthMode` | No | "full" | Enum: full, compressed |
| Manual Sync | Toggle (switch) | `locations` | `sync_config→manualSyncEnabled` | No | false | Boolean |
| Auto Reconnect | Toggle (switch) | `locations` | `sync_config→autoSyncOnReconnect` | No | true | Boolean |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/location-management/location` | Create location |
| POST | `/api/modules/location-management/location/validate-code` | Async code uniqueness check (body: {id?, code}) |

---

#### 2.1.3 Location View

**Route:** `/console/modules/location-management/location/:id`  
**Source:** [LocationView.tsx](src/modules/location-management/client/pages/location/LocationView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-029 | The system shall display all location fields in read-only mode (all inputs disabled) |
| FR-030 | The system shall show Edit and Delete buttons at the bottom of the form |
| FR-031 | Edit button shall navigate to the edit page for this location |
| FR-032 | Delete button shall trigger the same confirmation dialog and soft-delete behavior as the list page |
| FR-033 | Breadcrumb navigation: list page > location code |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-017 | View mode | All form fields have `disabled={true}` attribute |
| CR-018 | Type = "shop" | Sync config section shown in read-only |
| CR-019 | Type != "shop" | Sync config section hidden |

---

#### 2.1.4 Location Edit

**Route:** `/console/modules/location-management/location/:id/edit`  
**Source:** [LocationEdit.tsx](src/modules/location-management/client/pages/location/LocationEdit.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-034 | The system shall display the same form as Add, pre-populated with the existing location data |
| FR-035 | The system shall use PUT method to update the location |
| FR-036 | Code uniqueness validation shall exclude the current location ID (allows saving without code change) |
| FR-037 | On success, redirect to the location view page with a success toast |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-014 | Same validation rules as Add (VR-004 through VR-013) apply | Client + Server |
| VR-015 | Code uniqueness check includes the current ID to exclude self: `WHERE code = :code AND id != :currentId` | Server |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/location-management/location/:id` | Load existing location data |
| PUT | `/api/modules/location-management/location/:id` | Update location |

---

### 2.2 Tax Configuration

**Module ID:** `tax-configuration`  
**Permissions:** `retail.tax.view`, `retail.tax.edit`  
**API Base:** `/api/modules/tax-configuration/config`

#### 2.2.1 Tax Config Overview

**Route:** `/console/modules/tax-configuration/config`  
**Source:** [TaxConfig.tsx](src/modules/tax-configuration/client/pages/config/TaxConfig.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-038 | The system shall fetch both the active tax config and all tax configs in parallel on page load |
| FR-039 | The system shall display the current active PPN rate prominently in large bold text (3xl) with "%" suffix |
| FR-040 | The system shall display the calculation mode (inclusive/exclusive) capitalized next to the rate |
| FR-041 | The system shall display the effective date of the active config formatted using date-fns 'PPP' format (e.g., "April 7th, 2026") |
| FR-042 | The system shall display a "Tax Rate History" section showing all historical tax configs in a table, ordered by effective date descending |
| FR-043 | The historical table shall only be rendered if there is at least one config with status='historical' |
| FR-044 | The historical table shall show row number, rate (%), calculation mode (capitalized), effective date (PPP format), and status |
| FR-045 | The "Update Tax Rate" button shall navigate to the tax config add page |
| FR-046 | While data is loading, the system shall show a centered spinner with "Loading tax configuration..." text |
| FR-047 | The active config card and the history table are fetched from two separate API endpoints concurrently (Promise.all) |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-016 | No client-side validation on this page (read-only display) | — |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-020 | Active config API returns data | Display the active rate card with rate, calc mode, and effective date |
| CR-021 | Active config API returns 404 or null | Display message: "No active tax configuration found. Create one to get started." |
| CR-022 | User has ADMIN role AND `retail.tax.edit` permission | Show "Update Tax Rate" button below the active config card |
| CR-023 | User does not have `retail.tax.edit` permission | Hide "Update Tax Rate" button |
| CR-024 | historicalConfigs array is empty (no configs with status='historical') | Hide the "Tax Rate History" section entirely |
| CR-025 | historicalConfigs array has 1+ items | Show the "Tax Rate History" table |
| CR-026 | Page is loading (loading=true) | Show spinner + loading text, hide all other content |

**Field Specifications — Active Config Card:**
| Field | Type | Source Entity | Column | Format |
|-------|------|--------------|--------|--------|
| PPN Rate | Display (3xl bold) | `tax_configs` | `rate_percent` | "{value}%" |
| Calculation Mode | Display (xl semibold) | `tax_configs` | `calc_mode` | Capitalized (e.g., "Exclusive") |
| Effective Since | Display (xl semibold) | `tax_configs` | `effective_date` | date-fns format 'PPP' |

**Field Specifications — Historical Table:**
| Field | Type | Source Entity | Column | Format |
|-------|------|--------------|--------|--------|
| # | Computed | — | — | Row index + 1 |
| Rate (%) | Display (bold) | `tax_configs` | `rate_percent` | "{value}%" |
| Calculation Mode | Display | `tax_configs` | `calc_mode` | Capitalized |
| Effective Date | Display | `tax_configs` | `effective_date` | date-fns format 'PPP' |
| Status | Display (muted) | `tax_configs` | `status` | Capitalized, always "Historical" |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/tax-configuration/config` | List all configs (active + historical), ordered by effective_date DESC |
| GET | `/api/modules/tax-configuration/config/active` | Get single active config (status='active'), returns 404 if none |

---

#### 2.2.2 Tax Config Add (Update Tax Rate)

**Route:** `/console/modules/tax-configuration/config/add`  
**Source:** [TaxConfigAdd.tsx](src/modules/tax-configuration/client/pages/config/TaxConfigAdd.tsx), [TaxConfigForm.tsx](src/modules/tax-configuration/client/pages/config/TaxConfigForm.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-048 | The system shall provide a form to create a new PPN tax configuration |
| FR-049 | The form shall have three fields: PPN Rate (%), Effective Date, and Calculation Mode |
| FR-050 | The PPN Rate field shall be a number input with step 0.01, min 0, max 100 |
| FR-051 | The Effective Date field shall use a calendar date picker (Popover with Calendar component) |
| FR-052 | The date picker shall display the selected date formatted with date-fns 'PPP' format; if no date selected, show "Pick a date" |
| FR-053 | The Calculation Mode field shall be a dropdown with two options: "Inclusive (price includes tax)" and "Exclusive (tax added on top)" |
| FR-054 | Default values: rate=11, effectiveDate=today's date, calcMode="exclusive" |
| FR-055 | On successful submission, the server shall first set ALL existing active configs to status='historical', then insert the new config with status='active' |
| FR-056 | This means there is always at most one active tax config at any time |
| FR-057 | On successful submission, the system shall redirect to the tax config overview page and show toast "Tax configuration has been updated." |
| FR-058 | On failed submission, the system shall show toast "Failed to update tax configuration." |
| FR-059 | Breadcrumb navigation: "PPN Configuration" (links to overview) > "Update Tax Rate" |
| FR-060 | The rate is stored as a string in the database (decimal precision) but submitted as a number from the form |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-017 | PPN Rate is required | Client (Zod: `number({ error: "PPN Rate is required" })`) |
| VR-018 | PPN Rate must be >= 0 | Client (Zod: `.min(0, "Rate must be at least 0")`) |
| VR-019 | PPN Rate must be <= 100 | Client (Zod: `.max(100, "Rate must be at most 100")`) |
| VR-020 | PPN Rate is coerced from string to number (`z.coerce.number`) | Client |
| VR-021 | Effective Date is required | Client (Zod: `z.date({ error: "Effective date is required" })`) |
| VR-022 | Effective Date must be a valid Date object | Client |
| VR-023 | Calculation Mode is required | Client (Zod: `z.enum(['inclusive', 'exclusive'], { error: "Calculation mode is required" })`) |
| VR-024 | Server validates rate is a number between 0-100 | Server (Zod: `z.number().min(0).max(100)`) |
| VR-025 | Server coerces effectiveDate to Date via `z.coerce.date()` | Server |
| VR-026 | Server validates calcMode is one of 'inclusive' or 'exclusive' | Server (Zod enum) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-027 | Form submission in progress | Loading state active (isLoading=true) |
| CR-028 | Form validation fails (client-side Zod) | Display error message below the failed field via FormMessage component |
| CR-029 | Server returns 400 with validation details | Toast error displayed |
| CR-030 | Server returns 201 (success) | Navigate to overview page, show success toast |
| CR-031 | Cancel button clicked | Navigate back to overview page without saving |
| CR-032 | No date selected in calendar | Date button shows "Pick a date" in muted text |
| CR-033 | Date selected | Date button shows formatted date (e.g., "April 7th, 2026") |
| CR-034 | Rate input left empty | Zod error: "PPN Rate is required" shown below field |
| CR-035 | Rate input > 100 or < 0 | Zod error: "Rate must be at most 100" or "Rate must be at least 0" |

**Field Specifications:**
| Field | Type | Source Entity | Column | Required | Default | Validation |
|-------|------|--------------|--------|----------|---------|------------|
| PPN Rate (%) | Input (number, step=0.01) | `tax_configs` | `rate_percent` | Yes | 11 | Number, 0-100 |
| Effective Date | Date picker (Calendar popover) | `tax_configs` | `effective_date` | Yes | today | Valid Date object |
| Calculation Mode | Select dropdown | `tax_configs` | `calc_mode` | Yes | "exclusive" | Enum: inclusive, exclusive |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-001 | When a new tax config is created, ALL existing rows in `tax_configs` with `status='active'` are updated to `status='historical'` |
| BR-002 | The new config is inserted with `status='active'` |
| BR-003 | This ensures there is exactly one active tax config at any given time |
| BR-004 | The rate is stored as `String(ratePercent)` in the database (varchar/decimal column) |
| BR-005 | Historical configs are never deleted — they serve as an audit trail of rate changes |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/tax-configuration/config` | Create new config; auto-archives all existing active configs |

---

### 2.3 Product Catalog

**Module ID:** `product-catalog`  
**Permissions:** `retail.product.view`, `retail.product.create`, `retail.product.edit`, `retail.product.delete`, `retail.product.import`  
**API Base:** `/api/modules/product-catalog/`

#### 2.3.1 Product List

**Route:** `/console/modules/product-catalog/product`  
**Source:** [Product.tsx](src/modules/product-catalog/client/pages/product/Product.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-061 | The system shall display a paginated table of all products in the tenant |
| FR-062 | The system shall allow searching products by name or SKU code (ILIKE, debounced 500ms) |
| FR-063 | The system shall support sorting by skuCode, name, categoryName, uom, sellingPrice, status |
| FR-064 | The SKU Code column shall be a clickable link navigating to the product view page |
| FR-065 | The Selling Price shall be formatted as Indonesian Rupiah (IDR) currency |
| FR-066 | The Status column shall display colored badges: draft=gray, active=green, discontinued=yellow, archived=red |
| FR-067 | The Category column shall show the category name (joined from `categories` table) or "-" if null |
| FR-068 | Delete shall perform a **hard delete** (permanent removal) with a confirmation dialog |
| FR-069 | The confirmation message shall read: "This action cannot be undone. This will permanently delete the product." |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-027 | Search input debounced at 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-036 | User has ADMIN role + `retail.product.create` | Show "Add Product" button |
| CR-037 | User has ADMIN role + `retail.product.import` | Show "Import" button |
| CR-038 | Category is null for a product | Display "-" in Category column |
| CR-039 | Delete confirmed | Call DELETE API (hard delete), reload list, show success toast |
| CR-040 | Delete API fails | Show error toast |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| # | Computed | — | — | (page-1)*perPage + index + 1 |
| SKU Code | Display (link) | `products` | `sku_code` | Links to `/console/modules/product-catalog/product/{id}` |
| Name | Display | `products` | `name` | Sortable |
| Category | Display | `categories` | `name` | Joined via products.category_id; shows "-" if null |
| UoM | Display | `products` | `uom` | |
| Selling Price | Display (IDR) | `products` | `selling_price` | Formatted with Intl.NumberFormat IDR |
| Status | Badge | `products` | `status` | 4 colors per status |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/product-catalog/product` | List with pagination/sort/filter |
| DELETE | `/api/modules/product-catalog/product/:id` | Hard delete product |

---

#### 2.3.2 Product Add

**Route:** `/console/modules/product-catalog/product/add`  
**Source:** [ProductAdd.tsx](src/modules/product-catalog/client/pages/product/ProductAdd.tsx), [ProductForm.tsx](src/modules/product-catalog/client/pages/product/ProductForm.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-070 | The system shall provide a form to create a new product |
| FR-071 | The SKU Code shall be validated for uniqueness via async server call (POST /validate-sku) on form submission |
| FR-072 | The Category dropdown shall load all categories (up to 1000) sorted by name, plus a "None" option |
| FR-073 | Selecting "None" in Category shall set categoryId to null |
| FR-074 | The Tax Applicable toggle defaults to true (products are taxable by default) |
| FR-075 | Empty string values for optional fields (description, brand, etc.) shall be cleaned to null/undefined before submission |
| FR-076 | On success, navigate to product list with success toast |
| FR-077 | On failure, show error toast or field-level error messages |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-028 | SKU Code required, min 1 char | Client (Zod) |
| VR-029 | SKU Code must be unique across tenant | Client (async) + Server |
| VR-030 | Name required, min 1 char | Client (Zod) |
| VR-031 | Base Cost Price required, coerced to number | Client (Zod: `z.coerce.number`) |
| VR-032 | Selling Price required, coerced to number | Client (Zod: `z.coerce.number`) |
| VR-033 | Status must be one of: draft, active, discontinued, archived | Client (Zod enum), default: draft |
| VR-034 | Category ID, if provided, must be a valid UUID | Client (Zod) |
| VR-035 | UoM defaults to "pcs" if not specified | Client (Zod default) |
| VR-036 | Tax Applicable defaults to true | Client (Zod default) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-041 | Form in readonly mode (view page) | All fields disabled; Edit + Delete buttons shown |
| CR-042 | Form in edit mode | All fields enabled; Save + Cancel buttons shown |
| CR-043 | Async SKU validation fails | Display "SKU code must be unique" below SKU field |
| CR-044 | Cancel clicked | Navigate to product list |

**Field Specifications:**
| Field | Type | Source Entity | Column | Required | Default |
|-------|------|--------------|--------|----------|---------|
| SKU Code | Input (text) | `products` | `sku_code` | Yes | "" |
| Name | Input (text) | `products` | `name` | Yes | "" |
| Description | Textarea | `products` | `description` | No | "" |
| Category | Select | `products` | `category_id` | No | null ("None") |
| Brand | Input (text) | `products` | `brand` | No | "" |
| UoM | Input (text) | `products` | `uom` | No | "pcs" |
| Base Cost Price | Input (number) | `products` | `base_cost_price` | Yes | 0 |
| Selling Price | Input (number) | `products` | `selling_price` | Yes | 0 |
| Tax Applicable | Toggle (switch) | `products` | `tax_applicable` | No | true |
| Status | Select | `products` | `status` | No | "draft" |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/product-catalog/product/add` | Create product |
| POST | `/api/modules/product-catalog/product/validate-sku` | Async SKU uniqueness (body: {id?, skuCode}) |
| GET | `/api/modules/product-catalog/category?perPage=1000` | Load categories for dropdown |

---

#### 2.3.3 Product View (with Sub-Entity Management)

**Route:** `/console/modules/product-catalog/product/:id`  
**Source:** [ProductView.tsx](src/modules/product-catalog/client/pages/product/ProductView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-078 | The system shall display all product fields in read-only mode |
| FR-079 | The system shall display 5 sub-entity management sections below the product form |
| FR-080 | Each sub-entity section shall support Add (dialog), Edit (dialog, where applicable), and Delete (confirmation) |
| FR-081 | Sub-entities are managed via inline dialogs without navigating away from the view page |

**Sub-Entity: Variants** (table `product_variants`)

| # | Requirement |
|---|-------------|
| FR-082 | The system shall display a table of product variants with SKU, attributes, cost price, selling price, status |
| FR-083 | Attributes shall be displayed as key=value pairs parsed from JSON |
| FR-084 | Add/Edit Variant dialog fields: variantSku (required), attributes (JSON string), costPrice (required), sellingPrice (required), status (active/inactive) |

| # | Rule | Type |
|---|------|------|
| VR-037 | Variant SKU required, min 1 char | Client |
| VR-038 | Variant cost price required, numeric | Client |
| VR-039 | Variant selling price required, numeric | Client |
| VR-040 | Variant status must be active or inactive, default: active | Client |

**Sub-Entity: Barcodes** (table `barcodes`)

| # | Requirement |
|---|-------------|
| FR-085 | The system shall display a table of barcodes with value, type (EAN-13/UPC-A/Internal) |
| FR-086 | Add Barcode dialog fields: barcodeValue (required), barcodeType (select: ean13, upca, internal) |
| FR-087 | Barcode type labels: ean13→"EAN-13", upca→"UPC-A", internal→"Internal" |

| # | Rule | Type |
|---|------|------|
| VR-041 | Barcode value required, min 1 char | Client |
| VR-042 | Barcode type must be one of: ean13, upca, internal; default: internal | Client |

**Sub-Entity: UoM Conversions** (table `uom_conversions`)

| # | Requirement |
|---|-------------|
| FR-088 | The system shall display a table of UoM conversions with procurement UoM, sales UoM, conversion factor |
| FR-089 | Add dialog fields: procurementUom (required), salesUom (required), conversionFactor (required, default 1) |

| # | Rule | Type |
|---|------|------|
| VR-043 | Procurement UoM required | Client |
| VR-044 | Sales UoM required | Client |
| VR-045 | Conversion factor required, numeric, >= 0 | Client |

**Sub-Entity: Location Prices** (table `product_location_prices`)

| # | Requirement |
|---|-------------|
| FR-090 | The system shall display a table of location-specific prices with location name, cost price, selling price |
| FR-091 | Add dialog fields: locationId (select from active locations), costPrice (required), sellingPrice (required) |
| FR-092 | Location dropdown loads from location management API |

| # | Rule | Type |
|---|------|------|
| VR-046 | Location required (select) | Client |
| VR-047 | Cost price required, numeric | Client |
| VR-048 | Selling price required, numeric | Client |

**Sub-Entity: Images** (table `product_images`)

| # | Requirement |
|---|-------------|
| FR-093 | The system shall display product images in a grid layout |
| FR-094 | Primary image shall be indicated with a visual marker (badge/border) |
| FR-095 | Add Image dialog fields: imageUrl (required), isPrimary (checkbox, default false) |

| # | Rule | Type |
|---|------|------|
| VR-049 | Image URL required | Client |

---

#### 2.3.4 Category List

**Route:** `/console/modules/product-catalog/category`  
**Source:** [Category.tsx](src/modules/product-catalog/client/pages/category/Category.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-096 | The system shall provide two view modes: List View (paginated table) and Tree View (hierarchical) |
| FR-097 | List View shall display name, level, parent name, and status with sorting and search |
| FR-098 | Tree View shall display categories as an expandable/collapsible hierarchy |
| FR-099 | Tree View shall support search by category name (case-insensitive) |
| FR-100 | Tree View shall provide Expand All / Collapse All buttons |
| FR-101 | Clicking a tree node shall navigate to the category view page |
| FR-102 | A toggle button shall switch between List and Tree view modes |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-045 | List View active | Show paginated table with sort/search |
| CR-046 | Tree View active | Show hierarchical tree with expand/collapse |
| CR-047 | Delete fails (category has products) | Show error: "Failed to delete category. It may have products assigned." |

**Field Specifications (List View):**
| Field | Type | Source Entity | Column |
|-------|------|--------------|--------|
| Name | Display | `categories` | `name` |
| Level | Display | `categories` | `level` |
| Parent | Display | `categories` (self-join) | parent's `name` |
| Status | Badge | `categories` | `status` |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/product-catalog/category` | List (flat) with pagination |
| GET | `/api/modules/product-catalog/category/tree` | Get full hierarchy |
| DELETE | `/api/modules/product-catalog/category/:id` | Delete category |

---

#### 2.3.5 Category Add/Edit/View

**Source:** [CategoryAdd.tsx](src/modules/product-catalog/client/pages/category/CategoryAdd.tsx), [CategoryForm.tsx](src/modules/product-catalog/client/pages/category/CategoryForm.tsx), [CategoryView.tsx](src/modules/product-catalog/client/pages/category/CategoryView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-103 | The system shall provide a form with name, parent category, and sort order |
| FR-104 | The parent category dropdown shall list all categories (excluding self on edit) with a "None" option |
| FR-105 | Level and path shall be auto-calculated server-side based on parentId |
| FR-106 | View page shall display form in read-only mode with Edit and Delete buttons |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-050 | Name required, min 1 char | Client (Zod) |
| VR-051 | Parent ID optional, valid UUID if provided | Client (Zod) |
| VR-052 | Sort order optional, coerced to number, default 0 | Client (Zod) |

**Field Specifications:**
| Field | Type | Source Entity | Column | Required | Default |
|-------|------|--------------|--------|----------|---------|
| Name | Input (text) | `categories` | `name` | Yes | "" |
| Parent Category | Select | `categories` | `parent_id` | No | null ("None") |
| Sort Order | Input (number) | `categories` | `sort_order` | No | 0 |

---

#### 2.3.6 Product Import

**Route:** `/console/modules/product-catalog/product/import`  
**Source:** [ProductImport.tsx](src/modules/product-catalog/client/pages/import/ProductImport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-107 | The system shall provide a 3-step import wizard: Download Template → Upload & Preview → Results |
| FR-108 | Step 1: "Download CSV Template" button shall download a CSV file with headers: sku_code, name, description, category, brand, uom, cost_price, selling_price, tax_applicable, barcode, status |
| FR-109 | Step 2: File input shall accept only .csv files |
| FR-110 | Step 2: The system shall display a preview table showing the CSV header row + first 5 data rows |
| FR-111 | Step 2: The system shall display the total data row count (excluding header) |
| FR-112 | Step 2: "Import" button shall submit the CSV via multipart/form-data |
| FR-113 | Step 3: The system shall display summary cards: Imported count (green), Skipped count (yellow), Errors count (red) |
| FR-114 | Step 3: If errors exist, the system shall display an error detail table with row number, field name, and error message |
| FR-115 | The import shall upsert by sku_code: insert if new, update if existing |
| FR-116 | Category column in CSV is resolved by name match (not ID) |
| FR-117 | Step 3: "Import Another" restarts the wizard; "Back to Products" navigates to list |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-053 | File must be a .csv file | Client |
| VR-054 | Each row validated against product schema server-side | Server |
| VR-055 | Rows with validation errors are skipped and reported in the error table | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-048 | No file selected | "Import" button disabled |
| CR-049 | File selected and parsed | Show preview table + total rows + enable Import button |
| CR-050 | Import in progress | Show loading spinner |
| CR-051 | Import result has errors | Show error detail table |
| CR-052 | Import result has zero errors | Hide error table |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/product-catalog/import-export/template` | Download CSV template |
| POST | `/api/modules/product-catalog/import-export/import` | Import CSV (multipart) |
| GET | `/api/modules/product-catalog/import-export/export` | Export all products as CSV |

---

### 2.4 Approval Engine

**Module ID:** `approval-engine`  
**Permissions:** `retail.approval.manage`, `retail.approval.action`, `retail.approval.view`  
**API Base:** `/api/modules/approval-engine/`

#### 2.4.1 Approval Configuration

**Route:** `/console/modules/approval-engine/config`  
**Source:** [ApprovalConfig.tsx](src/modules/approval-engine/client/pages/config/ApprovalConfig.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-118 | The system shall display a table with one row per transaction type, each row independently editable |
| FR-119 | Transaction types shown: Purchase Order, Goods Received Note, Supplier Return, Stock Transfer, Stock Adjustment, POS Refund, POS Discount |
| FR-120 | Each row shall have an independent Save button that saves only that row's configuration |
| FR-121 | The Approver Role dropdown shall load roles from the system roles API (`GET /api/system/role?perPage=100`) |
| FR-122 | The Threshold Amount field shall accept null (empty = no threshold; approval required regardless of amount) |
| FR-123 | On successful save, the system shall show toast: "Configuration for [Transaction Type Label] saved successfully" |
| FR-124 | On failed save, the system shall show toast: "Failed to save configuration for [Transaction Type Label]" |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-056 | Threshold Amount: optional, can be null (empty string converted to null) | Client |
| VR-057 | Timeout Hours: must be a number | Client |
| VR-058 | Timeout Action: must be one of 'escalate' or 'auto_approve' | Client |
| VR-059 | Server validates via Zod approvalConfigUpdateSchema | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-053 | Save button clicked for a row | Show spinner on that row's save button; disable button during save |
| CR-054 | Save in progress for row X (savingRow === transactionType) | Loader2 spinner replaces Save icon for that row only |
| CR-055 | No configs returned from API | Show "No approval configurations found." (colspan=7) |
| CR-056 | Loading on mount | Show spinner while fetching configs and roles |

**Field Specifications:**
| Field | Type | Source Entity | Column | Editable | Notes |
|-------|------|--------------|--------|----------|-------|
| Transaction Type | Display (label) | `approval_configs` | `transaction_type` | No | Mapped via TRANSACTION_TYPE_LABELS |
| Required | Switch toggle | `approval_configs` | `is_required` | Yes | Boolean on/off |
| Approver Role | Select dropdown | `approval_configs` | `approver_role_id` | Yes | Options from sys_role; placeholder "Select role" |
| Threshold Amount | Input (number) | `approval_configs` | `threshold_amount` | Yes | Placeholder "Optional"; null = no threshold |
| Timeout Hours | Input (number) | `approval_configs` | `timeout_hours` | Yes | Numeric |
| Timeout Action | Select dropdown | `approval_configs` | `timeout_action` | Yes | "Escalate" or "Auto Approve" |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/approval-engine/config` | Load all configs with approver role names |
| GET | `/api/system/role?perPage=100` | Load roles for dropdown |
| PUT | `/api/modules/approval-engine/config/{transactionType}` | Save config for one transaction type |

---

#### 2.4.2 Pending Approvals

**Route:** `/console/modules/approval-engine/approval/pending`  
**Source:** [PendingApprovals.tsx](src/modules/approval-engine/client/pages/pending/PendingApprovals.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-125 | The system shall display pending approvals relevant to the current user's role (only approvals where the user's role matches the configured approver role) |
| FR-126 | The page title shall include a badge showing the total pending count (only if count > 0) |
| FR-127 | Transaction ID shall be displayed truncated to the first 8 characters with "..." suffix; full ID shown on hover (title attribute) |
| FR-128 | The Age column shall display relative time: "Xd ago", "Xh ago", "Xm ago", or "Just now" based on requestedAt |
| FR-129 | Approve action shall open a confirmation dialog: "Are you sure you want to approve this transaction? This action cannot be undone." |
| FR-130 | Reject action shall open a dialog with a textarea for rejection reason |
| FR-131 | On successful approve, show toast: "Approval granted successfully" and reload list |
| FR-132 | On successful reject, show toast: "Approval rejected successfully" and reload list |
| FR-133 | The reject reason textarea shall have 4 rows and placeholder "Enter rejection reason..." |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-060 | Reject reason is required: `rejectReason.trim()` must be non-empty | Client |
| VR-061 | If reject reason is empty on submit, show toast: "Please provide a reason for rejection" | Client |
| VR-062 | Reject button in dialog is disabled when rejectReason is empty/whitespace | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-057 | Pending count > 0 | Show badge with count next to page title |
| CR-058 | Pending count = 0 | Hide badge |
| CR-059 | approvals array empty AND not loading | Show "No pending approvals found." (colspan=7) |
| CR-060 | Reject dialog open AND reason is empty/whitespace | "Reject" button in dialog disabled |
| CR-061 | Reject dialog open AND reason has content | "Reject" button enabled |
| CR-062 | Loading state | Show loading overlay dialog with spinner |
| CR-063 | Approve confirmed | POST to approve endpoint, reload list on success |
| CR-064 | Reject confirmed with reason | POST to reject endpoint with reason, reload list on success |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| # | Computed | — | — | (page-1)*perPage + index + 1 |
| Transaction Type | Display (label) | `approval_logs` | `transaction_type` | Mapped via TRANSACTION_TYPE_LABELS |
| Transaction ID | Display (truncated) | `approval_logs` | `transaction_id` | First 8 chars + "..."; full on hover |
| Requested By | Display | `sys_user` | `fullname` | Joined via approval_logs.requested_by |
| Requested At | Display (datetime) | `approval_logs` | `requested_at` | toLocaleString() |
| Age | Computed | — | — | Relative time from requestedAt |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/approval-engine/approval/pending` | List pending approvals for current user's roles |
| POST | `/api/modules/approval-engine/approval/{id}/approve` | Approve a pending item |
| POST | `/api/modules/approval-engine/approval/{id}/reject` | Reject with reason (body: {reason}) |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-006 | Pending approvals are filtered by the current user's roles: only approvals where the configured approver_role_id matches one of the user's assigned roles are shown |
| BR-007 | Approve sets: action='approved', approvedBy=currentUserId, actionedAt=now |
| BR-008 | Reject sets: action='rejected', approvedBy=currentUserId, reason=trimmed input, actionedAt=now |
| BR-009 | An approval that is already actioned (not 'pending') returns 404 on approve/reject attempt |

---

#### 2.4.3 Approval History

**Route:** `/console/modules/approval-engine/approval/history`  
**Source:** [ApprovalHistory.tsx](src/modules/approval-engine/client/pages/history/ApprovalHistory.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-134 | The system shall display a paginated table of all completed (approved/rejected) approval actions |
| FR-135 | The Action column shall display a colored badge: green for "Approved", red (destructive) for "Rejected" |
| FR-136 | The Reason column shall truncate long text to max-width 200px with full text on hover |
| FR-137 | The system shall support filtering by transaction type (dropdown), action (approved/rejected), date range (from/to), and text search |
| FR-138 | Date filters accept YYYY-MM-DD format strings |
| FR-139 | Transaction ID truncated to 8 chars + "..." with full UUID on hover |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-063 | Date From and Date To inputs accept free-text in YYYY-MM-DD format (no date picker validation) | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-065 | Transaction Type filter = "all" | Do not include transactionType param in API call |
| CR-066 | Action filter = "all" | Do not include action param in API call |
| CR-067 | Date From or Date To set | Include dateFrom/dateTo params in API call |
| CR-068 | Any filter changed | Reset page to 1 |
| CR-069 | Action = 'approved' | Green badge (bg-green-100 text-green-700) |
| CR-070 | Action = 'rejected' | Red badge (variant="destructive") |
| CR-071 | Reason is null | Display "-" |
| CR-072 | History empty AND not loading | Show "No approval history found." (colspan=8) |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| # | Computed | — | — | Row number |
| Transaction Type | Display (label) | `approval_logs` | `transaction_type` | Mapped label |
| Transaction ID | Display (truncated) | `approval_logs` | `transaction_id` | 8 chars + hover |
| Requested By | Display | `sys_user` | `fullname` | Requester |
| Actioned By | Display | `sys_user` | `fullname` | Approver/Rejecter |
| Action | Badge | `approval_logs` | `action` | Green=approved, Red=rejected |
| Reason | Display (truncated) | `approval_logs` | `reason` | Max 200px, "-" if null |
| Date | Display (datetime) | `approval_logs` | `actioned_at` | toLocaleString() |

**API Endpoints:**
| Method | Path | Params | Purpose |
|--------|------|--------|---------|
| GET | `/api/modules/approval-engine/approval/history` | page, perPage, sort, order, filter, transactionType?, action?, dateFrom?, dateTo? | List actioned approvals |

---

#### 2.4.4 Audit Log

**Route:** `/console/modules/approval-engine/audit`  
**Source:** [AuditLog.tsx](src/modules/approval-engine/client/pages/audit/AuditLog.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-140 | The system shall display a paginated table of all audit log entries |
| FR-141 | Each row shall be expandable to show before/after JSON data side-by-side |
| FR-142 | Only one row can be expanded at a time; clicking another row collapses the previous |
| FR-143 | The expanded section shall show "Before" and "After" JSON objects formatted with 2-space indentation in a scrollable pre block (max-height 300px) |
| FR-144 | If before or after data is null, display "N/A" |
| FR-145 | The Action column shall display colored badges: create=default (blue), update=secondary (gray), delete=destructive (red), other=outline |
| FR-146 | Entity ID truncated to 8 chars + "..." with full ID on hover |
| FR-147 | The system shall support filtering by module (text), action (dropdown: create/update/delete), user (text), date range, and text search |
| FR-148 | Default sort: timestamp descending |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-064 | Date From and Date To accept free-text YYYY-MM-DD format | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-073 | Row chevron clicked (not currently expanded) | Expand row to show before/after JSON; collapse previously expanded row |
| CR-074 | Row chevron clicked (currently expanded) | Collapse the row |
| CR-075 | Expanded row: before data is null | Show "N/A" in Before section |
| CR-076 | Expanded row: after data is null | Show "N/A" in After section |
| CR-077 | Module filter set | Include `module` param in API |
| CR-078 | Action filter != "all" | Include `action` param in API |
| CR-079 | User filter set | Include `user` param in API |
| CR-080 | Any filter changed | Reset page to 1 |
| CR-081 | Action = 'create' | Badge variant="default" (blue) |
| CR-082 | Action = 'update' | Badge variant="secondary" (gray) |
| CR-083 | Action = 'delete' | Badge variant="destructive" (red) |
| CR-084 | Other action value | Badge variant="outline" |
| CR-085 | Logs empty AND not loading | Show "No audit log entries found." (colspan=8) |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| (expand) | Icon button | — | — | ChevronRight/ChevronDown toggle |
| # | Computed | — | — | Row number |
| Timestamp | Display (datetime) | `audit_logs` | `created_at` | toLocaleString(), sortable |
| User | Display | `sys_user` | `username` | Joined via audit_logs.user_id, sortable |
| Action | Badge | `audit_logs` | `action` | Color-coded by action type |
| Module | Display | `audit_logs` | `module` | Sortable |
| Entity Type | Display | `audit_logs` | `entity_type` | |
| Entity ID | Display (truncated) | `audit_logs` | `entity_id` | 8 chars + hover |

**Expanded Row Fields:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| Before | JSON (pre, formatted) | `audit_logs` | `before_data` | JSON.stringify with 2-space indent; "N/A" if null |
| After | JSON (pre, formatted) | `audit_logs` | `after_data` | JSON.stringify with 2-space indent; "N/A" if null |

**API Endpoints:**
| Method | Path | Params | Purpose |
|--------|------|--------|---------|
| GET | `/api/modules/approval-engine/audit-log` | page, perPage, sort, order, filter, module?, action?, user?, dateFrom?, dateTo? | List audit entries |

---

### 2.5 Supplier Management

**Module ID:** `supplier-management`  
**Permissions:** `retail.supplier.view`, `retail.supplier.create`, `retail.supplier.edit`, `retail.supplier.delete`  
**API Base:** `/api/modules/supplier-management/supplier`

#### 2.5.1 Supplier List

**Route:** `/console/modules/supplier-management/supplier`  
**Source:** [Supplier.tsx](src/modules/supplier-management/client/pages/supplier/Supplier.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-149 | The system shall display a paginated table of all suppliers in the tenant |
| FR-150 | The system shall allow searching suppliers by name or code (ILIKE, debounced 500ms) |
| FR-151 | The system shall support sorting by code, name, npwp, paymentTerms, status |
| FR-152 | The Code column shall be a clickable link navigating to the supplier view page |
| FR-153 | NPWP and Payment Terms shall display "-" when null |
| FR-154 | Delete shall perform a soft delete (status set to inactive) with confirmation dialog |
| FR-155 | Confirmation message: "This action cannot be undone. This will set the supplier status to inactive." |
| FR-156 | Default sort: name ascending |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-065 | Search debounced at 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-086 | User has ADMIN + `retail.supplier.create` | Show "Add Supplier" button |
| CR-087 | Delete confirmed | Call DELETE API (soft-delete), show toast "Supplier deleted successfully", reload |
| CR-088 | Delete fails | Show toast "Failed to delete supplier" |
| CR-089 | NPWP is null | Display "-" |
| CR-090 | Payment Terms is null | Display "-" |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| # | Computed | — | — | Row number |
| Code | Display (link) | `suppliers` | `code` | Links to view page |
| Name | Display | `suppliers` | `name` | Sortable |
| NPWP | Display | `suppliers` | `npwp` | Nullable, "-" if null |
| Payment Terms | Display | `suppliers` | `payment_terms` | Nullable, "-" if null |
| Status | Badge | `suppliers` | `status` | Green=Active, Red=Inactive |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-management/supplier` | List with pagination/sort/filter |
| DELETE | `/api/modules/supplier-management/supplier/:id` | Soft-delete (status→inactive) |

---

#### 2.5.2 Supplier Add

**Route:** `/console/modules/supplier-management/supplier/add`  
**Source:** [SupplierAdd.tsx](src/modules/supplier-management/client/pages/supplier/SupplierAdd.tsx), [SupplierForm.tsx](src/modules/supplier-management/client/pages/supplier/SupplierForm.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-157 | The system shall provide a form to create a new supplier |
| FR-158 | The Code field shall be validated for uniqueness via async server call on form submission |
| FR-159 | The Bank Details section shall be displayed in a bordered box with 3 fields (bank name, account number, account holder) |
| FR-160 | Empty string values for optional fields shall be converted to null before submission |
| FR-161 | Lead Time Days shall convert empty string to null (coerced number) |
| FR-162 | On success, navigate to list and show toast: "Supplier has been created." |
| FR-163 | On failure, show toast: "Failed to create supplier." |
| FR-164 | Breadcrumb: Suppliers (link) > Add Supplier |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-066 | Code required, min 1 char | Client (Zod) |
| VR-067 | Code must be unique across tenant | Client (async) + Server |
| VR-068 | Name required, min 1 char | Client (Zod) |
| VR-069 | NPWP: optional, nullable; server validates regex `^\d{15,16}$` if provided | Server (Zod regex) |
| VR-070 | Lead Time Days: optional, coerced to number, nullable | Client (Zod) |
| VR-071 | Status must be 'active' or 'inactive', default 'active' | Client (Zod enum) |
| VR-072 | Bank details: all 3 fields optional, nullable | Client (Zod) |
| VR-073 | Server validates code uniqueness: `WHERE code = input AND id != current_id` | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-091 | Form in readonly mode (view page) | All fields disabled; Edit + Delete buttons shown |
| CR-092 | Form in edit mode | All fields enabled; Save + Cancel buttons shown |
| CR-093 | Async code validation fails | Display "Code must be unique" below Code field |
| CR-094 | Cancel clicked | Navigate to supplier list |

**Field Specifications:**
| Field | Type | Source Entity | Column | Required | Default |
|-------|------|--------------|--------|----------|---------|
| Code | Input (text) | `suppliers` | `code` | Yes | "" |
| Name | Input (text) | `suppliers` | `name` | Yes | "" |
| NPWP | Input (text) | `suppliers` | `npwp` | No | "" |
| Address | Textarea | `suppliers` | `address` | No | "" |
| Payment Terms | Input (text) | `suppliers` | `payment_terms` | No | "" (placeholder: "e.g. Net 30") |
| Lead Time (Days) | Input (number) | `suppliers` | `lead_time_days` | No | null |
| Status | Select | `suppliers` | `status` | No | "active" |
| Bank Name | Input (text) | `suppliers` | `bank_details→bankName` | No | "" |
| Account Number | Input (text) | `suppliers` | `bank_details→accountNumber` | No | "" |
| Account Holder | Input (text) | `suppliers` | `bank_details→accountHolder` | No | "" |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/supplier-management/supplier/add` | Create supplier |
| POST | `/api/modules/supplier-management/supplier/validate-code` | Async code uniqueness (body: {id?, code}) |

---

#### 2.5.3 Supplier View (with Contacts + Linked Products)

**Route:** `/console/modules/supplier-management/supplier/:id`  
**Source:** [SupplierView.tsx](src/modules/supplier-management/client/pages/supplier/SupplierView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-165 | The system shall display all supplier fields in read-only mode |
| FR-166 | The system shall display a "Contacts" sub-entity table with Add Contact and Delete Contact actions |
| FR-167 | The system shall display a "Linked Products" sub-entity table with Link Product and Unlink Product actions |
| FR-168 | Breadcrumb dynamically updates to show supplier name |

**Sub-Entity: Contacts** (table `supplier_contacts`)

| # | Requirement |
|---|-------------|
| FR-169 | Add Contact dialog fields: Name (required, trimmed), Role (select: Sales/AR/Logistics/General, default General), Phone (optional), Email (optional, type=email), Primary Contact (switch, default false) |
| FR-170 | Contact Role displayed as badge with labels: Sales, AR, Logistics, General |
| FR-171 | Primary Contact displayed as badge: "Yes" (default variant) or "No" (secondary variant) |
| FR-172 | Phone and Email display "-" when null |
| FR-173 | Delete Contact shows confirmation: "Are you sure you want to delete this contact? This action cannot be undone." |

| # | Rule | Type |
|---|------|------|
| VR-074 | Contact name required (trimmed, non-empty) | Client |
| VR-075 | Contact role required, one of: sales, ar, logistics, general | Client |
| VR-076 | Contact email, if provided, must be valid email format | Server (Zod `.email()`) |

| # | Condition | Behavior |
|---|-----------|----------|
| CR-095 | Contact name empty on Add | Show toast: "Contact name is required" |
| CR-096 | Add Contact succeeds | Toast: "Contact added successfully", reload contacts |
| CR-097 | No contacts | Show "No contacts added yet." |

**Sub-Entity: Linked Products** (table `supplier_products`)

| # | Requirement |
|---|-------------|
| FR-174 | Link Product dialog fields: Product (select from active products, format "{SKU} - {Name}"), Supplier Price (number), Min Order Qty (number), Supplier SKU (optional) |
| FR-175 | Product dropdown loads up to 1000 active products sorted by name |
| FR-176 | Supplier Price formatted as "IDR X,XXX" in the table |
| FR-177 | Supplier SKU displays "-" when null |
| FR-178 | Unlink confirmation: "Are you sure you want to unlink this product? This action cannot be undone." |

| # | Rule | Type |
|---|------|------|
| VR-077 | Product selection required in Link dialog | Client |
| VR-078 | Supplier Price required, numeric | Server (Zod) |

| # | Condition | Behavior |
|---|-----------|----------|
| CR-098 | No product selected on Link | Show toast: "Please select a product" |
| CR-099 | Link succeeds | Toast: "Product linked successfully", reload |
| CR-100 | Unlink succeeds | Toast: "Product unlinked", reload |
| CR-101 | No linked products | Show "No products linked yet." |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-management/supplier/:id` | Load supplier with contacts + products |
| POST | `/api/modules/supplier-management/supplier/:id/contacts` | Add contact |
| DELETE | `/api/modules/supplier-management/supplier/contacts/:contactId` | Delete contact |
| POST | `/api/modules/supplier-management/supplier/:id/products` | Link product |
| DELETE | `/api/modules/supplier-management/supplier/supplier-products/:spId` | Unlink product |
| GET | `/api/modules/product-catalog/product?perPage=1000&sort=name` | Load products for link dialog |

---

#### 2.5.4 Supplier Edit

**Route:** `/console/modules/supplier-management/supplier/:id/edit`  
**Source:** [SupplierEdit.tsx](src/modules/supplier-management/client/pages/supplier/SupplierEdit.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-179 | The system shall display the same form as Add, pre-populated with existing supplier data |
| FR-180 | Code uniqueness check shall exclude the current supplier ID |
| FR-181 | On success, navigate to view page and show toast: "Supplier has been updated." |
| FR-182 | On failure, show toast: "Failed to update supplier." |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-management/supplier/:id` | Load existing data |
| PUT | `/api/modules/supplier-management/supplier/:id` | Update supplier |

---

#### 2.5.5 Supplier Import

**Route:** `/console/modules/supplier-management/supplier/import`  
**Source:** [SupplierImport.tsx](src/modules/supplier-management/client/pages/import/SupplierImport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-183 | The system shall provide a 3-step import wizard: Download Template → Upload & Preview → Results |
| FR-184 | CSV template headers: supplier_code, name, npwp, address, payment_terms, lead_time_days, contact_name, contact_email, contact_phone, contact_role |
| FR-185 | Template auto-downloads as "supplier-import-template.csv" |
| FR-186 | Step 2: File input accepts only .csv files; preview shows header + first 5 data rows + total row count |
| FR-187 | Step 3: Summary cards — Imported (green, CheckCircle2 icon), Skipped (yellow, FileUp icon), Errors (red, XCircle icon) |
| FR-188 | Error detail table shows: Row #, Field, Error Message (red text) |
| FR-189 | Import upserts by supplier_code; if contact_name provided, creates a contact record |
| FR-190 | Step 3 buttons: "Import Another" (RotateCcw icon, restarts wizard), "Back to Suppliers" (navigates to list) |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-079 | File must be .csv | Client |
| VR-080 | Each row validated server-side against supplier schema | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-102 | No file selected | "Import" button disabled |
| CR-103 | File selected | Show preview + enable Import button |
| CR-104 | Import in progress | Show Loader2 spinner + "Importing..." text on button |
| CR-105 | Import result has errors | Show error detail table |
| CR-106 | Import result has zero errors | Hide error table |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-management/import/template` | Download CSV template |
| POST | `/api/modules/supplier-management/import/import` | Import CSV (multipart/form-data) |
| GET | `/api/modules/supplier-management/import/export` | Export suppliers as CSV |

---

### 2.6 Purchase Order

**Module ID:** `purchase-order`  
**Permissions:** `retail.po.view`, `retail.po.create`, `retail.po.edit`, `retail.po.approve`, `retail.po.send`  
**API Base:** `/api/modules/purchase-order/po`

#### 2.6.1 PO List

**Route:** `/console/modules/purchase-order/po`  
**Source:** [PurchaseOrder.tsx](src/modules/purchase-order/client/pages/po/PurchaseOrder.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-191 | The system shall display a paginated table of all purchase orders |
| FR-192 | The system shall allow filtering by status (8 statuses + "All") via dropdown |
| FR-193 | The system shall allow searching by PO number or supplier name (ILIKE, debounced 500ms) |
| FR-194 | The system shall support sorting by poNumber, orderDate, totalAmount, status |
| FR-195 | PO Number shall be a clickable link navigating to the PO view page |
| FR-196 | Total Amount shall be formatted as IDR currency |
| FR-197 | Default sort: orderDate descending |
| FR-198 | Edit button shall only be shown for POs in draft or approved status |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-081 | Search debounced at 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-107 | User has ADMIN + `retail.po.create` | Show "Create PO" button |
| CR-108 | PO status is 'draft' or 'approved' | Show Edit (pencil) button on row |
| CR-109 | PO status is NOT 'draft' or 'approved' | Hide Edit button on row |
| CR-110 | Status filter = "all" | Do not include status param in API call |

**Field Specifications:**
| Field | Type | Source Entity | Column | Notes |
|-------|------|--------------|--------|-------|
| PO Number | Display (link) | `purchase_orders` | `po_number` | Links to view, sortable |
| Supplier | Display | `suppliers` | `name` | "-" if null |
| Order Date | Display (date) | `purchase_orders` | `order_date` | id-ID locale format |
| Total Amount | Display (IDR) | `purchase_orders` | `total_amount` | Currency format |
| Status | Badge | `purchase_orders` | `status` | 8 colors: draft=gray, pending_approval=yellow, approved=blue, sent=indigo, partially_received=orange, fully_received=green, closed=emerald, cancelled=red |

---

#### 2.6.2 PO Create

**Route:** `/console/modules/purchase-order/po/add`  
**Source:** [PurchaseOrderAdd.tsx](src/modules/purchase-order/client/pages/po/PurchaseOrderAdd.tsx), [PurchaseOrderForm.tsx](src/modules/purchase-order/client/pages/po/PurchaseOrderForm.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-199 | The system shall provide a form to create a new purchase order with header fields and dynamic line items |
| FR-200 | The Supplier dropdown shall load active suppliers (status=active) sorted by name, displaying "{code} - {name}" |
| FR-201 | When a supplier is selected, the line items Product dropdown shall load products linked to that supplier via `supplier_products` |
| FR-202 | When a product is selected in a line item, the system shall auto-populate: productName, skuCode, unitPrice (from supplierPrice), supplierSku |
| FR-203 | The "Add Item" button shall be disabled if no supplier is selected |
| FR-204 | When no supplier is selected, display message: "Select a supplier first to add line items." |
| FR-205 | The system shall fetch the active tax config on mount and display the rate and calc mode |
| FR-206 | Line item totals, subtotal, discount, tax, and grand total shall be calculated in real-time as the user edits |
| FR-207 | Tax calculation: if inclusive mode, tax = afterDiscount - afterDiscount/(1+rate); if exclusive, tax = afterDiscount × rate |
| FR-208 | All amounts rounded to 2 decimal places |
| FR-209 | Default line item: qty=1, unitPrice=0, discountPercent=0, uom="pcs" |
| FR-210 | On success, navigate to list and show toast: "Purchase order has been created." |
| FR-211 | PO number auto-generated server-side in format PO-YYYYMM-NNNN |
| FR-212 | PO created with status='draft', version=1 |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-082 | Supplier required (min 1 char, UUID) | Client (Zod) |
| VR-083 | Order Date required (min 1 char) | Client (Zod) |
| VR-084 | At least one line item required | Client (Zod array min 1) |
| VR-085 | Line item Product required (min 1 char) | Client (Zod) |
| VR-086 | Line item Quantity: integer, min 1 | Client (Zod) |
| VR-087 | Line item Unit Price: min 0 | Client (Zod) |
| VR-088 | Line item Discount %: 0-100, default 0 | Client (Zod) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-111 | No supplier selected | "Add Item" button disabled; message shown |
| CR-112 | Supplier selected | "Add Item" enabled; products dropdown loads supplier's linked products |
| CR-113 | Supplier changed | Reload supplier products; existing line items remain but product select resets |
| CR-114 | Product selected in line item | Auto-fill productName, skuCode, unitPrice, supplierSku |
| CR-115 | Tax config loaded | Display "PPN: X% (inclusive/exclusive)" label near totals |
| CR-116 | Cancel clicked | Navigate to PO list |

**Field Specifications — Header:**
| Field | Type | Source | Required | Default |
|-------|------|--------|----------|---------|
| Supplier | Select | `suppliers` (active) | Yes | "" |
| Location | Select | `locations` (active) | No | null |
| Order Date | Input (date) | — | Yes | today (YYYY-MM-DD) |
| Expected Delivery | Input (date) | — | No | null |
| Notes | Textarea | — | No | "" |

**Field Specifications — Line Items:**
| Field | Type | Editable | Default | Notes |
|-------|------|----------|---------|-------|
| Product | Select | Yes | "" | From supplier_products |
| SKU | Display | No | "-" | Auto-filled |
| Qty | Input (number) | Yes | 1 | min=1 |
| Unit Price | Input (number) | Yes | 0 | Auto-filled from supplierPrice |
| Disc % | Input (number) | Yes | 0 | 0-100, step=0.1 |
| UOM | Input (text) | Yes | "pcs" | |
| Line Total | Computed | No | — | Calculated in real-time |
| (Delete) | Button | — | — | Trash icon, removes row |

---

#### 2.6.3 PO Edit

**Route:** `/console/modules/purchase-order/po/:id/edit`  
**Source:** [PurchaseOrderEdit.tsx](src/modules/purchase-order/client/pages/po/PurchaseOrderEdit.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-213 | Only POs with status 'draft' or 'approved' can be edited |
| FR-214 | If PO is not editable, show toast "This purchase order cannot be edited." and redirect to view |
| FR-215 | The edit form shall include a required "Change Reason" field for amendment tracking |
| FR-216 | On successful update, the system shall: create an amendment record (snapshot of previous version), delete old items, insert new items, increment version |
| FR-217 | On success, navigate to view page and show toast: "Purchase order has been updated." |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-089 | Change Reason required in edit mode: min 1 char | Client (Zod) |
| VR-090 | All validation rules from Create (VR-082 to VR-088) also apply | Client + Server |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-010 | Editing creates an amendment record with: version (old), changedBy (current user), changeReason, snapshot (JSON of previous PO + items) |
| BR-011 | Version is incremented by 1 on each edit |
| BR-012 | Old line items are deleted and replaced with new ones (full replacement, not partial update) |

---

#### 2.6.4 PO View

**Route:** `/console/modules/purchase-order/po/:id`  
**Source:** [PurchaseOrderView.tsx](src/modules/purchase-order/client/pages/po/PurchaseOrderView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-218 | The system shall display a 7-stage status timeline (excluding cancelled) with visual progression |
| FR-219 | Completed stages shown as green checkmarks; current stage as blue circle; future as gray |
| FR-220 | If PO is cancelled, show red banner with cancellation details (who, when, reason) instead of timeline |
| FR-221 | Action buttons shall be shown conditionally based on current status and user permissions |
| FR-222 | Line items table shall show: Product, SKU, Qty, Received, Remaining (computed: qty - received), Unit Price, Disc %, Tax, Line Total |
| FR-223 | Totals summary: Subtotal, Discount (red), Tax (PPN), Total (bold) |
| FR-224 | Amendment History section is collapsible, shown only if amendments exist, sorted by version descending |
| FR-225 | Cancel PO dialog requires a reason (textarea, 3 rows, placeholder "Enter cancellation reason...") |
| FR-226 | When approving from draft, if approval config is_required=true for purchase_order AND total >= threshold, system creates approval request and returns 202 with message "Approval required. Your request has been submitted for review." |
| FR-227 | PDF download via dynamic import of generatePoPdf |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-117 | Status = 'draft' | Show: Approve, Edit, Cancel PO buttons |
| CR-118 | Status = 'pending_approval' | Show: Approve, Reject (Back to Draft) buttons |
| CR-119 | Status = 'approved' | Show: Mark as Sent, Edit, Cancel PO buttons |
| CR-120 | Status = 'fully_received' | Show: Close PO button |
| CR-121 | Any status | Show: Download PDF button |
| CR-122 | Status = 'cancelled' | Show red cancellation banner with details; hide timeline |
| CR-123 | Amendments array empty | Hide Amendment History section entirely |
| CR-124 | Amendments array has items | Show collapsible Amendment History with toggle |
| CR-125 | Cancel reason empty on confirm | Show toast: "Cancellation reason is required." |
| CR-126 | Status transition returns 202 | Show info toast: "Approval required. Your request has been submitted for review." |
| CR-127 | Status transition returns 200 | Show success toast: "Status updated to {label}." |

**State Machine Transitions:**
| From | To | Condition |
|------|-----|-----------|
| draft | pending_approval | Auto if approval config requires it AND total >= threshold |
| draft | approved | Direct if no approval required, or skip |
| draft | cancelled | Requires reason |
| pending_approval | approved | Approver approves |
| pending_approval | draft | Approver rejects (back to draft) |
| approved | sent | Mark as Sent |
| approved | cancelled | Requires reason |
| sent | partially_received | Set by GRN module when partial goods received |
| sent | fully_received | Set by GRN module when all goods received |
| partially_received | fully_received | Set by GRN module |
| fully_received | closed | Manual close |

**Field Specifications — Header Card:**
| Field | Source | Notes |
|-------|--------|-------|
| PO Number | `purchase_orders.po_number` | Large text |
| Status | `purchase_orders.status` | Color badge |
| Version | `purchase_orders.version` | Format: "v{version}" |
| Supplier | `suppliers.name` + `suppliers.code` | Format: "name (code)" |
| Delivery Location | `locations.name` | "-" if null |
| Created By | `sys_user.fullname` | |
| Order Date | `purchase_orders.order_date` | id-ID date format |
| Expected Delivery | `purchase_orders.expected_delivery_date` | id-ID date format or "-" |
| Tax Rate | `purchase_orders.tax_rate_percent` + `tax_calc_mode` | "X.X% (mode)" or "N/A" |
| Notes | `purchase_orders.notes` | Spans full width if present |

**Field Specifications — Line Items:**
| Field | Source | Notes |
|-------|--------|-------|
| Product | `purchase_order_items.product_name` | |
| SKU | `purchase_order_items.sku_code` | Muted text |
| Qty | `purchase_order_items.quantity` | Right-aligned |
| Received | `purchase_order_items.received_quantity` | Right-aligned |
| Remaining | Computed: qty - received | Right-aligned, bold |
| Unit Price | `purchase_order_items.unit_price` | IDR format |
| Disc % | `purchase_order_items.discount_percent` | + "%" suffix |
| Tax | `purchase_order_items.tax_amount` | IDR format |
| Line Total | `purchase_order_items.line_total` | IDR format, bold |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/purchase-order/po/:id` | Load PO with items, amendments, relations, availableTransitions |
| PUT | `/api/modules/purchase-order/po/:id/status` | Transition status (body: {status, reason?}) |
| DELETE | `/api/modules/purchase-order/po/:id` | Cancel PO (body: {reason}) |

---

### 2.7 Goods Received Note (GRN)

**Module ID:** `grn`  
**Permissions:** `retail.grn.view`, `retail.grn.create`, `retail.grn.transition`  
**API Base:** `/api/modules/grn/grn`

**State Machine:** draft → quality_inspection → accepted → stock_updated

#### 2.7.1 GRN List

**Route:** `/console/modules/grn/grn`  
**Source:** [Grn.tsx](src/modules/grn/client/pages/grn/Grn.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-228 | The system shall display a paginated table of all GRNs |
| FR-229 | The system shall allow filtering by status (4 statuses + "All") via dropdown |
| FR-230 | The system shall allow searching by GRN number or PO number (ILIKE, debounced 500ms) |
| FR-231 | The system shall support sorting by grnNumber, receivedDate, status |
| FR-232 | GRN Number shall be a clickable link to the GRN view page |
| FR-233 | Default sort: receivedDate descending |
| FR-234 | Status badges: draft=gray, quality_inspection=yellow, accepted=blue, stock_updated=green |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-128 | User has ADMIN + `retail.grn.create` | Show "Receive Goods" button |
| CR-129 | No GRNs found | Show "No goods received notes found." |

---

#### 2.7.2 GRN Create (Receive Goods)

**Route:** `/console/modules/grn/grn/add`  
**Source:** [GrnAdd.tsx](src/modules/grn/client/pages/grn/GrnAdd.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-235 | The PO dropdown shall only show POs with status 'sent' or 'partially_received' (fetched from two separate API calls and merged) |
| FR-236 | When a PO is selected, the system shall fetch receivable items from `GET /grn/po/{poId}/receivable` and auto-populate the items table |
| FR-237 | Each item row shall pre-fill receivedQuantity with remainingQuantity (default: receive all remaining) and acceptedQuantity = remainingQuantity |
| FR-238 | The acceptedQuantity shall auto-recalculate in real-time: `accepted = received - rejected` |
| FR-239 | When rejectedQuantity > 0, the rejection reason dropdown shall appear for that row |
| FR-240 | The server shall validate that receivedQuantity does not exceed the remaining quantity for each PO item |
| FR-241 | If a PO has no remaining receivable items, show message: "All items for this PO have been fully received." |
| FR-242 | GRN created with status 'draft', auto-generated GRN number (GRN-YYYYMM-NNNN) |
| FR-243 | On success, navigate to list and show toast: "Goods received note has been created." |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-091 | Purchase Order ID required | Client + Server |
| VR-092 | Received Date required | Client + Server |
| VR-093 | At least one line item required | Client + Server |
| VR-094 | receivedQuantity >= 0 for each item | Client + Server |
| VR-095 | acceptedQuantity >= 0 for each item | Client + Server |
| VR-096 | acceptedQuantity + rejectedQuantity must equal receivedQuantity | Server (Zod refine) |
| VR-097 | receivedQuantity must not exceed remaining (orderedQty - previouslyReceived) | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-130 | No PO selected | Show "Select a purchase order to see receivable items." |
| CR-131 | Loading receivable items | Show "Loading receivable items..." |
| CR-132 | PO selected, items loaded | Show items table with pre-filled quantities |
| CR-133 | rejectedQuantity > 0 for a row | Show rejection reason dropdown for that row |
| CR-134 | rejectedQuantity = 0 for a row | Hide rejection reason dropdown |
| CR-135 | No items with remaining > 0 | Show "All items for this PO have been fully received." |

**Field Specifications — Header:**
| Field | Type | Source | Required | Default |
|-------|------|--------|----------|---------|
| Purchase Order | Select | `purchase_orders` (sent/partially_received) | Yes | "" |
| Delivery Location | Select | `locations` (active) | No | null |
| Received Date | Input (date) | — | Yes | today |
| Delivery Note Ref | Input (text) | — | No | "" |
| Invoice Ref | Input (text) | — | No | "" |
| Notes | Textarea | — | No | "" |

**Field Specifications — Line Items (auto-populated):**
| Field | Editable | Source | Notes |
|-------|----------|--------|-------|
| Product | No | `purchase_order_items.product_name` | Read-only |
| SKU | No | `purchase_order_items.sku_code` | Read-only |
| Ordered | No | `purchase_order_items.quantity` | Right-aligned |
| Prev Rcvd | No | `purchase_order_items.received_quantity` | Right-aligned |
| Remaining | No | Computed: ordered - prev rcvd | Bold, right-aligned |
| Received | Yes | Input (number), max=remaining | Pre-filled with remaining |
| Accepted | No | Computed: received - rejected | Read-only, muted bg |
| Rejected | Yes | Input (number) | Default 0 |
| Reason | Yes (conditional) | Select: defective/damaged/expired/wrong_item/short_quantity/other | Only shown if rejected > 0 |
| Batch # | Yes | Input (text) | Optional |
| Expiry | Yes | Input (date) | Optional |

---

#### 2.7.3 GRN View

**Route:** `/console/modules/grn/grn/:id`  
**Source:** [GrnView.tsx](src/modules/grn/client/pages/grn/GrnView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-244 | The system shall display a 4-stage status timeline: Draft → Quality Inspection → Accepted → Stock Updated |
| FR-245 | Completed stages shown as green checkmarks; current as blue; future as gray |
| FR-246 | Action buttons shall change based on current status |
| FR-247 | The QI dialog shall provide Passed/Rejected toggle and a notes textarea |
| FR-248 | The quality inspection section (passed/failed result + notes) shall appear after QI is completed |
| FR-249 | QI passed: green background section; QI failed: red background section |
| FR-250 | The PO Number shall be a clickable link navigating to the PO view page |
| FR-251 | The "accepted → stock_updated" transition shall update PO item received quantities and change PO status |
| FR-252 | If all PO items fully received after stock update, PO status becomes 'fully_received'; otherwise 'partially_received' |
| FR-253 | Toast on stock update: "Stock updated. PO status changed to '{poStatus}'." |
| FR-254 | PDF download available for all statuses |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-136 | Status = 'draft' | Show: "Send to QI" (primary), "Accept (Skip QI)" (outline) |
| CR-137 | Status = 'quality_inspection' | Show: "Mark Accepted" (primary, opens QI dialog), "Back to Draft" (outline) |
| CR-138 | Status = 'accepted' | Show: "Update Stock" (primary) |
| CR-139 | Status = 'stock_updated' | No action buttons except "Download PDF" (terminal state) |
| CR-140 | QI completed (qualityCheckPassed not null) | Show quality inspection result section with passed/failed styling |
| CR-141 | QI not yet done | Hide quality inspection section |
| CR-142 | Any status | Show "Download PDF" button |

**QI Dialog Fields:**
| Field | Type | Notes |
|-------|------|-------|
| Passed/Rejected | Two buttons (toggle) | Default: Passed selected |
| Notes | Textarea (3 rows) | Placeholder: "Quality inspection notes..." |

**State Machine Transitions:**
| From | To | Trigger | Side Effect |
|------|-----|---------|-------------|
| draft | quality_inspection | "Send to QI" button | Status update only |
| draft | accepted | "Accept (Skip QI)" button | Skips QI step |
| quality_inspection | accepted | "Mark Accepted" + QI dialog | Stores qualityCheckPassed + qualityNotes |
| quality_inspection | draft | "Back to Draft" button | Reverts to draft |
| accepted | stock_updated | "Update Stock" button | Updates PO received quantities + PO status |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-013 | On accepted → stock_updated: for each GRN item, `purchaseOrderItem.receivedQuantity += grnItem.acceptedQuantity` (atomic SQL update) |
| BR-014 | After updating PO items, check if ALL PO items have `receivedQuantity >= quantity`; if yes, set PO status = 'fully_received'; otherwise 'partially_received' |
| BR-015 | Inventory update is stubbed: logged as "[STUB] Inventory update deferred to Phase 4" |
| BR-016 | GRN number auto-generated: format GRN-YYYYMM-NNNN using atomic upsert on grn_sequences table |

**Field Specifications — View Header:**
| Field | Source | Notes |
|-------|--------|-------|
| GRN Number | `goods_received_notes.grn_number` | Large, bold |
| Status | `goods_received_notes.status` | Color badge |
| Purchase Order | `purchase_orders.po_number` | Blue link to PO view |
| Supplier | `suppliers.name` + `suppliers.code` | Format: "Name (Code)" |
| Location | `locations.name` | "-" if null |
| Created By | `sys_user.fullname` | |
| Received Date | `goods_received_notes.received_date` | id-ID date format |
| Delivery Note Ref | `goods_received_notes.delivery_note_ref` | "-" if null |
| Invoice Ref | `goods_received_notes.invoice_ref` | "-" if null |
| Notes | `goods_received_notes.notes` | Full-width if present |

**Field Specifications — Items Table:**
| Field | Source | Notes |
|-------|--------|-------|
| Product | `grn_items.product_name` | |
| SKU | `grn_items.sku_code` | Muted text |
| Ordered | `grn_items.ordered_quantity` | Right-aligned |
| Prev Rcvd | `grn_items.previously_received_quantity` | Right-aligned |
| Received | `grn_items.received_quantity` | Right-aligned, bold |
| Accepted | `grn_items.accepted_quantity` | Right-aligned, green |
| Rejected | `grn_items.rejected_quantity` | Right-aligned, red; "-" if 0 |
| Reason | `grn_items.rejection_reason_code` | Mapped label |
| Batch # | `grn_items.batch_number` | "-" if null |
| Expiry | `grn_items.expiry_date` | Date format; "-" if null |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/grn/grn/:id` | Load GRN detail with items, PO, supplier, location, user |
| PUT | `/api/modules/grn/grn/:id/status` | Transition status (body: {status, qualityCheckPassed?, qualityNotes?}) |

---

### 2.8 Supplier Returns & Credit Notes

**Module ID:** `supplier-return`  
**Permissions:** `retail.supplier-return.view`, `retail.supplier-return.create`, `retail.supplier-return.transition`  
**API Base:** `/api/modules/supplier-return/`

**State Machine:** requested → pending_approval → approved → dispatched → acknowledged → credit_note_received → closed (+ rejected terminal)

#### 2.8.1 Return List

**Route:** `/console/modules/supplier-return/return`  
**Source:** [SupplierReturn.tsx](src/modules/supplier-return/client/pages/supplier-return/SupplierReturn.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-255 | Display paginated list of supplier returns with sorting and filtering |
| FR-256 | Support search by return number or supplier name (ILIKE, 500ms debounce) |
| FR-257 | Support filtering by status: all, requested, pending_approval, approved, dispatched, acknowledged, credit_note_received, closed, rejected |
| FR-258 | Support sorting by Return Number, Return Date, Status columns |
| FR-259 | Default sort: returnDate descending |
| FR-260 | Each row displays: row #, Return Number, GRN Number, Supplier, Return Date, Status (color badge), View action |
| FR-261 | "New Return" button navigates to Return Create page |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-098 | Page number must be >= 1 | Client |
| VR-099 | Search debounced 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-143 | User has ADMIN role + `retail.supplier-return.create` permission | Show "New Return" button |
| CR-144 | No returns found and not loading | Show "No supplier returns found." empty state |
| CR-145 | Loading state | Show loading dialog with spinner |
| CR-146 | Status filter = 'all' | Show all returns regardless of status |
| CR-147 | Search filter active | Show X clear icon; otherwise show search icon |

**Status Badge Colors:**
| Status | Color |
|--------|-------|
| requested | Gray |
| pending_approval | Yellow |
| approved | Blue |
| dispatched | Purple |
| acknowledged | Indigo |
| credit_note_received | Teal |
| closed | Green |
| rejected | Red |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-return/return` | List returns with pagination/filter/sort/status |

---

#### 2.8.2 Return Create

**Route:** `/console/modules/supplier-return/return/add`  
**Source:** [SupplierReturnAdd.tsx](src/modules/supplier-return/client/pages/supplier-return/SupplierReturnAdd.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-262 | The GRN dropdown shall only show GRNs with status 'accepted' or 'stock_updated' (fetched from two separate API calls and merged) |
| FR-263 | When a GRN is selected, display GRN info (Supplier, PO Number) and fetch returnable items from `GET /return/grn/{grnId}/returnable` |
| FR-264 | Each returnable item row shall display: Product, SKU, Accepted Qty, Already Returned, Returnable Qty (accepted - already returned), Return Qty (input), Reason Code (select), Reason Notes (input), UOM |
| FR-265 | The server shall calculate "already returned" by summing return quantities from all non-rejected previous returns for each GRN item |
| FR-266 | Only items with returnableQuantity > 0 shall appear in the items list |
| FR-267 | Return number auto-generated: format SR-YYYYMM-NNNN using atomic upsert on sr_sequences table |
| FR-268 | On success, navigate to list with toast: "Supplier return has been created." |
| FR-269 | Return created with initial status 'requested' |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-100 | GRN ID required (min 1 char) | Client + Server |
| VR-101 | Return Date required (min 1 char) | Client + Server |
| VR-102 | At least one item required | Client + Server |
| VR-103 | Each item with returnQuantity > 0 must have a reasonCode selected | Client |
| VR-104 | Return quantity for each item must not exceed returnable quantity | Server |
| VR-105 | GRN must exist and have status 'accepted' or 'stock_updated' | Server |
| VR-106 | Each GRN item must exist | Server |
| VR-107 | returnQuantity >= 0 for each item | Client (min 0) |
| VR-108 | productId, grnItemId must be valid UUIDs | Server (Zod) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-148 | No GRN selected | Show "Select a GRN to see returnable items." |
| CR-149 | Loading returnable items | Show "Loading returnable items..." |
| CR-150 | GRN selected but all items fully returned | Show "All items for this GRN have been fully returned." |
| CR-151 | Item returnQuantity > 0 | Show Reason Code dropdown and Reason Notes input for that row |
| CR-152 | Item returnQuantity = 0 | Hide Reason Code and Reason Notes for that row |
| CR-153 | No items loaded or isLoading | Disable "Create Return" button |

**Field Specifications — Header:**
| Field | Type | Source | Required | Default |
|-------|------|--------|----------|---------|
| GRN | Select | `goods_received_notes` (accepted/stock_updated) | Yes | "" |
| Return Date | Input (date) | — | Yes | today |
| Notes | Textarea | — | No | null |

**Field Specifications — Line Items (auto-populated):**
| Field | Editable | Source | Notes |
|-------|----------|--------|-------|
| Product | No | `grn_items.product_name` | Read-only |
| SKU | No | `grn_items.sku_code` | Read-only |
| Accepted Qty | No | `grn_items.accepted_quantity` | Read-only |
| Already Returned | No | Computed: sum from previous non-rejected returns | Read-only |
| Returnable Qty | No | Computed: accepted - already returned | Read-only |
| Return Qty | Yes | Input (number), max=returnable | Default 0 |
| Reason Code | Yes (conditional) | Select: defective/damaged/expired/excess/wrong_item | Only when returnQty > 0 |
| Reason Notes | Yes (conditional) | Input (text) | Optional, only when returnQty > 0 |
| UOM | No | Default 'pcs' | Read-only |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/grn/grn?perPage=1000&status=accepted` | Fetch accepted GRNs |
| GET | `/api/modules/grn/grn?perPage=1000&status=stock_updated` | Fetch stock_updated GRNs |
| GET | `/api/modules/supplier-return/return/grn/{grnId}/returnable` | Fetch returnable items for GRN |
| POST | `/api/modules/supplier-return/return` | Create supplier return |

---

#### 2.8.3 Return View

**Route:** `/console/modules/supplier-return/return/:id`  
**Source:** [SupplierReturnView.tsx](src/modules/supplier-return/client/pages/supplier-return/SupplierReturnView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-270 | Display a 7-stage status timeline: Requested → Pending Approval → Approved → Dispatched → Acknowledged → Credit Note Received → Closed |
| FR-271 | Completed stages shown as green checkmarks; current as blue; future as gray |
| FR-272 | If status = 'rejected', hide timeline and show red rejected banner with rejection reason |
| FR-273 | Action buttons shall change based on current status (see state transitions below) |
| FR-274 | Reject dialog shall require a rejection reason (textarea) |
| FR-275 | Credit Note dialog shall capture: credit note number, amount (IDR), credit date, isReplacement checkbox, notes |
| FR-276 | Credit notes section shall display as a table when creditNotes array has items |
| FR-277 | GRN number and PO number shall be clickable links navigating to their respective view pages |
| FR-278 | PDF download available for all statuses |
| FR-279 | On dispatched transition, set dispatchedAt timestamp |
| FR-280 | On acknowledged transition, set acknowledgedAt timestamp |
| FR-281 | On closed transition, set closedAt timestamp |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-154 | Status = 'requested' | Show: "Submit for Approval" (→ pending_approval), "Approve (Skip)" (→ approved), "Reject" (→ reject dialog) |
| CR-155 | Status = 'pending_approval' | Show: "Approve" (→ approved), "Reject" (→ reject dialog) |
| CR-156 | Status = 'approved' | Show: "Mark Dispatched" (→ dispatched) |
| CR-157 | Status = 'dispatched' | Show: "Mark Acknowledged" (→ acknowledged) |
| CR-158 | Status = 'acknowledged' | Show: "Record Credit Note" (→ credit note dialog), "Close (No Credit)" (→ closed) |
| CR-159 | Status = 'credit_note_received' | Show: "Add Credit Note" (→ credit note dialog), "Close Return" (→ closed) |
| CR-160 | Status = 'closed' or 'rejected' | No action buttons (terminal states) |
| CR-161 | User has ADMIN role + `retail.supplier-return.transition` permission | Show action buttons; otherwise hide |
| CR-162 | Credit notes array has items | Show credit notes table section |
| CR-163 | dispatchedAt populated | Show Dispatched At field |
| CR-164 | acknowledgedAt populated | Show Acknowledged At field |
| CR-165 | closedAt populated | Show Closed At field |
| CR-166 | notes populated | Show Notes field |

**State Machine Transitions:**
| From | To | Trigger | Side Effect |
|------|-----|---------|-------------|
| requested | pending_approval | "Submit for Approval" | Status update only |
| requested | approved | "Approve (Skip)" | Skips approval step |
| requested | rejected | "Reject" + reason | Stores rejectionReason |
| pending_approval | approved | "Approve" | Status update only |
| pending_approval | rejected | "Reject" + reason | Stores rejectionReason |
| approved | dispatched | "Mark Dispatched" | Sets dispatchedAt |
| dispatched | acknowledged | "Mark Acknowledged" | Sets acknowledgedAt |
| acknowledged | credit_note_received | "Record Credit Note" | Creates credit note record |
| acknowledged | closed | "Close (No Credit)" | Sets closedAt |
| credit_note_received | closed | "Close Return" | Sets closedAt |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-017 | Return number auto-generated: format SR-YYYYMM-NNNN using atomic upsert on sr_sequences table |
| BR-018 | Recording a credit note when status = 'acknowledged' automatically transitions status to 'credit_note_received' |
| BR-019 | Inventory decrement on dispatch is stubbed (logged, not yet implemented) |

**Reject Dialog Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Rejection Reason | Textarea | Yes | Free text |

**Credit Note Dialog Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Credit Note Number | Input (text) | Yes | min 1 char |
| Amount (IDR) | Input (number) | Yes | min 0, step 0.01 |
| Credit Date | Input (date) | Yes | Default: today |
| Is Replacement | Checkbox | No | "This is a replacement receipt (not a monetary credit)" |
| Notes | Textarea | No | Optional |

**Field Specifications — View Header:**
| Field | Source | Notes |
|-------|--------|-------|
| Return Number | `supplier_returns.return_number` | Large, bold |
| Status | `supplier_returns.status` | Color badge |
| GRN | `goods_received_notes.grn_number` | Clickable link |
| Purchase Order | `purchase_orders.po_number` | Clickable link |
| Supplier | `suppliers.name` + `suppliers.code` | Format: "Name (Code)" |
| Location | `locations.name` | "-" if null |
| Return Date | `supplier_returns.return_date` | id-ID date format |
| Created By | `sys_user.fullname` | |
| Created At | `supplier_returns.created_at` | Date/time format |
| Dispatched At | `supplier_returns.dispatched_at` | Conditional |
| Acknowledged At | `supplier_returns.acknowledged_at` | Conditional |
| Closed At | `supplier_returns.closed_at` | Conditional |
| Notes | `supplier_returns.notes` | Conditional |

**Field Specifications — Items Table:**
| Field | Source | Notes |
|-------|--------|-------|
| # | Row index | |
| Product | `supplier_return_items.product_name` | |
| SKU | `supplier_return_items.sku_code` | |
| Qty | `supplier_return_items.return_quantity` | |
| UOM | `supplier_return_items.uom` | |
| Reason | `supplier_return_items.reason_code` | Orange badge |
| Notes | `supplier_return_items.reason_notes` | "-" if null |

**Field Specifications — Credit Notes Table:**
| Field | Source | Notes |
|-------|--------|-------|
| # | Row index | |
| Credit Note # | `credit_notes.credit_note_number` | |
| Amount | `credit_notes.amount` | IDR currency format |
| Date | `credit_notes.credit_date` | |
| Type | `credit_notes.is_replacement` | Blue "Replacement" badge or Green "Credit" badge |
| Notes | `credit_notes.notes` | |
| Recorded By | `sys_user.fullname` | |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-return/return/:id` | Load return detail with items, GRN, PO, supplier, location, user, credit notes |
| PUT | `/api/modules/supplier-return/return/:id/status` | Transition status (body: {status, rejectionReason?}) |
| POST | `/api/modules/supplier-return/credit-note` | Record credit note (body: {supplierReturnId, creditNoteNumber, amount, creditDate, notes?, isReplacement}) |

---

#### 2.8.4 Credit Note List

**Route:** `/console/modules/supplier-return/credit-note`  
**Source:** [CreditNoteList.tsx](src/modules/supplier-return/client/pages/supplier-return/CreditNoteList.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-282 | Display paginated list of all credit notes |
| FR-283 | Support search by credit note number or return number (ILIKE, 500ms debounce) |
| FR-284 | Each row displays: row #, Credit Note #, Return # (linked to return view), Supplier, Amount (IDR), Date, Type (badge), Notes |
| FR-285 | Type column shows "Replacement" (blue badge) if isReplacement=true, else "Credit" (green badge) |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-109 | Page number must be >= 1 | Client |
| VR-110 | Search debounced 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-167 | No credit notes found and not loading | Show "No credit notes found." empty state |
| CR-168 | Loading state | Show loading dialog with spinner |
| CR-169 | Search filter active | Show X clear icon; otherwise show search icon |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/supplier-return/credit-note` | List credit notes with pagination/filter |

---

### 2.9 Point of Sale (POS)

**Module ID:** `pos`  
**Permissions:** `pos.sale.create`, `pos.transaction.view`, `pos.transaction.void`, `pos.inventory.view`, `pos.inventory.adjust`  
**API Base:** `/api/modules/pos/`

#### 2.9.1 POS Sales Screen

**Route:** `/pos` (full-screen, no sidebar — peer to `/console`)  
**Source:** [PosScreen.tsx](src/modules/pos/client/pages/pos/PosScreen.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-286 | Full-screen two-panel layout: product grid (left, ~60%) + cart (right, ~40%) with no console sidebar |
| FR-287 | Top bar shall display: location name, cashier name, shift status indicator, held transaction count badge, printer status icon, sync status icon, live clock, exit button |
| FR-288 | On mount, fetch active locations and prompt location selection if multiple locations available |
| FR-289 | After location selection, check for open shift; if none, auto-open Shift Dialog in 'open' mode (blocking) |
| FR-290 | Barcode scanner support via HID keyboard wedge detection: characters arriving < 100ms apart followed by Enter key are treated as barcode input |
| FR-291 | On barcode scan, lookup product via `GET /product/barcode-lookup/{barcode}`, validate status='active', fetch location-specific price, and add to cart (or increment quantity if already in cart) |
| FR-292 | Play success beep on successful barcode scan; error beep on failed scan |
| FR-293 | Keyboard shortcuts via usePosKeyboard hook: F1=Pay Cash, F2=Pay Card, F3=Pay QRIS, F4=Pay Transfer, F9=Toggle grid/list view, Esc=Clear cart |
| FR-294 | Session timeout: 5-minute idle triggers lock screen overlay (password re-authentication required to unlock) |
| FR-295 | Responsive layout: below 1024px width, show tab toggle between "Products" and "Cart" views (stacked); above 1024px, show side-by-side |
| FR-296 | Fetch active tax configuration on mount and pass to CartProvider for tax calculations |
| FR-297 | Hold current cart: POST to held transactions endpoint with cart data as JSONB, customer note, and total amount |
| FR-298 | Exit button navigates back to `/console/dashboard` |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-111 | Cannot proceed to sales without selecting a location | Client |
| VR-112 | Cannot proceed to sales without an open shift | Client + Server |
| VR-113 | Barcode must match an active product | Server (404 if not found) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-170 | Multiple locations available | Show location picker dialog on mount |
| CR-171 | Single location available | Auto-select location |
| CR-172 | No open shift for selected location | Show "Open Shift" dialog (blocking) |
| CR-173 | Shift is open | Show shift close/cash-drop buttons in top bar |
| CR-174 | Screen width < 1024px | Show Products/Cart tab toggle (stacked layout) |
| CR-175 | Screen width >= 1024px | Show side-by-side layout |
| CR-176 | Idle > 5 minutes | Show lock screen overlay |
| CR-177 | Cart has items | Enable Hold button |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/location-management/location` | Fetch active locations |
| GET | `/api/modules/tax-configuration/config/active` | Fetch active tax config |
| GET | `/api/modules/product-catalog/product/barcode-lookup/{barcode}` | Barcode product lookup |
| GET | `/api/modules/product-catalog/product/{id}` | Get location-specific pricing |
| POST | `/api/modules/pos/transaction/hold` | Hold current cart |

---

#### 2.9.2 Product Grid

**Source:** [ProductGrid.tsx](src/modules/pos/client/pages/pos/ProductGrid.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-299 | Display searchable product grid with category tab filtering |
| FR-300 | Search input auto-focuses on mount; queries product name and SKU code (ILIKE) |
| FR-301 | Category tabs show level-1 active categories plus "All" tab |
| FR-302 | Grid view: responsive columns (2 cols mobile, 3 sm, 4 md, 5 lg); minimum tile size 120px |
| FR-303 | List view: single-column rows with product details; minimum row height 48px |
| FR-304 | Toggle between grid and list view via button (or F9 keyboard shortcut) |
| FR-305 | Each product tile/row shows: name, selling price (location-override if exists), image (or placeholder), stock quantity |
| FR-306 | Offline-aware: uses `useOfflineProducts` hook — online fetches from API, offline queries Dexie IndexedDB |
| FR-307 | Clicking a product adds it to cart (or increments quantity if already present) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-178 | Product qtyOnHand <= 0 | Show "Out of stock" indicator on tile |
| CR-179 | Product has primary image | Show image; otherwise show placeholder icon |
| CR-180 | Location-specific price exists | Override base selling_price with location price |
| CR-181 | Category selected (not "All") | Filter products by categoryId |

**Field Specifications:**
| Field | Source Entity | Column | Notes |
|-------|--------------|--------|-------|
| Search | — | — | Queries products.name and products.sku_code via ILIKE |
| Category Tabs | `categories` | `id`, `name` | Level-1 categories, status=active |
| Product Name | `products` | `name` | |
| Price | `products` | `selling_price` | Overridden by `product_location_prices.selling_price` if exists |
| Image | `product_images` | `image_url` | Primary image (is_primary=true) |
| Stock | `inventory` | `qty_on_hand` | Per-location; "Out of stock" if <= 0 |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/transaction/products` | Search products for POS grid |
| GET | `/api/modules/pos/transaction/categories` | Get active categories |

---

#### 2.9.3 Cart Panel

**Source:** [CartPanel.tsx](src/modules/pos/client/pages/pos/CartPanel.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-308 | Display cart items with quantity controls, per-item discount, and line totals |
| FR-309 | Quantity controls: minus button, numeric input (min 1), plus button; touch targets 40px minimum |
| FR-310 | Item discount via popover: select type (percent or fixed Rp), enter value, Apply/Clear buttons |
| FR-311 | Transaction-level discount via popover: same percent/fixed selection, applied to subtotal |
| FR-312 | Cart header shows item count badge and Clear All button |
| FR-313 | Cart footer shows: Subtotal, Discount (if any, green), Tax/PPN (if any), Grand Total (bold, large) |
| FR-314 | Line total computed: qty × unitPrice - itemDiscount |
| FR-315 | Item discount (percent): qty × unitPrice × percent / 100 |
| FR-316 | Item discount (fixed): min(fixedValue × qty, qty × unitPrice) — capped at line gross |
| FR-317 | Pay button opens Checkout Dialog; Hold button parks current cart |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-114 | Quantity minimum 1 per item | Client |
| VR-115 | Discount value must be > 0 to apply (0 or negative clears discount) | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-182 | Cart empty | Show empty state: "Cart is empty / Add products to get started"; disable Pay and Hold buttons |
| CR-183 | Cart has items | Show Clear button in header; enable Pay and Hold buttons |
| CR-184 | Item has discount with value > 0 | Show green discount text below item: "Discount: X%" or "Discount: Rp X/item" |
| CR-185 | Total discount (item + transaction) > 0 | Show Discount row in footer (green text) |
| CR-186 | Tax amount > 0 | Show Tax (PPN) row in footer |

**Tax Calculation Logic (via CartProvider):**
| Mode | Calculation |
|------|-------------|
| Exclusive | tax = afterDiscount × taxRate; total = subtotal + tax |
| Inclusive | tax = afterDiscount - (afterDiscount / (1 + taxRate)); total = subtotal (tax already included) |

**Entity References:** `products`, `categories`, `product_location_prices`, `inventory`, `tax_configs`

---

#### 2.9.4 Checkout Dialog

**Source:** [CheckoutDialog.tsx](src/modules/pos/client/pages/pos/CheckoutDialog.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-318 | Split payment dialog supporting multiple payment methods: Cash, Card, QRIS, Transfer |
| FR-319 | For each payment line: method, amount, payment reference (non-cash), amount tendered (cash only) |
| FR-320 | Running balance display: shows "Remaining: Rp X" or "Fully Paid" as payments are added |
| FR-321 | Quick amount buttons: suggest rounded-up amounts (10k, 50k, 100k denominations) |
| FR-322 | "Pay Full" shortcut per method: adds a single payment covering the entire remaining balance |
| FR-323 | Cash change calculation: sum of (amountTendered - amount) across cash payment lines |
| FR-324 | On checkout, POST to `/transaction/checkout` with items, payments, transactionDiscount, notes |
| FR-325 | Server creates: pos_transaction + pos_transaction_items + pos_transaction_payments; decrements inventory.qty_on_hand for each item |
| FR-326 | Transaction ID auto-generated using pos_sequences: format {LOC}-{YYYYMMDD}-{NNNN} |
| FR-327 | On success, show completion screen: Transaction ID, total, payment breakdown, change amount |
| FR-328 | Completion screen buttons: Print Receipt (thermal), Download PDF, New Sale (clears cart and closes dialog) |
| FR-329 | Auto-print receipt on checkout if thermal printer is connected |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-116 | At least one payment method required | Client + Server |
| VR-117 | Total payment amount must >= grand total | Client + Server |
| VR-118 | Cash amount tendered must >= cash payment amount | Client |
| VR-119 | Payment amount must be > 0 | Client |
| VR-120 | Open shift required | Server (400) |
| VR-121 | At least one item required | Server (Zod min 1) |
| VR-122 | Each item: quantity >= 1, unitPrice >= 0 | Server (Zod) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-187 | Payment method = 'cash' | Show "Amount Tendered" input field |
| CR-188 | Payment method != 'cash' | Show "Payment Reference" input field |
| CR-189 | remaining <= 0 && payments.length > 0 | Enable "Complete Sale" button |
| CR-190 | remaining > 0 or no payments | Disable "Complete Sale" button |
| CR-191 | Checkout successful | Show completion screen with transaction details |
| CR-192 | Checkout failed | Show error toast |
| CR-193 | Printer connected | Auto-print receipt on successful checkout |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-020 | On checkout: for each item, decrement `inventory.qty_on_hand` by item quantity (atomic SQL with INSERT ON CONFLICT) |
| BR-021 | Transaction ID generated per-location per-date using pos_sequences atomic upsert |
| BR-022 | Tax calculated server-side using `calculatePosTransaction`: per-item tax based on taxApplicable flag, tax rate, and calc mode (inclusive/exclusive) |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/pos/transaction/checkout` | Complete sale transaction |

---

#### 2.9.5 Shift Dialog

**Source:** [ShiftDialog.tsx](src/modules/pos/client/pages/pos/ShiftDialog.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-330 | Three dialog modes: Open Shift, Close Shift, Cash Drop |
| FR-331 | Open Shift: capture opening float amount and create new shift record |
| FR-332 | Close Shift: display expected cash (computed from shift summary), capture actual cash counted, auto-calculate variance, capture variance reason (if applicable), optional notes |
| FR-333 | Cash Drop: capture drop amount and reason, create cash drop record linked to current shift |
| FR-334 | Server validates no existing open shift for user before opening new one |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-123 | Opening float >= 0 | Client + Server |
| VR-124 | Actual cash >= 0 on close | Client + Server |
| VR-125 | Variance reason required if variance > 0.01 | Client |
| VR-126 | Cash drop amount must be > 0 | Client + Server |
| VR-127 | Cash drop reason required (min 1 char) | Client + Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-194 | mode = 'open' | Show opening float input |
| CR-195 | mode = 'close' | Show expected cash (read-only), actual cash input, variance display, reason field |
| CR-196 | mode = 'cash-drop' | Show amount input and reason input |
| CR-197 | Variance > 0.01 | Show variance in red; require reason |
| CR-198 | Variance = 0 | Show variance in green; reason optional |

**Open Shift Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Opening Float | Input (number) | No | 0 |

**Close Shift Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Expected Cash | Display (computed) | — | From shift summary |
| Actual Cash | Input (number) | Yes | — |
| Variance | Display (computed) | — | actual - expected |
| Variance Reason | Textarea | Conditional | "" |
| Notes | Textarea | No | "" |

**Cash Drop Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Amount | Input (number) | Yes | — |
| Reason | Input (text) | Yes | — |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/pos/shift/open` | Open new shift |
| GET | `/api/modules/pos/shift/current` | Get current open shift with summary stats |
| POST | `/api/modules/pos/shift/:id/close` | Close shift |
| POST | `/api/modules/pos/shift/:id/cash-drop` | Record cash drop |

---

#### 2.9.6 Held Transactions

**Source:** [HeldTransactions.tsx](src/modules/pos/client/pages/pos/HeldTransactions.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-335 | Display held transaction count as badge on top bar button |
| FR-336 | Open side drawer listing all held transactions for current location |
| FR-337 | Each held item shows: customer note, item count, total amount, age (e.g., "5m ago", "2h 15m ago") |
| FR-338 | Recall action: load held cart data back into current cart and delete held record |
| FR-339 | Release action: delete held transaction without restoring to cart |
| FR-340 | Held transactions stored as JSONB in `pos_held_transactions` with 24-hour expiry |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-199 | No held transactions | Badge hidden or shows 0 |
| CR-200 | Held transactions exist | Badge shows count; drawer lists items |
| CR-201 | Recall with non-empty current cart | Current cart is replaced by recalled cart |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/pos/transaction/hold` | Hold current cart |
| GET | `/api/modules/pos/transaction/held` | List held transactions (with locationId) |
| POST | `/api/modules/pos/transaction/held/:id/recall` | Recall held cart |
| DELETE | `/api/modules/pos/transaction/held/:id` | Release (delete) held transaction |

---

#### 2.9.7 Lock Screen

**Source:** [LockScreen.tsx](src/modules/pos/client/pages/pos/LockScreen.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-341 | Full-screen overlay with backdrop blur, triggered after 5-minute idle |
| FR-342 | Display lock icon, "Session Locked" heading, and current user's name |
| FR-343 | Password input field with submit button to re-authenticate |
| FR-344 | Re-authentication via POST `/api/auth/login` with current username and entered password |
| FR-345 | On successful unlock, dismiss overlay and resume POS session — cart and shift are preserved |
| FR-346 | On failed unlock, display "Invalid password" error message |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-128 | Password field must not be empty | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-202 | visible = false | Component returns null (not rendered) |
| CR-203 | visible = true | Show full-screen lock overlay |
| CR-204 | Loading (authenticating) | Disable Unlock button; show spinner |
| CR-205 | Authentication failed | Show "Invalid password" error |

---

#### 2.9.8 Printer Status

**Source:** [PrinterStatus.tsx](src/modules/pos/client/pages/pos/PrinterStatus.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-347 | Popover showing thermal printer connection status and configuration |
| FR-348 | Configuration: paper width selector (58mm/80mm), connection type selector (USB/Serial) |
| FR-349 | Connect/Disconnect button for printer management |
| FR-350 | Test Print button (available when connected) to verify printer functionality |
| FR-351 | Uses WebUSB or WebSerial browser APIs for printer communication |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-206 | Browser is not Chrome/Chromium | Show "Chrome required" warning |
| CR-207 | WebUSB/WebSerial not supported | Show "Not supported" message |
| CR-208 | Printer connected | Icon green; show Disconnect + Test Print buttons |
| CR-209 | Printer disconnected | Icon gray; show Connect button |
| CR-210 | Printer connecting | Icon yellow; show connecting state |
| CR-211 | Printer error | Icon red; show error message |

**Status Icon Colors:**
| Status | Color |
|--------|-------|
| connected | green-500 |
| disconnected | gray-400 |
| connecting | yellow-500 |
| printing | blue-500 |
| error | red-500 |

---

#### 2.9.9 Sync Status

**Source:** [SyncStatus.tsx](src/modules/pos/client/pages/pos/SyncStatus.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-352 | Popover showing online/offline status and sync queue statistics |
| FR-353 | Queue stats display: pending, syncing, synced, failed counts |
| FR-354 | Last sync timestamp display |
| FR-355 | "Full Sync" button: triggers push + pull sync cycle |
| FR-356 | "Force Push" button: pushes all pending offline transactions |
| FR-357 | Sync push uses UUID-based deduplication to prevent duplicate transaction creation |
| FR-358 | Sync pull downloads: products, categories, tax config, inventory (filtered by lastPullTimestamp) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-212 | Online | Show green online indicator |
| CR-213 | Offline | Show red offline indicator |
| CR-214 | Pending queue >= 2000 | Show yellow warning message |
| CR-215 | Pending > 0 | Show "Force Push" button |
| CR-216 | Syncing in progress | Disable sync buttons; show spinner |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/modules/pos/sync/push` | Push offline transactions to server |
| POST | `/api/modules/pos/sync/pull` | Pull latest data from server |

---

#### 2.9.10 Transaction List

**Route:** `/console/modules/pos/transaction`  
**Source:** [TransactionList.tsx](src/modules/pos/client/pages/transactions/TransactionList.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-359 | Display paginated list of POS transactions with sorting and filtering |
| FR-360 | Support search by transaction ID (ILIKE, 500ms debounce) |
| FR-361 | Support filtering by status: All, Completed, Voided |
| FR-362 | Support sorting by: transactionId, totalAmount, status, createdAt |
| FR-363 | Default sort: createdAt descending |
| FR-364 | Each row displays: row #, Transaction ID (link to detail), Location, Cashier, Total (IDR), Payment method, Status (badge), Date, View action |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-217 | Status = 'completed' | Green badge |
| CR-218 | Status = 'voided' | Red badge |
| CR-219 | Status = 'open' | Yellow badge |
| CR-220 | No transactions found | Show empty state message |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/transaction` | List transactions with pagination/filter/sort/status |

---

#### 2.9.11 Transaction View

**Route:** `/console/modules/pos/transaction/:id`  
**Source:** [TransactionView.tsx](src/modules/pos/client/pages/transactions/TransactionView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-365 | Display transaction header: Transaction ID (monospace), Status badge, Location, Cashier, Payment methods, Date |
| FR-366 | Display totals summary: Subtotal, Discount (green), Tax/PPN, Total (large bold) |
| FR-367 | Display line items table: #, Product, SKU, Unit Price, Qty, Discount, Tax, Total |
| FR-368 | Display payments breakdown table: #, Method, Amount, Tendered, Change, Reference |
| FR-369 | Void Transaction button with confirmation dialog requiring void reason |
| FR-370 | Void action: changes status to 'voided', restores inventory (qty_on_hand incremented), records void reason and voider identity |
| FR-371 | Reprint Receipt button: logs reprint in audit log, returns full transaction data |
| FR-372 | Download PDF button for all statuses |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-129 | Void reason required (min 1 char) | Client + Server |
| VR-130 | Only 'completed' transactions can be voided | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-221 | Status = 'completed' + user has ADMIN role + pos.transaction.void permission | Show "Void Transaction" button |
| CR-222 | Status = 'voided' | Show void banner with reason, voider name, and void timestamp |
| CR-223 | Status != 'completed' | Hide Void button |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-023 | On void: for each transaction item, increment `inventory.qty_on_hand` by item quantity (restoring stock) |
| BR-024 | Void records: voidReason, voidedBy (user ID), voidedAt (timestamp) on pos_transactions |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/transaction/:id` | Load transaction detail with items, payments, location, cashier |
| POST | `/api/modules/pos/transaction/:id/void` | Void transaction (body: {voidReason}) |
| POST | `/api/modules/pos/transaction/:id/reprint` | Log reprint and return transaction data |

---

#### 2.9.12 Shift List

**Route:** `/console/modules/pos/shift`  
**Source:** [ShiftList.tsx](src/modules/pos/client/pages/shifts/ShiftList.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-373 | Display paginated list of POS shifts |
| FR-374 | Support filtering by status: All, Open, Closed |
| FR-375 | Each row displays: row #, Cashier, Location, Status (badge), Opened (date/time), Closed (date/time), Opening Float (IDR), Expected Cash (IDR), Actual Cash (IDR), Variance (IDR, color-coded), View action |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-224 | Status = 'open' | Green badge |
| CR-225 | Status = 'closed' | Gray badge |
| CR-226 | Variance < 0 | Red text |
| CR-227 | Variance > 0 | Green text |
| CR-228 | Shift not yet closed | Closed, Expected Cash, Actual Cash, Variance columns show "-" |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/shift` | List shifts with pagination and status filter |

---

#### 2.9.13 Shift View

**Route:** `/console/modules/pos/shift/:id`  
**Source:** [ShiftView.tsx](src/modules/pos/client/pages/shifts/ShiftView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-376 | Display shift header: Status badge, Cashier name, Location, Opened date/time, Closed date/time, Closed By, Notes |
| FR-377 | Display cash summary section: Opening Float, Expected Cash, Actual Cash, Variance (color-coded), Sales Count |
| FR-378 | Display variance reason in yellow background section if variance exists |
| FR-379 | Display cash drops table if any: #, Amount (IDR), Reason, Time |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-229 | Shift closed | Show all cash summary fields |
| CR-230 | Shift open | Show Opening Float and current summary only |
| CR-231 | Variance exists (non-zero) | Show variance reason section (yellow background) |
| CR-232 | Cash drops exist | Show cash drops table |
| CR-233 | No cash drops | Hide cash drops section |
| CR-234 | Notes populated | Show notes field |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/pos/shift/:id` | Load shift detail with cashier, closedByUser, location, cashDrops, summary |

---

### 2.10 Inter-Shop Transfers

**Module ID:** `transfer`  
**Permissions:** `retail.transfer.view`, `retail.transfer.create`, `retail.transfer.transition`  
**API Base:** `/api/modules/transfer/transfer`

**State Machine:** requested → pending_approval → approved → picking → dispatched → received → closed (7 states)

#### 2.10.1 Transfer List

**Route:** `/console/modules/transfer/transfer`  
**Source:** [Transfer.tsx](src/modules/transfer/client/pages/transfer/Transfer.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-380 | Display paginated list of transfers with sorting and filtering |
| FR-381 | Support search by transfer number (ILIKE, 500ms debounce) |
| FR-382 | Support filtering by status: all, requested, pending_approval, approved, picking, dispatched, received, closed |
| FR-383 | Support sorting by: transferNumber, status, createdAt |
| FR-384 | Default sort: createdAt descending |
| FR-385 | Each row displays: Transfer # (link to detail), From location, To location, Requested By, Status (color badge), Date |
| FR-386 | "New Transfer" button navigates to Transfer Create page |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-131 | Page number must be >= 1 | Client |
| VR-132 | Search debounced 500ms | Client |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-235 | User has ADMIN role + `retail.transfer.create` permission | Show "New Transfer" button |
| CR-236 | No transfers found and not loading | Show empty state message |
| CR-237 | Loading state | Show loading dialog with spinner |
| CR-238 | Status filter = 'all' | Show all transfers regardless of status |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/transfer/transfer` | List transfers with pagination/filter/sort/status |

---

#### 2.10.2 Transfer Create

**Route:** `/console/modules/transfer/transfer/add`  
**Source:** [TransferAdd.tsx](src/modules/transfer/client/pages/transfer/TransferAdd.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-387 | Form to create a new inter-shop transfer with source location, destination location, notes, and dynamic item list |
| FR-388 | Location dropdowns populated from active locations (format: "{code} - {name}") |
| FR-389 | Product selector dropdown showing all active products (format: "{skuCode} - {name}") |
| FR-390 | Dynamic item rows: add products with requested quantity; remove individual items |
| FR-391 | Duplicate product detection: toast error if same product added twice |
| FR-392 | Transfer created with initial status 'requested' |
| FR-393 | Transfer number auto-generated: format TRF-YYYYMM-NNNN using atomic upsert on transfer_sequences table |
| FR-394 | On success, navigate to list with success toast |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-133 | Source location required (UUID) | Client + Server |
| VR-134 | Destination location required (UUID) | Client + Server |
| VR-135 | Source and destination must be different locations | Client + Server |
| VR-136 | At least one item required | Client + Server |
| VR-137 | Each item: requestedQty must be integer >= 1 | Client + Server |
| VR-138 | Each item: productId must be valid UUID | Server |
| VR-139 | No duplicate products in items list | Client (toast error) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-239 | No items added | Disable "Create Transfer" button |
| CR-240 | Items added and not loading | Enable "Create Transfer" button |
| CR-241 | isLoading | Disable submit button; show loading state |

**Field Specifications:**
| Field | Type | Source | Required | Default |
|-------|------|--------|----------|---------|
| Source Location | Select | `locations` (active) | Yes | "" |
| Destination Location | Select | `locations` (active) | Yes | "" |
| Notes | Textarea (2 rows) | — | No | null |
| Product (per item) | Select | `products` (active) | Yes | — |
| Requested Qty (per item) | Input (number) | — | Yes | 1 |
| UOM (per item) | Hidden | — | — | 'pcs' |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/location-management/location` | Fetch active locations |
| GET | `/api/modules/product-catalog/product` | Fetch active products |
| POST | `/api/modules/transfer/transfer` | Create transfer |

---

#### 2.10.3 Transfer View

**Route:** `/console/modules/transfer/transfer/:id`  
**Source:** [TransferView.tsx](src/modules/transfer/client/pages/transfer/TransferView.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-395 | Display a 7-stage status timeline: Requested → Pending Approval → Approved → Picking → Dispatched → Received → Closed |
| FR-396 | Completed stages shown as green checkmarks; current as blue; future as gray |
| FR-397 | Action buttons shall change based on current status (see state transitions below) |
| FR-398 | Items table shows: Product, SKU, Requested Qty, Picked Qty, Received Qty, Discrepancy (color-coded), Reason |
| FR-399 | PDF download available for all statuses |
| FR-400 | Date formatting: "7 Apr 2026" for dates, "7 Apr 2026, 14:30" for timestamps |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-242 | Status = 'requested' | Show: "Submit for Approval" (→ pending_approval), "Approve (Skip)" (→ approved) |
| CR-243 | Status = 'pending_approval' | Show: "Approve" (→ approved) |
| CR-244 | Status = 'approved' | Show: "Start Picking" (→ picking) |
| CR-245 | Status = 'picking' | Show: "Dispatch" (→ dispatched) |
| CR-246 | Status = 'dispatched' | Show: "Receive" (→ received) |
| CR-247 | Status = 'received' | Show: "Close" (→ closed) |
| CR-248 | Status = 'closed' | No action buttons (terminal state) |
| CR-249 | User has ADMIN role + `retail.transfer.transition` permission | Show action buttons; otherwise hide |
| CR-250 | approvedAt populated | Show Approved At and Approved By fields |
| CR-251 | dispatchedAt populated | Show Dispatched At field |
| CR-252 | receivedAt populated | Show Received At field |
| CR-253 | notes populated | Show Notes field |
| CR-254 | Discrepancy < 0 for an item | Red text |
| CR-255 | Discrepancy > 0 for an item | Yellow text |
| CR-256 | Picked/Received qty is null | Show "-" in column |
| CR-257 | transitioning = true | Disable all action buttons |

**State Machine Transitions:**
| From | To | Trigger | Side Effect |
|------|-----|---------|-------------|
| requested | pending_approval | "Submit for Approval" | Status update only |
| requested | approved | "Approve (Skip)" | Sets approvedBy, approvedAt |
| pending_approval | approved | "Approve" | Sets approvedBy, approvedAt |
| approved | picking | "Start Picking" | Updates pickedQty per item (if pickItems provided) |
| picking | dispatched | "Dispatch" | Sets dispatchedAt; inventory effects (see below) |
| dispatched | received | "Receive" | Sets receivedAt; inventory effects + discrepancy calc |
| received | closed | "Close" | Sets closedAt |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-025 | On picking → dispatched: for each item, qty = pickedQty or requestedQty; source `inventory.qty_on_hand` decremented by qty; dest `inventory.in_transit` incremented by qty |
| BR-026 | On dispatched → received: for each item, receivedQty from receiveItems (or default to pickedQty/requestedQty); expectedQty = pickedQty or requestedQty; discrepancy = receivedQty - expectedQty |
| BR-027 | On received: dest `inventory.in_transit` decremented by expectedQty (clamped to 0 via GREATEST); dest `inventory.qty_on_hand` incremented by receivedQty |
| BR-028 | Discrepancy reason auto-calculated: 'short' if negative, 'over' if positive, null if zero |
| BR-029 | Transfer number auto-generated: format TRF-YYYYMM-NNNN using atomic upsert on transfer_sequences table |

**Field Specifications — View Header:**
| Field | Source | Notes |
|-------|--------|-------|
| Transfer Number | `transfers.transfer_number` | Large, bold |
| Status | `transfers.status` | Color badge |
| Source Location | `locations.name` (source) | Format: "{code} - {name}" |
| Destination Location | `locations.name` (dest) | Format: "{code} - {name}" |
| Requested By | `sys_user.fullname` | |
| Approved By | `sys_user.fullname` | Conditional |
| Approved At | `transfers.approved_at` | Conditional |
| Dispatched At | `transfers.dispatched_at` | Conditional |
| Received At | `transfers.received_at` | Conditional |
| Notes | `transfers.notes` | Conditional |

**Field Specifications — Items Table:**
| Field | Source | Notes |
|-------|--------|-------|
| # | Row index | |
| Product | `transfer_items.product_name` | |
| SKU | `transfer_items.sku_code` | |
| Requested | `transfer_items.requested_qty` | Right-aligned |
| Picked | `transfer_items.picked_qty` | "-" if null |
| Received | `transfer_items.received_qty` | "-" if null |
| Discrepancy | `transfer_items.discrepancy_qty` | Red if negative, yellow if positive, "-" if null |
| Reason | `transfer_items.discrepancy_reason` | short/over/damaged; "-" if null |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/transfer/transfer/:id` | Load transfer detail with locations, users, items, availableTransitions |
| PUT | `/api/modules/transfer/transfer/:id/status` | Transition status (body: {status, receiveItems?, pickItems?}) |

---

### 2.11 Inventory Management

**Module ID:** `inventory-management`  
**Permissions:** `retail.inventory.view`, `retail.inventory.count`, `retail.inventory.adjust`, `retail.inventory.alerts`  
**API Base:** `/api/modules/inventory-management/`

#### 2.11.1 Stock Count List

**Route:** `/console/modules/inventory-management/stock-count`  
**Source:** [StockCountList.tsx](src/modules/inventory-management/client/pages/stock-count/StockCountList.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-401 | Display paginated list of stock count sessions |
| FR-402 | Each row displays: Location, Status (color badge), Started (date/time), Finalized (date/time), Started By |
| FR-403 | "New Count" button opens location selection dialog |
| FR-404 | On create: fetch all active products, get current inventory for selected location, create stock count session with status 'in_progress', auto-populate stock count lines with system quantities |
| FR-405 | Navigate to Stock Count Session page on successful creation |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-140 | Location must be selected before creating stock count | Client (toast error) |
| VR-141 | locationId must be valid UUID | Server (Zod) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-258 | User has ADMIN role + `retail.inventory.count` permission | Show "New Count" button |
| CR-259 | Loading state | Show loading dialog with spinner |
| CR-260 | No stock counts | Show "No stock counts." empty state |

**Status Badge Colors:**
| Status | Color |
|--------|-------|
| draft | Gray |
| in_progress | Yellow |
| finalized | Green |
| cancelled | Red |

**Create Dialog Fields:**
| Field | Type | Required | Source |
|-------|------|----------|--------|
| Location | Select | Yes | `locations` (active, status='active') |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/stock-count` | List stock counts with pagination |
| POST | `/api/modules/inventory-management/stock-count` | Create new stock count session |
| GET | `/api/modules/location-management/location` | Fetch active locations |

---

#### 2.11.2 Stock Count Session

**Route:** `/console/modules/inventory-management/stock-count/:id`  
**Source:** [StockCountSession.tsx](src/modules/inventory-management/client/pages/stock-count/StockCountSession.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-406 | Display stock count detail: Location, Status, Items count, Started By |
| FR-407 | Display items table with system quantities and editable counted quantities |
| FR-408 | Variance auto-computed: countedQty - systemQty for each line |
| FR-409 | "Save Counts" button: saves all entered counted quantities via PUT endpoint |
| FR-410 | "Finalize" button: finalizes count session, updates inventory, creates adjustment records and inventory movements for all lines with variance != 0 |
| FR-411 | On finalize: sets status to 'finalized', records finalizedBy and finalizedAt |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-142 | countedQty must be >= 0 | Client (min=0) + Server |
| VR-143 | At least one line required for save | Server (Zod min 1) |
| VR-144 | Stock count must not already be finalized | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-261 | Status != 'finalized' | Show editable input for countedQty; show "Save Counts" and "Finalize" buttons |
| CR-262 | Status = 'finalized' | Show countedQty as read-only text; hide Save and Finalize buttons |
| CR-263 | Variance > 0 | Green text with "+" prefix |
| CR-264 | Variance < 0 | Red text |
| CR-265 | Variance = 0 or countedQty not yet entered | Default text color or "-" |

**Server-Side Business Rules:**
| # | Rule |
|---|------|
| BR-030 | On finalize: for each line where countedQty != null and variance != 0: (a) upsert inventory with countedQty; (b) create stock_adjustment (reasonCode: 'correction'); (c) create inventory_movement (movementType: 'stock_count') |

**Field Specifications — Items Table:**
| Field | Editable | Source | Notes |
|-------|----------|--------|-------|
| Product | No | `stock_count_lines.product_name` | Read-only |
| SKU | No | `stock_count_lines.sku_code` | Read-only |
| System Qty | No | `stock_count_lines.system_qty` | From inventory.qty_on_hand at creation |
| Counted Qty | Yes (if not finalized) | Input (number, min=0) | User enters physical count |
| Variance | No | Computed: counted - system | Color-coded |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/stock-count/:id` | Load stock count with lines |
| PUT | `/api/modules/inventory-management/stock-count/:id/lines` | Save counted quantities |
| POST | `/api/modules/inventory-management/stock-count/:id/finalize` | Finalize count and update inventory |

---

#### 2.11.3 Adjustment List

**Route:** `/console/modules/inventory-management/adjustment`  
**Source:** [AdjustmentList.tsx](src/modules/inventory-management/client/pages/adjustment/AdjustmentList.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-412 | Display paginated list of stock adjustments |
| FR-413 | Each row displays: Product, SKU, Location, Qty (color-coded), Reason (orange badge), Adjusted By, Date |
| FR-414 | "New Adjustment" button opens creation dialog |
| FR-415 | On create: update inventory.qty_on_hand (insert on conflict), create stock_adjustments record, create inventory_movements record (type: 'adjustment') |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-145 | Location required | Client + Server (UUID) |
| VR-146 | Product required | Client + Server (UUID) |
| VR-147 | Quantity required and cannot be zero | Client + Server (Zod refine: v !== 0) |
| VR-148 | Reason code required: damage/theft/write_off/correction/other | Client + Server (Zod enum) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-266 | User has ADMIN role + `retail.inventory.adjust` permission | Show "New Adjustment" button |
| CR-267 | Qty > 0 | Green text (positive adjustment) |
| CR-268 | Qty < 0 | Red text (negative adjustment) |
| CR-269 | No adjustments | Show "No adjustments." empty state |

**Create Dialog Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Location | Select | Yes | Active locations |
| Product | Select | Yes | Active products |
| Quantity (+ or -) | Input (number) | Yes | Placeholder: "e.g. -5 or +10" |
| Reason | Select | Yes | damage/theft/write_off/correction/other |
| Notes | Textarea (2 rows) | No | Placeholder: "Details..." |

**Reason Labels:**
| Code | Display |
|------|---------|
| damage | Damage |
| theft | Theft |
| write_off | Write-off |
| correction | Correction |
| other | Other |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/adjustment` | List adjustments with pagination |
| POST | `/api/modules/inventory-management/adjustment` | Create adjustment (updates inventory + creates movement) |

---

#### 2.11.4 Movement Ledger

**Route:** `/console/modules/inventory-management/movement`  
**Source:** [MovementLedger.tsx](src/modules/inventory-management/client/pages/movement/MovementLedger.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-416 | Display paginated list of inventory movements (20 per page) |
| FR-417 | Each row displays: Product, SKU, Location, Type (color-coded label), Qty (color-coded), Balance After, Date |
| FR-418 | Support filtering by movement type dropdown |
| FR-419 | When type filter changes, reset to page 1 and reload |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-270 | Type filter = 'all' | Show all movements; omit movementType param |
| CR-271 | Type filter set to specific type | Filter by that movement type |
| CR-272 | Qty > 0 | Green text |
| CR-273 | Qty < 0 | Red text |
| CR-274 | No movements | Show "No movements." empty state |

**Movement Type Colors:**
| Type | Color | Label |
|------|-------|-------|
| sale | Red | Sale |
| return | Blue | Return |
| grn | Green | GRN |
| transfer_out | Purple | Transfer Out |
| transfer_in | Teal | Transfer In |
| adjustment | Orange | Adjustment |
| stock_count | Indigo | Stock Count |
| opening_balance | Gray | Opening |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/movement` | List movements with pagination and optional type filter |

---

#### 2.11.5 Low-Stock Alerts

**Route:** `/console/modules/inventory-management/alerts`  
**Source:** [AlertConfig.tsx](src/modules/inventory-management/client/pages/alerts/AlertConfig.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-420 | Display active low-stock alerts as a red banner at top of page |
| FR-421 | Each alert shows: product name (SKU), location name, current qty vs minimum threshold (bold red) |
| FR-422 | Display alert configuration table: Product, SKU, Location, Min Qty, Max Qty |
| FR-423 | "Add Alert Rule" button opens configuration dialog |
| FR-424 | Alert rules upsert by (locationId, productId) combination — updating existing rule or creating new one |
| FR-425 | Active alerts query: joins stock_alert_configs → locations → products → inventory, filters where is_active=true AND qty_on_hand <= min_qty |

**Validation Requirements:**
| # | Rule | Type |
|---|------|------|
| VR-149 | Location required (UUID) | Client + Server |
| VR-150 | Product required (UUID) | Client + Server |
| VR-151 | Min Qty >= 0 (integer) | Client + Server |
| VR-152 | Max Qty >= 0 (integer, nullable/optional) | Server |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-275 | Active alerts exist (alerts.length > 0) | Show red alert banner with AlertTriangle icon |
| CR-276 | No active alerts | Hide alert banner |
| CR-277 | User has ADMIN role + `retail.inventory.alerts` permission | Show "Add Alert Rule" button |
| CR-278 | No alert configs | Show "No alert rules configured." empty state |

**Create Dialog Fields:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| Location | Select | Yes | — |
| Product | Select | Yes | — |
| Min Qty | Input (number, min=0) | Yes | 10 |
| Max Qty | Input (number, min=0) | No | "" (nullable) |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/alerts` | Fetch active low-stock alerts (qty <= min) |
| GET | `/api/modules/inventory-management/alert-config` | List all alert configurations |
| POST | `/api/modules/inventory-management/alert-config` | Create/update alert rule (upsert) |

---

#### 2.11.6 Consolidated Inventory

**Route:** `/console/modules/inventory-management/consolidated`  
**Source:** [ConsolidatedInventory.tsx](src/modules/inventory-management/client/pages/consolidated/ConsolidatedInventory.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-426 | Display paginated consolidated inventory (20 per page) aggregated across all locations |
| FR-427 | Support search by product name or SKU (ILIKE, 500ms debounce) |
| FR-428 | Each row displays: Product, SKU, On Hand (sum all locations), In Transit (purple), On Order (blue, from open POs), Available, Value (qty × costPrice, IDR) |
| FR-429 | On Order quantity calculated from POs with status 'sent' or 'partially_received' |
| FR-430 | Click any row to open drill-down dialog showing per-location inventory breakdown |
| FR-431 | Drill-down dialog shows: product name/SKU header, summary cards (Total On Hand, In Transit, On Order), per-location table (Location, On Hand, In Transit, On Order) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-279 | Search active | Show X clear icon; reset to page 1 |
| CR-280 | Search empty | Show search icon |
| CR-281 | No inventory data | Show "No inventory data." empty state |
| CR-282 | Row clicked | Open drill-down dialog for that product |

**Computation Formulas:**
| Field | Formula |
|-------|---------|
| Value | Math.round(qtyOnHand × baseCostPrice × 100) / 100 |
| Available | totalOnHand + totalInTransit + totalOnOrder |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/consolidated` | Consolidated inventory with pagination/search |
| GET | `/api/modules/inventory-management/consolidated/:productId` | Per-location drill-down for a product |

---

#### 2.11.7 Inventory Valuation

**Route:** `/console/modules/inventory-management/valuation`  
**Source:** [ValuationSummary.tsx](src/modules/inventory-management/client/pages/consolidated/ValuationSummary.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-432 | Display 4 summary cards: Total Inventory Value (IDR), Total Units, Products with Stock, Valuation Method |
| FR-433 | Valuation method displayed as "Weighted Average Cost" (capitalize, replace underscores with spaces) |
| FR-434 | Display "Value by Location" table: #, Location, Units, Products, Value (IDR) |
| FR-435 | Only products with qty_on_hand != 0 included in calculations |
| FR-436 | Total value computed: SUM(qty_on_hand × base_cost_price), rounded to 2 decimal places |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-283 | No inventory data | Show "No inventory data." empty state in table |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/inventory-management/valuation` | Valuation summary with totals and per-location breakdown |

---

### 2.12 Reports & Analytics

**Module ID:** `report`  
**Permissions:** `retail.report.view`  
**API Base:** `/api/modules/report/`

#### 2.12.1 Dashboard

**Route:** `/console/modules/report/dashboard`  
**Source:** [Dashboard.tsx](src/modules/report/client/pages/Dashboard.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-437 | Display 6 KPI summary cards in a responsive grid (2 cols mobile, 3 tablet, 6 desktop) |
| FR-438 | KPI: Revenue Today — SUM(pos_transactions.total_amount) WHERE status='completed' AND completed_at >= today midnight |
| FR-439 | KPI: Revenue MTD — SUM(pos_transactions.total_amount) WHERE status='completed' AND completed_at >= 1st of current month |
| FR-440 | KPI: Inventory Value — SUM(inventory.qty_on_hand × products.base_cost_price) WHERE qty_on_hand > 0 |
| FR-441 | KPI: Pending Approvals — COUNT(*) FROM approval_logs WHERE action='pending' |
| FR-442 | KPI: Active Transfers — COUNT(*) FROM transfers WHERE status NOT IN ('closed', 'received') |
| FR-443 | KPI: Low-Stock Alerts — COUNT(*) FROM stock_alert_configs WHERE is_active=true AND qty_on_hand <= min_qty |
| FR-444 | Display Revenue bar chart (Recharts BarChart) for last 30 days, grouped by date |
| FR-445 | Display Inventory Value pie chart (Recharts PieChart) by location, filtered to locations with value > 0 |
| FR-446 | Display Recent Activity table: combines 5 latest transactions + 5 latest transfers, sorted by date DESC, limited to 10 |
| FR-447 | Display 4 Quick Action buttons: New Purchase Order, New Transfer, Stock Count, Open POS |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-284 | Low-Stock Alerts > 0 | Red icon color (red-600) |
| CR-285 | Low-Stock Alerts = 0 | Gray icon color (gray-400) |
| CR-286 | No recent activity | Show "No recent activity" message |

**KPI Card Specifications:**
| Card | Icon | Icon Color | Data Source |
|------|------|------------|-------------|
| Revenue Today | DollarSign | green-600 | `/dashboard/kpis` → totalRevenueToday |
| Revenue MTD | BarChart3 | blue-600 | `/dashboard/kpis` → totalRevenueMTD |
| Inventory Value | Warehouse | purple-600 | `/dashboard/kpis` → totalInventoryValue |
| Pending Approvals | ShoppingCart | yellow-600 | `/dashboard/kpis` → pendingApprovals |
| Active Transfers | ArrowRightLeft | indigo-600 | `/dashboard/kpis` → activeTransfers |
| Low-Stock Alerts | AlertTriangle | red-600/gray-400 | `/dashboard/kpis` → lowStockAlerts |

**Chart Specifications:**
| Chart | Type | Data Source | X-Axis | Y-Axis | Color |
|-------|------|-------------|--------|--------|-------|
| Revenue (30 days) | BarChart | `/dashboard/revenue-chart` | date | revenue | #3b82f6 |
| Inventory by Location | PieChart | `/inventory/by-location` | — | — | 8-color palette |

**Recent Activity Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| Type | Combined query | "Transaction" or "Transfer" |
| Reference | transaction_id / transfer_number | |
| Location | location_name | |
| Status | status | |
| Date | date | Formatted |

**Quick Action Buttons:**
| Label | Navigation |
|-------|------------|
| New Purchase Order | `/console/modules/purchase-order/po/add` |
| New Transfer | `/console/modules/transfer/transfer/add` |
| Stock Count | `/console/modules/inventory-management/stock-count` |
| Open POS | `/pos` |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/dashboard/kpis` | All 6 KPI values |
| GET | `/api/modules/report/dashboard/revenue-chart` | Revenue chart data (30 days) |
| GET | `/api/modules/report/inventory/by-location` | Inventory value by location |
| GET | `/api/modules/report/dashboard/activity` | Recent activity (transactions + transfers) |

---

#### 2.12.2 Revenue Report

**Route:** `/console/modules/report/revenue`  
**Source:** [RevenueReport.tsx](src/modules/report/client/pages/RevenueReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-448 | Period selector: Last 7 days, Last 30 days (default), Last 90 days |
| FR-449 | Display Revenue Trend line chart (Recharts LineChart): x-axis = date (MM-DD), y-axis = revenue, line color #3b82f6 |
| FR-450 | Display "Revenue by Shop" table: Location, Revenue (bold), Transactions, Avg Basket |
| FR-451 | Display "Top Selling Products" table (limit 10): #, Product (name + SKU), Qty Sold, Revenue (bold) |
| FR-452 | All monetary values formatted as IDR currency |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-287 | Period changed | Reload all data for new period |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/revenue/trends?days={period}` | Revenue trend data |
| GET | `/api/modules/report/revenue/by-shop?days={period}` | Revenue by location |
| GET | `/api/modules/report/revenue/by-product?days={period}&limit=10` | Top selling products |

---

#### 2.12.3 Inventory Report

**Route:** `/console/modules/report/inventory`  
**Source:** [InventoryReport.tsx](src/modules/report/client/pages/InventoryReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-453 | Display "Stock by Location" table: Location, On Hand, In Transit (purple), Products, Value (bold, IDR) |
| FR-454 | Display "Slow-Moving Stock" table: products with stock but zero sales in 30 days |
| FR-455 | Slow-moving table columns: #, Product, SKU, Stock, Sold (30d) — sold count shown in red |
| FR-456 | Slow-moving stock limited to 50 products, ordered by total_stock DESC |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-288 | No slow-moving stock | Show "No slow-moving stock detected." |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/inventory/by-location` | Stock summary by location |
| GET | `/api/modules/report/inventory/slow-moving` | Slow-moving stock list |

---

#### 2.12.4 POS Report

**Route:** `/console/modules/report/pos`  
**Source:** [PosReport.tsx](src/modules/report/client/pages/PosReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-457 | Period selector: Last 7 days, Last 30 days (default), Last 90 days |
| FR-458 | Display "Hourly Sales Distribution" bar chart (Recharts BarChart): x-axis = hour (0:00–23:00), y-axis = revenue, bar color #3b82f6 |
| FR-459 | Display "Payment Method Breakdown" table: Method (capitalized), Count, Total (bold, IDR) |
| FR-460 | Display "Cashier Performance" table: Cashier, Txns, Revenue (bold, IDR), Avg Basket (IDR) |
| FR-461 | Display "Voided Transactions" table: Transaction ID (monospace), Amount (IDR), Reason, Voided By, Date |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-289 | Period changed | Reload all data for new period |
| CR-290 | No voided transactions | Show "No voided transactions." empty state |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/pos/hourly?days={period}` | Hourly sales distribution |
| GET | `/api/modules/report/pos/payment-breakdown?days={period}` | Payment method breakdown |
| GET | `/api/modules/report/pos/cashier-performance?days={period}` | Cashier performance |
| GET | `/api/modules/report/pos/voids?days={period}` | Voided transactions |
| GET | `/api/modules/report/pos/shift-summary?days={period}` | Shift summary data |

---

#### 2.12.5 Tax (PPN) Report

**Route:** `/console/modules/report/tax`  
**Source:** [TaxReport.tsx](src/modules/report/client/pages/TaxReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-462 | Period selector: Last 7 days, Last 30 days (default), Last 90 days |
| FR-463 | Display 3 summary cards: Total PPN Collected (IDR), Total Revenue (IDR), Transaction Count |
| FR-464 | Display "PPN by Location" table: Location, PPN (bold, IDR), Revenue (IDR) |
| FR-465 | Display "PPN by Category" table: Category, PPN (bold, IDR), Revenue (IDR) |
| FR-466 | Categories with null category mapped to "Uncategorized" |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-291 | Period changed | Reload all 3 data sources |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/tax/summary?days={period}` | PPN summary (totalPPN, totalRevenue, transactionCount) |
| GET | `/api/modules/report/tax/by-location?days={period}` | PPN by location |
| GET | `/api/modules/report/tax/by-category?days={period}` | PPN by category |

---

#### 2.12.6 Procurement Report

**Route:** `/console/modules/report/procurement`  
**Source:** [ProcurementReport.tsx](src/modules/report/client/pages/ProcurementReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-467 | Display "PO Status Summary" table: Status (capitalized, underscores replaced), Count, Value (bold, IDR) |
| FR-468 | Display "Supplier Scorecard" table: Supplier, Total POs, Completed (green), Returns (red) |
| FR-469 | Completed POs: status IN ('fully_received', 'closed') |
| FR-470 | Display "GRN Timeliness" table: Supplier, GRNs, Avg Days (bold; "-" if null) |
| FR-471 | Avg days calculated: AVG(EXTRACT(EPOCH FROM (received_date - order_date)) / 86400) |

**Color Coding:**
| Field | Color | Condition |
|-------|-------|-----------|
| Completed POs | green-600 | Always |
| Total Returns | red-600 | Always |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/procurement/po-summary` | PO status summary |
| GET | `/api/modules/report/procurement/supplier-scorecard` | Supplier scorecard |
| GET | `/api/modules/report/procurement/grn-timeliness` | GRN timeliness |

---

#### 2.12.7 Transfer Report

**Route:** `/console/modules/report/transfer`  
**Source:** [TransferReport.tsx](src/modules/report/client/pages/TransferReport.tsx)

**Functional Requirements:**
| # | Requirement |
|---|-------------|
| FR-472 | Display "Transfer Volume Between Locations" table: From, To, Transfers (count), Total Qty (bold) |
| FR-473 | Display "Transfer Discrepancy Summary" table: Product, SKU (muted), Lines, Total Discrepancy (red, bold), Short Qty, Damaged Qty |
| FR-474 | Discrepancy query: transfer_items WHERE discrepancy_qty != 0, aggregated by product |
| FR-475 | Total discrepancy = SUM(ABS(discrepancy_qty)), broken down by reason (short/damaged) |

**Conditional Requirements:**
| # | Condition | Behavior |
|---|-----------|----------|
| CR-292 | No transfer data | Show "No transfer data." empty state |
| CR-293 | No discrepancies | Show "No discrepancies recorded." empty state |

**API Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/modules/report/transfer/volume` | Transfer volume between locations |
| GET | `/api/modules/report/transfer/discrepancy` | Discrepancy summary by product |

---

## 3. Cross-Cutting Concerns

### 3.1 Error Handling
| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (Zod) or business rule violation |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Resource not found |
| 500 | Internal server error |

### 3.2 Pagination
All list endpoints: `page` (default 1), `perPage` (default 10), `sort`, `order` (asc/desc), `filter` (search).

### 3.3 Common UI Patterns
- **DataPagination:** Page navigation component
- **SortButton:** Column header sort toggle
- **InputGroup + DebouncedInput:** Search with 500ms debounce
- **StatusBadge:** Color-coded status badges
- **Breadcrumbs:** Navigation trail on detail/form pages
- **AlertDialog:** Confirmation for destructive actions
- **withModuleAuthorization:** HOC wrapping all module pages
- **Authorized:** Component for conditional rendering based on roles/permissions
- **Toast (sonner):** Success/error notifications

---

## 4. Appendix: Entity Reference

### 4.1 Tenant Schema Tables

| Table | Module | Key Columns | Purpose |
|-------|--------|-------------|---------|
| `locations` | Location Mgmt | code, name, type, status, sync_config | Physical locations |
| `user_locations` | Location Mgmt | user_id, location_id | User-location access |
| `tax_configs` | Tax Config | rate_percent, calc_mode, status | PPN rates |
| `categories` | Product | name, parent_id, level, path | Hierarchical categories |
| `products` | Product | sku_code, name, selling_price, tax_applicable, status | Product master |
| `product_variants` | Product | variant_sku, attributes, cost_price, selling_price | Size/color variants |
| `barcodes` | Product | barcode_value, barcode_type, product_id, variant_id | EAN-13/UPC-A/internal |
| `product_location_prices` | Product | product_id, location_id, selling_price | Per-location pricing |
| `product_images` | Product | image_url, is_primary | Product images |
| `uom_conversions` | Product | procurement_uom, sales_uom, conversion_factor | UoM mapping |
| `approval_configs` | Approval | transaction_type, is_required, approver_role_id, threshold | Approval rules |
| `approval_logs` | Approval | transaction_type, transaction_id, action, reason | Approval history |
| `audit_logs` | Approval | action, module, entity_type, before_data, after_data | Audit trail |
| `suppliers` | Supplier | code, name, npwp, payment_terms, bank_details | Supplier master |
| `supplier_contacts` | Supplier | name, role, phone, email, is_primary | Contact persons |
| `supplier_products` | Supplier | supplier_price, min_order_qty, supplier_sku | Catalog mapping |
| `po_sequences` | PO | year_month, last_sequence | PO number gen |
| `purchase_orders` | PO | po_number, supplier_id, status, totals, version | PO headers |
| `purchase_order_items` | PO | product_id, quantity, received_quantity, unit_price | PO lines |
| `purchase_order_amendments` | PO | version, changed_by, snapshot | PO history |
| `grn_sequences` | GRN | year_month, last_sequence | GRN number gen |
| `goods_received_notes` | GRN | grn_number, po_id, status, quality_check | GRN headers |
| `grn_items` | GRN | received_qty, accepted_qty, rejected_qty, batch | GRN lines |
| `sr_sequences` | Returns | year_month, last_sequence | Return number gen |
| `supplier_returns` | Returns | return_number, grn_id, supplier_id, status | Return headers |
| `supplier_return_items` | Returns | return_qty, reason_code | Return lines |
| `credit_notes` | Returns | credit_note_number, amount, is_replacement | Credit notes |
| `inventory` | POS/Inventory | location_id, product_id, qty_on_hand, in_transit | Stock levels |
| `pos_sequences` | POS | location_code, date_key, last_sequence | Txn ID gen |
| `pos_transactions` | POS | transaction_id, status, totals, payment_method, shift_id | Sale records |
| `pos_transaction_items` | POS | product_id, quantity, unit_price, discount, line_total | Sale lines |
| `pos_transaction_payments` | POS | payment_method, amount, payment_ref, change_amount | Split payments |
| `pos_shifts` | POS | cashier_id, status, opening_float, expected/actual/variance | Shifts |
| `pos_cash_drops` | POS | shift_id, amount, reason | Cash drops |
| `pos_held_transactions` | POS | cart_data (JSONB), total_amount, customer_note | Held carts |
| `transfer_sequences` | Transfer | year_month, last_sequence | Transfer number gen |
| `transfers` | Transfer | transfer_number, source/dest_location_id, status | Transfer headers |
| `transfer_items` | Transfer | requested/picked/received_qty, discrepancy | Transfer lines |
| `stock_counts` | Inventory | location_id, status, started_by, finalized_by | Count sessions |
| `stock_count_lines` | Inventory | system_qty, counted_qty, variance_qty | Count lines |
| `stock_adjustments` | Inventory | qty, reason_code, adjusted_by | Manual adjustments |
| `inventory_movements` | Inventory | movement_type, qty, balance_after, reference_id | Movement ledger |
| `stock_alert_configs` | Inventory | min_qty, max_qty, is_active | Alert thresholds |
| `sync_logs` | Sync | records_pushed/pulled, conflicts, status | Sync history |

---

*End of PRD Document*
