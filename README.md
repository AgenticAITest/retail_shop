# Multi-Shop Retail Management System

A comprehensive **multi-tenant retail management platform** for managing multiple shop locations, procurement, inventory, point-of-sale, and reporting. Built on a PERN stack (PostgreSQL, Express, React 19, Node.js) with Drizzle ORM and schema-per-tenant architecture.

## Overview

This system covers the full retail operations lifecycle:

- **Master Data** — Locations, products, categories, suppliers, tax configuration
- **Procurement** — Purchase orders with approval workflows, goods receiving (GRN), supplier returns with credit notes
- **Point of Sale** — Full-screen POS terminal with barcode scanning, split payments, shift management, hold/recall, offline support, thermal printing
- **Inventory** — Stock counts, manual adjustments, movement ledger, low-stock alerts, consolidated view, valuation
- **Transfers** — Inter-shop inventory transfers with 7-stage state machine (request → pick → dispatch → receive → close)
- **Reports** — Dashboard KPIs, revenue, inventory, POS, tax (PPN), procurement, and transfer reports with CSV/XLSX/PDF export and scheduled email delivery

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, shadcn/ui, Tailwind CSS 4, React Hook Form + Zod, Recharts |
| Backend | Node.js 20, Express 5, TypeScript, JWT RS256 auth, Zod validation |
| Database | PostgreSQL 16 with schema-per-tenant (Drizzle ORM, 40+ tables) |
| Queue | BullMQ + Redis (report generation, sync processing, approval timeouts) |
| Logging | Pino structured JSON logging with pino-http request middleware |
| Error Tracking | Sentry (Node.js backend + React frontend with browser tracing and replay) |
| Offline | Service Worker (vite-plugin-pwa), Dexie.js IndexedDB, sync engine |
| Testing | Playwright E2E (200+ tests across 12 modules) |
| CI/CD | GitHub Actions (typecheck + build + E2E, staging deploy, prod deploy) |

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
| 12 | Reports & Analytics | 8 | Dashboard, revenue, inventory, POS, tax, procurement, transfer + scheduled reports |

**Total: 57 screens, 40+ database tables, 100+ API endpoints**

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
- Keyboard shortcuts (F1–F4 payments, F9 toggle view, Esc clear)
- Responsive layout with tablet support (< 1024px stacked view)

## Report Exports & Scheduled Reports

All six report pages (revenue, inventory, POS, tax, procurement, transfer) support one-click export:
- **CSV** — plain comma-separated, immediate download
- **XLSX** — formatted workbook via SheetJS
- **PDF** — tabular layout with header/footer via jsPDF + autoTable

Scheduled reports run on BullMQ (every 5 minutes polling `report_schedules`):
- Configurable frequency: daily, weekly, or monthly at a specific time
- Supported formats: CSV, XLSX, PDF as email attachment
- Recipients: one or more email addresses per schedule
- On-demand "Run Now" trigger from the Scheduled Reports UI (ADMIN only)

## Background Jobs

| Queue | Purpose |
|-------|---------|
| `report-generation` | Generates report files and emails them to recipients |
| `report-scheduler` | Polls `report_schedules` every 5 minutes and enqueues due jobs |
| `sync-processing` | Processes offline POS transaction batches from the sync engine |

Workers are initialized at server startup and drain gracefully on SIGTERM/SIGINT.

## Observability

**Logging** — Pino structured JSON (`LOG_LEVEL` env var; defaults to `debug` in dev, `info` in prod). All HTTP requests are logged via `pino-http` (health + docs endpoints excluded). Core infrastructure (Redis events, BullMQ job lifecycle, SQL script execution, module registration) emits structured log entries.

**Error tracking** — Sentry captures unhandled exceptions server-side via `setupExpressErrorHandler`, and client-side via `@sentry/react` with browser tracing and session replay. Set `SENTRY_DSN` (backend) and `VITE_SENTRY_DSN` (frontend) to enable. Source maps are uploaded to Sentry on CI builds when `SENTRY_AUTH_TOKEN` is set.

## Security

- **JWT RS256** with short-lived access tokens and refresh tokens
- **Redis token blacklist** — logout immediately invalidates the token (checked on every authenticated request)
- **Location scope middleware** — users without `globalAccess` are restricted to their assigned location IDs on list endpoints for POS transactions, shifts, stock counts, and locations
- **RBAC** — role + permission checked at both API (`authorized()`) and UI (`<Authorized>`) levels
- **Rate limiting** — express-rate-limit on all API routes

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

The fastest way to get the infrastructure running:

```bash
docker compose up -d   # starts postgres:16 + redis:7 on default ports
```

### Setup

```bash
cd base-multi-tenant

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — minimum required vars:
#   DATABASE_URL=postgresql://retail_user:retail_pass@localhost:5432/retail_multitenant
#   REDIS_URL=redis://localhost:6379
#   ACCESS_TOKEN_SECRET=<at-least-32-char-random-string>
#   REFRESH_TOKEN_SECRET=<at-least-32-char-random-string>

# Database setup
npm run db:migrate
npm run db:seed

# Start development server (frontend + backend on port 5000)
npm run dev
```

