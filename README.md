# Multi-Shop Retail Management System

A comprehensive **multi-tenant retail management platform** for managing multiple shop locations, procurement, inventory, point-of-sale, and reporting. Built on a PERN stack (PostgreSQL, Express, React 19, Node.js) with Drizzle ORM and schema-per-tenant architecture.

## Overview

This system covers the full retail operations lifecycle:

- **Master Data** — Locations, products, categories, suppliers, tax configuration
- **Procurement** — Purchase orders with approval workflows, goods receiving (GRN), supplier returns with credit notes
- **Point of Sale** — Full-screen POS terminal with barcode scanning, split payments, shift management, hold/recall, offline support, thermal printing
- **Inventory** — Stock counts, manual adjustments, movement ledger, low-stock alerts, consolidated view, valuation
- **Transfers** — Inter-shop inventory transfers with 7-stage state machine (request → pick → dispatch → receive → close)
- **Reports** — Dashboard KPIs, revenue, inventory, POS, tax (PPN), procurement, and transfer reports

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS 4, React Hook Form + Zod, Recharts |
| Backend | Node.js, Express 5, TypeScript, JWT auth, Zod validation |
| Database | PostgreSQL with schema-per-tenant (Drizzle ORM, 40+ tables) |
| Testing | Playwright E2E (200+ tests across 12 modules) |
| Offline | Service Worker (vite-plugin-pwa), Dexie.js IndexedDB, sync engine |

## Modules

| # | Module | Screens | Description |
|---|--------|---------|-------------|
| 1 | Location Management | 2 | Shop/warehouse/DC location registry |
| 2 | Tax Configuration | 2 | Indonesian PPN tax rates and calc mode |
| 3 | Product Catalog | 4 | Products, categories, variants, barcodes, pricing |
| 4 | Approval Engine | 4 | Configurable approval workflows per transaction type |
| 5 | Supplier Management | 3 | Supplier master data, contacts, product catalog mapping |
| 6 | Purchase Order | 4 | PO lifecycle with 8-state machine and approval integration |
| 7 | Goods Received Note | 3 | Receive goods against POs with quality inspection |
| 8 | Supplier Returns | 4 | Return lifecycle with credit notes (8-state machine) |
| 9 | Point of Sale | 13 | Full-screen POS with shift/hold/checkout/print/offline |
| 10 | Inter-Shop Transfers | 3 | Transfer inventory between locations (7-state machine) |
| 11 | Inventory Management | 7 | Stock counts, adjustments, movement ledger, alerts, valuation |
| 12 | Reports & Analytics | 7 | Dashboard, revenue, inventory, POS, tax, procurement, transfer |

**Total: 56 screens, 40+ database tables, 100+ API endpoints**

## Architecture

```
Two independent layouts:
  /auth/*              → AuthLayout (login, register, password reset)
  /console/*           → ConsoleLayout (admin with sidebar)
  /pos                 → PosLayout (full-screen POS terminal, no sidebar)

Multi-tenancy:
  Each tenant gets its own PostgreSQL schema (tenant_{code})
  with complete data isolation and independent RBAC

Module system:
  src/modules/{module-id}/
  ├── module.json           # Metadata and permissions
  ├── client/
  │   ├── pages/            # React page components
  │   ├── routes/           # React Router config
  │   └── menus/            # Sidebar menu items
  └── server/
      ├── routes/           # Express API routes
      ├── schemas/          # Zod validation schemas
      └── lib/              # Business logic (state machines, generators)
```

## State Machines

Four modules use state machine patterns for lifecycle management:

**Purchase Order:** draft → pending_approval → approved → sent → partially_received → fully_received → closed (+ cancelled)

**GRN:** draft → quality_inspection → accepted → stock_updated

**Supplier Return:** requested → pending_approval → approved → dispatched → acknowledged → credit_note_received → closed (+ rejected)