Open `http://localhost:5000` — API docs available at `http://localhost:5000/api-docs`.

### Default Login

After seeding, log in with:

| Username | Password | Role |
|----------|----------|------|
| `sysadmin` | `password` | SYSADMIN (all access) |

Then authorize modules for your tenant via **System → Module Authorization**.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string (default: `redis://localhost:6379`) |
| `ACCESS_TOKEN_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | ✅ | JWT refresh secret (min 32 chars) |
| `NODE_ENV` | — | `development` / `production` / `test` |
| `LOG_LEVEL` | — | Pino log level (default: `debug` dev, `info` prod) |
| `SENTRY_DSN` | — | Backend Sentry DSN for server-side error tracking |
| `VITE_SENTRY_DSN` | — | Frontend Sentry DSN for client-side error tracking |
| `SENTRY_AUTH_TOKEN` | — | Sentry auth token for source-map upload (CI only) |
| `SMTP_HOST` | — | SMTP host for scheduled report emails |
| `SMTP_PORT` | — | SMTP port (default: 587) |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |
| `SMTP_FROM` | — | From address for report emails |

## Testing

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run specific module
npx playwright test tests/e2e/modules/pos/

# Interactive UI mode
npm run test:e2e:ui

# View HTML report
npm run test:e2e:report
```

**Test coverage:** 200+ E2E tests across 18 spec files covering all 12 modules.

Test artifacts:
- `tests/scenarios/*.csv` — Test scenario definitions
- `tests/e2e/modules/` — Playwright spec files
- `tests/POM.md` / `tests/POM.json` — Page Object Model report (393 actionable elements)
- `tests/screen-navigation-map.html` — Screen flow diagrams with mermaid

## CI/CD

Three GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `ci.yml` | Every push + PRs to `master` | TypeScript check → Vite build → Playwright E2E (with PG + Redis services) |
| `deploy-staging.yml` | Push to `master` | Docker build + push to registry → SSH deploy to staging server |
| `deploy-prod.yml` | Manual (`workflow_dispatch`) | SSH deploy chosen image tag to production server |

Required GitHub secrets for deploy workflows: `REGISTRY_URL`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `STAGING_SSH_KEY`, `STAGING_HOST`, `STAGING_USER`, `PROD_SSH_KEY`, `PROD_HOST`, `PROD_USER`.

## Roles & Permissions

| Role | Access |
|------|--------|
| SYSADMIN | Full system access, tenant management, module registry |
| ADMIN | All retail modules, user management within tenant |
| MANAGER | POS transactions, shift history, reports |
| CASHIER | POS sales only |

Each module defines granular permissions (e.g., `retail.po.view`, `retail.po.create`, `pos.transaction.void`) enforced at both API and UI levels.

## API Endpoints

### Authentication

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Password login |
| POST | `/api/auth/pin-login` | PIN login (POS cashiers) |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/register-tenant` | Register tenant |
| POST | `/api/auth/refresh` | Refresh JWT |
| POST | `/api/auth/logout` | Logout (blacklists token) |

### Retail Modules (all require auth + module authorization)

| Module | Base Path |
|--------|-----------|
| Location Management | `/api/modules/location-management/location` |
| Tax Configuration | `/api/modules/tax-configuration/config` |
| Product Catalog | `/api/modules/product-catalog/product`, `/category` |
| Approval Engine | `/api/modules/approval-engine/config`, `/approval`, `/audit-log` |
| Supplier Management | `/api/modules/supplier-management/supplier` |
| Purchase Order | `/api/modules/purchase-order/po` |
| GRN | `/api/modules/grn/grn` |
| Supplier Returns | `/api/modules/supplier-return/return`, `/credit-note` |
| POS | `/api/modules/pos/transaction`, `/shift`, `/inventory`, `/sync` |
| Transfers | `/api/modules/transfer/transfer` |
| Inventory | `/api/modules/inventory-management/stock-count`, `/adjustment`, `/movement`, `/alerts`, `/consolidated`, `/valuation` |
| Reports | `/api/modules/report/dashboard`, `/revenue`, `/inventory`, `/pos`, `/tax`, `/procurement`, `/transfer` |
| Scheduled Reports | `/api/modules/report/schedule` |

### Health

```
GET /api/health   →  { status, services: { database, redis }, tenantConnections }
```

## Documentation

- **[PRD.md](../PRD.md)** — Product Requirements Document with 475 FRs, 152 VRs, 293 CRs, 30 BRs across all screens
- **[tests/POM.md](tests/POM.md)** — Page Object Model with all actionable UI elements
- **[tests/screen-navigation-map.html](tests/screen-navigation-map.html)** — Navigation flows with mermaid diagrams
- **[docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)** — Developer guide for the base framework

## License

Proprietary. Built on the [base-multi-tenant](https://github.com/arpodungge/base-multi-tenant) framework.