**Transfer:** requested → pending_approval → approved → picking → dispatched → received → closed

## POS Features

The POS operates as a standalone full-screen terminal (`/pos`) separate from the admin console:

- Barcode scanning (HID keyboard wedge detection)
- Split payments (Cash, Card, QRIS, Transfer)
- Shift management (open, close, cash drops)
- Hold/recall transactions
- Per-item and transaction-level discounts
- Tax calculation (PPN inclusive/exclusive)
- Thermal receipt printing (ESC/POS via WebUSB/WebSerial)
- Session lock after 5-minute idle
- Offline mode with IndexedDB + sync engine
- Keyboard shortcuts (F1-F4 payments, F9 toggle view, Esc clear)
- Responsive layout with tablet support (< 1024px stacked view)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT secrets

# Database setup
npm run db:generate
npm run db:migrate
npm run db:seed

# Start development server (frontend + backend on port 5000)
npm run dev
```

### Default Login
After seeding, login at `http://localhost:5000` with:
- **SYSADMIN**: `sysadmin` / `password`

Then authorize modules for your tenant via System > Module Authorization.

## Testing

```bash
# Run all E2E tests
npx playwright test

# Run specific module
npx playwright test tests/e2e/modules/pos/

# Run with UI
npx playwright test --ui
```

**Test coverage:** 200+ E2E tests across 18 spec files covering all 12 modules.

Test artifacts:
- `tests/scenarios/*.csv` — Test scenario definitions
- `tests/e2e/modules/` — Playwright spec files
- `tests/POM.md` / `tests/POM.json` — Page Object Model report (393 actionable elements)
- `tests/screen-navigation-map.html` — Screen flow diagrams with mermaid

## Documentation

- **[PRD.md](../PRD.md)** — Product Requirements Document with 475 FRs, 152 VRs, 293 CRs, 30 BRs across all screens
- **[tests/POM.md](tests/POM.md)** — Page Object Model with all actionable UI elements
- **[tests/screen-navigation-map.html](tests/screen-navigation-map.html)** — Navigation flows with mermaid diagrams and JSON bundle
- **[docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)** — Developer guide for the base framework

## API Endpoints

### Authentication
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/register-tenant` | Register tenant |
| POST | `/api/auth/refresh` | Refresh JWT |

### Retail Modules (all require auth + module authorization)
| Module | Base Path |
|--------|-----------|
| Location Management | `/api/modules/location-management/location` |
| Tax Configuration | `/api/modules/tax-configuration/config` |
| Product Catalog | `/api/modules/product-catalog/product`, `/category` |
| Approval Engine | `/api/modules/approval-engine/config`, `/pending`, `/history` |
| Supplier Management | `/api/modules/supplier-management/supplier` |
| Purchase Order | `/api/modules/purchase-order/po` |
| GRN | `/api/modules/grn/grn` |
| Supplier Returns | `/api/modules/supplier-return/return`, `/credit-note` |
| POS | `/api/modules/pos/transaction`, `/shift`, `/sync` |
| Transfers | `/api/modules/transfer/transfer` |
| Inventory | `/api/modules/inventory-management/stock-count`, `/adjustment`, `/movement`, `/alerts`, `/consolidated`, `/valuation` |
| Reports | `/api/modules/report/dashboard`, `/revenue`, `/inventory`, `/pos`, `/tax`, `/procurement`, `/transfer` |

## Roles & Permissions

| Role | Access |
|------|--------|
| SYSADMIN | Full system access, tenant management, module registry |
| ADMIN | All retail modules, user management within tenant |
| MANAGER | POS transactions, shift history, reports |
| CASHIER | POS sales only |

Each module defines granular permissions (e.g., `retail.po.view`, `retail.po.create`, `pos.transaction.void`) enforced at both API and UI levels.

## License

Proprietary. Built on the [base-multi-tenant](https://github.com/arpodungge/base-multi-tenant) framework.
