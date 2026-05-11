# Multi-Shop Retail Management System with Integrated POS
## Comprehensive Implementation Plan

---

## Implementation Status (as of 2026-05-10)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Platform Foundation | ✅ Complete | All sprints implemented; Sprint 1 gaps resolved (Pino HTTP logging, Sentry backend+frontend, BullMQ graceful shutdown, GitHub Actions CI/CD) |
| Phase 2: Procurement | ✅ Complete | All 4 sprints implemented |
| Phase 3: POS and Offline | ✅ Complete | All sprints including sync engine implemented |
| Phase 4: Transfers and Inventory | ✅ Complete | All sprints implemented |
| Phase 5: Reporting | ✅ Complete | All reports done; exports (CSV/XLSX/PDF) and scheduled reports implemented |
| Phase 6: Optimization and Migration | ❌ Not Started | MokaPOS migration, cycle counting, archival pending |

**Legend:** ✅ Complete · 🔄 Partial/Mostly Complete · ❌ Not Started

---

## 1. Project Overview

This document defines the complete implementation plan for a Multi-Shop Retail Management System with Integrated POS, targeting the Indonesian retail market. The system is built on the **base-multi-tenant** framework -- a PERN stack (PostgreSQL, Express.js, React, Node.js) with TypeScript end-to-end, a schema-per-tenant multi-tenant architecture, and an offline-first POS module using Service Workers and IndexedDB.

The platform enables retail businesses operating multiple physical shops across Indonesia to centrally manage product catalogs, procurement, inter-shop transfers, point-of-sale operations, and consolidated reporting. Key differentiators include offline-capable POS with configurable sync schedules, thermal printer integration via WebUSB/WebSerial, and Indonesian tax (PPN) compliance.

**Scale targets**: 5-10 tenants, up to 200 shops per tenant, 500-2,000 transactions per shop per day, up to 5,000 queued offline transactions per device.

---

## 2. Tech Stack and Tooling

### Backend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 20 LTS | Server runtime |
| Framework | Express.js | 5.1 | HTTP server, middleware, routing (already in base) |
| Language | TypeScript | 5.4+ | Type safety across the stack |
| ORM | Drizzle ORM | 0.44+ | Type-safe queries, schema migrations, multi-schema support (already in base) |
| Database | PostgreSQL | 16 | Primary data store, schema-per-tenant |
| Connection Pool | TenantConnectionManager | - | Connection pooling for multi-tenant (already in base at `src/server/lib/db/tenant-connection-manager.ts`) |
| Auth | jsonwebtoken + bcryptjs | - | JWT RS256 signing, password and PIN hashing (auth middleware already in base) |
| Validation | Zod | 4.x | Runtime schema validation for API inputs (already in base) |
| File Upload | express-fileupload + AWS S3 SDK | - | CSV imports, product images (express-fileupload already in base) |
| Email | Nodemailer | - | Transactional emails (approvals, reports) (already in base) |
| Job Queue | BullMQ + Redis | - | Background jobs (sync processing, report generation, archival) |
| Logging | Pino | 8.x | Structured JSON logging |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) | - | OpenAPI 3.0 documentation (already in base at `/api-docs`) |
| Rate Limiting | express-rate-limit | - | Brute force protection (already in base) |
| CSV Parsing | Papa Parse (server) | - | CSV import processing |

### Frontend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 19 | UI library (already in base) |
| Language | TypeScript | 5.4+ | Type safety |
| Build Tool | Vite | 6.x | Development server, production builds (already in base) |
| PWA Plugin | vite-plugin-pwa (Workbox) | - | Service worker generation, offline caching |
| Server State | @tanstack/react-query | 5.x | API cache, data fetching (already in base) |
| HTTP Client | Axios | - | HTTP requests with tenant interceptors (already in base) |
| Client State | React Context | - | Local UI state (already in base) |
| Offline Storage | Dexie.js | 4.x | IndexedDB wrapper for offline data |
| Routing | React Router | 7.x | Client-side routing (already in base) |
| UI Components | shadcn/ui + Radix UI | - | Component library (already in base) |
| Styling | TailwindCSS | 4.x | Utility-first CSS (already in base) |
| Charts | Recharts | 2.x | Dashboard charts and analytics |
| Forms | React Hook Form + Zod | - | Form management with validation (already in base) |
| Animations | Framer Motion | - | UI animations (already in base) |
| i18n | react-i18next | - | English and Bahasa Indonesia |
| PDF Export | jsPDF + jspdf-autotable | - | Client-side PDF generation |
| XLSX Export | SheetJS (xlsx) | - | Excel export |
| Thermal Printing | Custom ESC/POS library | - | WebUSB/WebSerial ESC/POS command generation |
| Barcode Generation | JsBarcode | - | Barcode rendering for labels/receipts |

### Infrastructure and Tooling
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Package Structure | Single package (base-multi-tenant) | NOT a monorepo; single `package.json` |
| Linting | ESLint + Prettier | Code quality |
| E2E Testing | Playwright | End-to-end, including offline simulation (already in base) |
| Unit Testing | Vitest | Unit and integration tests |
| Containerization | Docker + Docker Compose | Development and deployment |
| CI/CD | GitHub Actions | Automated testing and deployment |
| Cloud (primary) | AWS (ECS/Fargate, RDS, S3, CloudFront) | Production hosting |
| Cloud (alt) | Alibaba Cloud | Alternative for Indonesian data residency |
| CDN/WAF | Cloudflare | CDN, DDoS protection, edge caching |
| Monitoring | Prometheus + Grafana | Metrics and alerting |
| APM | Sentry | Error tracking (backend + frontend) |
| Secrets | AWS Secrets Manager | Credential management |

---

## 3. Project Structure

The project extends the **base-multi-tenant** framework, which is a single-package architecture (not a monorepo). All retail-specific features are implemented as modules following the base's modular architecture.

```
base-multi-tenant/
├── package.json                    # Single package config
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite 6.x config (Sentry plugin, source maps)
├── drizzle.config.ts               # Drizzle ORM config
├── index.html                      # App entry HTML
├── components.json                 # shadcn/ui config
├── Dockerfile                      # Production container image
├── docker-compose.yml              # Local dev services (PG 16, Redis 7)
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Typecheck + build + Playwright E2E (PG + Redis services)
│       ├── deploy-staging.yml      # Push to master → Docker build → SSH deploy to staging
│       └── deploy-prod.yml         # Manual workflow_dispatch deploy to production
├── docs/
│   ├── DEVELOPMENT_GUIDE.md        # Module development guide
│   ├── api/                        # Generated API docs
│   ├── architecture/               # Architecture decision records
│   ├── sync-conflicts.md           # Conflict resolution spec
│   └── migration-guide.md          # MokaPOS migration guide
│
├── drizzle/                        # Drizzle migration files
│   ├── [migration files].sql
│   └── meta/
│       ├── _journal.json
│       └── [snapshot].json
│
├── scripts/                        # CLI tools
│   ├── create-module.js            # Interactive module generator
│   ├── create-module-cli.js        # Non-interactive module generator
│   ├── add-page-to-module.js       # Add page/entity to existing module
│   ├── register-module.js          # Register module in 5 locations
│   ├── generate-module-sql.js      # Generate SQL deployment scripts
│   └── register-module-db.js       # Register module in DB registry
│
├── modules/                        # Alternative module output location
│   └── {module-id}/
│       └── scripts/
│           └── install.sql         # SQL deployment script
│
├── public/
│   ├── manifest.json
│   ├── icons/
│   ├── fonts/
│   └── locales/
│       ├── en/
│       └── id/                     # Bahasa Indonesia
│
├── src/
│   ├── client/                     # React frontend
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   ├── route.ts                # React Router 7 config
│   │   ├── vite-env.d.ts
│   │   ├── components/
│   │   │   ├── app-sidebar.tsx      # Sidebar with module menus
│   │   │   ├── nav-main.tsx
│   │   │   ├── nav-projects.tsx
│   │   │   ├── nav-user.tsx
│   │   │   ├── team-switcher.tsx    # Tenant switcher
│   │   │   ├── auth/
│   │   │   │   ├── authorized.tsx   # Permission-based rendering
│   │   │   │   ├── has-permissions.tsx
│   │   │   │   ├── has-roles.tsx
│   │   │   │   ├── login-form.tsx
│   │   │   │   └── register-form.tsx
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── data-table.tsx   # TanStack Table
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── dialog.tsx       # ConfirmDialog
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   └── ...
│   │   │   └── common/
│   │   │       ├── DataPagination.tsx
│   │   │       ├── SortButton.tsx
│   │   │       ├── TreeView.tsx
│   │   │       ├── ConfirmDialog.tsx
│   │   │       ├── StatusBadge.tsx
│   │   │       ├── ApprovalButton.tsx
│   │   │       ├── OfflineIndicator.tsx
│   │   │       ├── CurrencyDisplay.tsx  # IDR formatting
│   │   │       └── SyncStatusBar.tsx
│   │   ├── hooks/
│   │   │   ├── use-mobile.ts
│   │   │   ├── useAuth.ts           # Already in base via authProvider
│   │   │   ├── useOfflineStatus.ts
│   │   │   ├── usePrinter.ts
│   │   │   ├── useBarcodeScanner.ts
│   │   │   ├── useSyncStatus.ts
│   │   │   └── useLocationScope.ts
│   │   ├── lib/
│   │   │   ├── utils.ts             # shadcn/ui utility (cn function)
│   │   │   ├── axios.ts             # Axios instance with tenant interceptors
│   │   │   └── sentry.ts            # Frontend Sentry init (@sentry/react)
│   │   ├── pages/
│   │   │   ├── ErrorPage.tsx         # Error boundary page
│   │   │   ├── Home.tsx
│   │   │   ├── RootLayout.tsx
│   │   │   ├── auth/
│   │   │   │   ├── AuthLayout.tsx
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Register.tsx
│   │   │   └── console/
│   │   │       ├── ConsoleLayout.tsx
│   │   │       ├── Dashboard.tsx
│   │   │       └── system/
│   │   │           ├── Permission.tsx
│   │   │           ├── Role.tsx
│   │   │           └── User.tsx
│   │   ├── provider/
│   │   │   └── authProvider.tsx      # AuthProvider with token refresh
│   │   └── services/
│   │       ├── db/                   # Dexie.js database
│   │       │   ├── index.ts          # Dexie DB definition
│   │       │   ├── products.table.ts
│   │       │   ├── transactions.table.ts
│   │       │   ├── sync-queue.table.ts
│   │       │   └── ...
│   │       ├── sync/
│   │       │   ├── sync-engine.ts       # Core sync orchestrator
│   │       │   ├── sync-scheduler.ts    # Cron-based sync trigger
│   │       │   ├── conflict-handler.ts  # Client-side conflict UI
│   │       │   └── delta-sync.ts        # Catalog delta sync
│   │       ├── printing/
│   │       │   ├── escpos-builder.ts    # ESC/POS command builder
│   │       │   ├── receipt-template.ts  # Receipt layout
│   │       │   ├── printer-manager.ts   # WebUSB/WebSerial abstraction
│   │       │   └── printer-config.ts    # Supported printer profiles
│   │       ├── barcode/
│   │       │   └── scanner-listener.ts  # HID keyboard wedge
│   │       └── encryption/
│   │           └── indexeddb-crypto.ts   # IndexedDB encryption
│   │
│   ├── server/                      # Express backend
│   │   ├── main.ts                  # Express server config, route registration, graceful shutdown
│   │   ├── lib/
│   │   │   ├── logger.ts            # Pino structured logger (pino-pretty in dev, JSON in prod)
│   │   │   ├── sentry.ts            # Backend Sentry init (@sentry/node)
│   │   │   ├── redis.ts             # ioredis singleton (token blacklist, BullMQ connection)
│   │   │   ├── queue.ts             # BullMQ getQueue/registerWorker/closeAllQueues + QUEUE_NAMES
│   │   │   ├── email.ts             # Nodemailer transporter
│   │   │   └── db/
│   │   │       ├── seed.ts          # Seed data (system tenant, roles, permissions)
│   │   │       ├── tenant-connection-manager.ts  # Multi-tenant connection pooling
│   │   │       └── schema/
│   │   │           ├── sharedSchema.ts   # Public schema (sys_tenant, sys_module_registry, sys_module_auth)
│   │   │           └── tenantSchema.ts   # Per-tenant schema (sys_user, sys_role, all module tables)
│   │   ├── middleware/
│   │   │   ├── authMiddleware.ts          # resolveTenantContext + authenticated + authorized + Redis blacklist
│   │   │   ├── moduleAuthMiddleware.ts    # Module authorization check
│   │   │   ├── locationScopeMiddleware.ts # resolveLocationScope() — injects req.locationScope
│   │   │   ├── approvalMiddleware.ts      # Approval workflow interception
│   │   │   └── auditMiddleware.ts         # Audit trail recording
│   │   ├── routes/
│   │   │   ├── auth/
│   │   │   │   └── auth.ts          # Login, PIN login, register, refresh, logout (token blacklist)
│   │   │   └── system/
│   │   │       ├── permission.ts
│   │   │       ├── role.ts
│   │   │       ├── user.ts
│   │   │       └── tenant.ts
│   │   └── types/
│   │       └── express/
│   │           └── index.d.ts       # Points to authMiddleware.ts and locationScopeMiddleware.ts for type augmentations
│   │
│   └── modules/                     # Feature modules (self-contained)
│       ├── moduleHelpers.ts         # Module registration utilities (already exists)
│       ├── moduleMetadata.ts        # Module metadata utilities (already exists)
│       │
│       ├── location/                # Location Management module
│       │   ├── module.json
│       │   ├── client/
│       │   │   ├── components/
│       │   │   ├── pages/           # LocationList, LocationAdd, LocationEdit, LocationView
│       │   │   ├── routes/
│       │   │   └── menus/
│       │   ├── server/
│       │   │   ├── routes/          # Location CRUD with Swagger JSDoc
│       │   │   ├── schemas/         # Zod validation schemas
│       │   │   └── lib/db/schemas/  # Drizzle table definitions
│       │   └── scripts/
│       │       └── install.sql
│       │
│       ├── product/                 # Product/SKU Management module
│       │   ├── module.json
│       │   ├── client/ ...
│       │   ├── server/ ...
│       │   └── scripts/
│       │
│       ├── supplier/                # Supplier Management module
│       ├── purchase-order/          # Purchase Order module
│       ├── grn/                     # Goods Received Note module
│       ├── supplier-return/         # Supplier Returns module
│       ├── pos/                     # Point of Sale module
│       │   ├── module.json
│       │   ├── client/
│       │   │   ├── components/
│       │   │   │   ├── ProductGrid.tsx
│       │   │   │   ├── CartPanel.tsx
│       │   │   │   ├── CheckoutModal.tsx
│       │   │   │   ├── SplitPaymentForm.tsx
│       │   │   │   ├── HeldTransactions.tsx
│       │   │   │   ├── ShiftManager.tsx
│       │   │   │   └── ReceiptPreview.tsx
│       │   │   ├── pages/
│       │   │   ├── routes/
│       │   │   └── menus/
│       │   ├── server/
│       │   │   ├── routes/
│       │   │   ├── schemas/
│       │   │   └── lib/db/schemas/
│       │   └── scripts/
│       │
│       ├── shift/                   # Shift Management module
│       ├── transfer/                # Inter-Shop Transfer module
│       ├── inventory/               # Inventory Management module
│       ├── tax/                     # Tax Configuration module
│       ├── approval/                # Approval Engine module
│       ├── report/                  # Reporting & Analytics module
│       │   ├── client/
│       │   │   ├── lib/exportUtils.ts           # CSV/XLSX/PDF export helpers
│       │   │   └── pages/ScheduledReports.tsx   # Schedule management UI
│       │   ├── server/
│       │   │   ├── routes/scheduleRoutes.ts     # CRUD + run-now endpoint
│       │   │   └── jobs/
│       │   │       ├── reportGeneratorJob.ts    # BullMQ worker: generate + email attachment
│       │   │       ├── reportEmailer.ts         # Nodemailer send with attachment
│       │   │       └── reportScheduler.ts       # 5-min polling scheduler
│       │   └── scripts/install.sql              # report_schedules table
│       ├── sync/                    # Sync Engine module
│       │   ├── module.json
│       │   ├── server/
│       │   │   ├── routes/
│       │   │   │   └── sync-routes.ts
│       │   │   ├── schemas/
│       │   │   │   └── sync-schema.ts
│       │   │   └── lib/
│       │   │       ├── conflict-resolver.ts
│       │   │       └── db/schemas/
│       │   └── scripts/
│       │
│       ├── user/                    # Extended User Management module
│       ├── onboarding/              # Tenant Onboarding Wizard module
│       └── migration/               # MokaPOS Migration Tools module
│
├── tests/                           # E2E tests (Playwright)
│   ├── fixtures/
│   │   └── auth.ts                  # Authenticated page fixtures
│   ├── pos/
│   │   ├── sale-flow.spec.ts
│   │   ├── offline-sale.spec.ts
│   │   └── shift-management.spec.ts
│   ├── procurement/
│   │   ├── po-lifecycle.spec.ts
│   │   └── grn-flow.spec.ts
│   ├── transfer/
│   │   └── transfer-flow.spec.ts
│   └── onboarding/
│       └── wizard.spec.ts
```

---

## 4. Database Design

### 4.1 Schema-per-Tenant Strategy

The system uses PostgreSQL's native schema feature to isolate tenant data. A single PostgreSQL database instance hosts:

- **`public` schema**: Platform-level tables shared across all tenants
- **`tenant_{identifier}` schemas**: One schema per tenant containing all business data tables

The base-multi-tenant framework already provides the schema-per-tenant infrastructure via TenantConnectionManager (`src/server/lib/db/tenant-connection-manager.ts`).

#### Public Schema Tables (already in base)

The base framework provides these shared tables in the `public` schema:

```
public.sys_tenant
  -- Tenant registry (already exists in base)
  id, name, code, subdomain, status, created_at, updated_at

public.sys_module_registry
  -- Global module catalog (already exists in base)
  id, module_id, name, description, version, status

public.sys_module_auth
  -- Tenant-specific module permissions (already exists in base)
  id, tenant_id, module_id, is_active

public.drizzle_migrations
  -- Drizzle migration tracking (already exists in base)
```

#### Public Schema Tables (retail extensions)

Additional shared tables for the retail platform:

```
public.tenant_subscriptions
  id              UUID PRIMARY KEY
  tenant_id       UUID REFERENCES sys_tenant(id)
  plan            VARCHAR(50)
  max_shops       INTEGER
  max_users       INTEGER
  max_skus        INTEGER
  started_at      TIMESTAMPTZ
  expires_at      TIMESTAMPTZ
```

#### Tenant Schema Tables (already in base)

Each `tenant_{code}` schema already includes these system tables:

```
tenant_{code}.sys_user
tenant_{code}.sys_role
tenant_{code}.sys_permission
tenant_{code}.sys_user_role
tenant_{code}.sys_role_permission
tenant_{code}.sys_option
tenant_{code}.sys_module_auth
```

#### Tenant Schema Tables (retail extensions)

All retail business tables are added to each `tenant_{code}` schema via module install scripts. Key tables include:

- `locations`, `location_hierarchy`
- `user_locations` (extends base `sys_user`)
- `products`, `product_variants`, `barcodes`, `categories`, `product_images`
- `suppliers`, `supplier_products`
- `purchase_orders`, `po_lines`, `grns`, `grn_lines`
- `supplier_returns`, `return_lines`, `credit_notes`
- `transfer_requests`, `transfer_lines`
- `inventory`, `inventory_movements`
- `pos_shifts`, `sales_transactions`, `sale_lines`, `payments`
- `sales_returns`, `return_lines`
- `tax_configs`
- `approval_configs`, `approval_logs`
- `audit_logs`, `sync_logs`
- `held_transactions`, `held_transaction_lines`

### 4.2 Drizzle ORM Multi-Schema Strategy

The base framework already handles dynamic schema switching via TenantConnectionManager. The approach:

1. **Shared schema definitions** in `src/server/lib/db/schema/system.ts` (already exists in base) for the public schema tables.

2. **Tenant schema definitions** in each module's `server/lib/db/schemas/` directory using Drizzle's `pgTable` API.

3. **Tenant-aware database access** is already built into the middleware chain:
   ```typescript
   // In route handlers, req.tenantDb and req.sharedDb are already available
   router.get('/', authorized('ADMIN', 'location.location.view'), async (req, res) => {
     const locations = await req.tenantDb.select().from(locationSchema.locations);
     res.json({ data: locations });
   });
   ```

4. **Schema provisioning** uses `createTenantSchema()` from TenantConnectionManager:
   ```typescript
   import { createTenantSchema } from '@server/lib/db/tenant-connection-manager';
   // Creates tenant_{code} schema with all system tables
   await createTenantSchema('acme');
   // Module tables are added via SQL install scripts
   ```

5. **Module table creation** uses SQL scripts generated via `npm run generate-sql {module-id}`, which produces `modules/{module-id}/scripts/install.sql`. These scripts are applied to each tenant schema when the module is activated for that tenant.

6. **Drizzle migrations** apply only to the `public` (shared) schema:
   ```bash
   npm run db:generate      # Generate migration files in drizzle/
   npm run db:migrate       # Apply migrations to public schema
   ```

### 4.3 Connection Pooling

- TenantConnectionManager (`src/server/lib/db/tenant-connection-manager.ts`) handles connection pooling per tenant schema (already in base)
- Tenant resolution via `X-Tenant-Code` header > JWT token > subdomain (already in base)
- `req.tenantDb` provides a Drizzle instance scoped to the resolved tenant schema
- `req.sharedDb` provides a Drizzle instance for the public schema
- Pool size configurable via `MAX_CONNECTIONS` environment variable (default 10)
- For the sync engine (high write throughput), a dedicated pool of 20 connections

### 4.4 Indexing Strategy

Critical indexes for performance (added via module install SQL scripts):

```sql
-- Per tenant schema (in module install.sql scripts)
CREATE INDEX idx_inventory_location_sku ON inventory(location_id, sku_id);
CREATE INDEX idx_sales_txn_location_date ON sales_transactions(location_id, created_at DESC);
CREATE INDEX idx_sales_txn_shift ON sales_transactions(shift_id);
CREATE INDEX idx_inventory_movement_sku_date ON inventory_movements(sku_id, created_at DESC);
CREATE INDEX idx_barcode_value ON barcodes(barcode_value);  -- Critical for POS scan speed
CREATE INDEX idx_product_status ON products(status) WHERE status = 'active';
CREATE INDEX idx_sync_log_location ON sync_logs(location_id, sync_start DESC);
CREATE INDEX idx_approval_pending ON approval_logs(status) WHERE status = 'pending';
CREATE INDEX idx_transfer_status ON transfer_requests(status) WHERE status IN ('dispatched','in_transit');
```

### 4.5 Data Partitioning (Growth)

For tenants with high transaction volume, partition `sales_transactions` and `inventory_movements` by month using PostgreSQL native partitioning:

```sql
CREATE TABLE sales_transactions (
  ...
) PARTITION BY RANGE (created_at);

-- Auto-create monthly partitions via a scheduled job
CREATE TABLE sales_transactions_2026_04 PARTITION OF sales_transactions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

---

## 5. Phase 1: Platform Foundation (Weeks 1-12)

### Sprint 1 (Weeks 1-2): Base Extension and Multi-Tenant Retail Infrastructure — ✅ COMPLETE

**Deliverables:**
- Fork/clone base-multi-tenant framework as the project starting point
- Docker Compose extended for local dev (PostgreSQL 16, Redis 7 added)
- Retail-specific shared schema tables added via Drizzle migrations (`npm run db:generate`, `npm run db:migrate`):
  - `public.tenant_subscriptions`
- Retail-specific tenant schema extensions designed as module SQL scripts:
  - Location tables, user-location tables, tax config tables, audit log tables
- TenantConnectionManager already handles schema provisioning; extend `createTenantSchema()` to also apply retail module SQL scripts
- Verify tenant resolution middleware works: `req.tenantDb`, `req.sharedDb`, `req.user`, `req.tenantInfo` all available in route handlers
- Health check endpoint
- Pino structured logging integration
- Sentry error tracking integration
- CI pipeline: lint, type-check, test on PR
- BullMQ + Redis configuration for background jobs

**Key items already provided by base (no work needed):**
- Express 5.1 server with middleware pipeline (`src/server/main.ts`)
- TenantConnectionManager with connection pooling (`src/server/lib/db/tenant-connection-manager.ts`)
- Tenant resolution middleware: `resolveTenantContext()` (`src/server/middleware/authMiddleware.ts`)
- Drizzle ORM with shared schema definitions (`src/server/lib/db/schema/system.ts`)
- Module registration system and CLI tools (`scripts/`)
- Swagger API docs at `/api-docs`

> **Sprint 1 Status:** ✅ Complete. Base framework, Docker Compose (PG + Redis), module scaffolding, and tenant middleware confirmed. ✅ Pino structured logging wired with `pino-http` request middleware; `queue.ts`, `redis.ts`, `sentry.ts`, `sqlScriptExecutor.ts`, `moduleRegistrationHelper.ts` all migrated to `logger`. ✅ `@sentry/node` backend configured with `initSentry()` and `setupExpressErrorHandler`. ✅ `@sentry/react` frontend with `initSentry()` in `main.tsx`, Sentry Vite plugin for source-map upload. ✅ BullMQ graceful shutdown on SIGTERM/SIGINT calling `closeAllQueues()` + `closeRedis()`. ✅ GitHub Actions: `.github/workflows/ci.yml` (typecheck + build + Playwright E2E), `deploy-staging.yml` (push to master → Docker build → SSH deploy), `deploy-prod.yml` (manual workflow_dispatch by tag).

### Sprint 2 (Weeks 3-4): Authentication Extensions and RBAC — ✅ COMPLETE

**Deliverables:**
- **Auth endpoint extensions** (base already provides login, register, refresh, forgot-password, reset-password at `/api/auth/*`):
  - `POST /api/auth/login/pin` (POS PIN login for cashiers) -- new
  - `POST /api/auth/set-pin` (cashier PIN setup) -- new
  - Token blacklisting via Redis on logout -- extend existing
- **JWT implementation** (base already uses JWT with access/refresh tokens):
  - Extend JWT claims to include: `locationIds`, `schemaName` in addition to existing `userId`, `tenantId`, `role`
  - Access token (RS256, 15min expiry)
  - Refresh token (opaque, 7-day expiry, stored in Redis, rotated on use)
  - Token blacklist in Redis for logout/revocation
- **PIN login:**
  - 6-digit PIN, stored as bcrypt hash
  - Only available within an active POS shift context
  - Max 3 failed attempts, then lockout for 15 minutes
  - PIN login returns a short-lived access token (1 hour, POS-scoped permissions)
- **RBAC system** (base already has `sys_role`, `sys_permission`, `sys_user_role`, `sys_role_permission`, `authorized()` middleware):
  - Extend with retail-specific predefined roles seeded per tenant: Platform Super Admin (public schema only), Tenant Admin, Business Owner, Shop Manager, Warehouse Staff, Cashier/POS Operator, Viewer
  - Custom role creation with JSONB permissions: `{ "products": ["view","create","edit"], "pos": ["view","create"], ... }`
  - `authorized()` middleware already supports role + permission checks: `authorized('ADMIN', 'pos.transaction.create')`
  - SYSADMIN role already bypasses all `authorized()` checks in base
- **Location-scoped access:**
  - `user_locations` join table: userId + locationId + role override (optional)
  - `location-scope` middleware injects `WHERE location_id IN (...)` filter
  - Users with `global_access: true` flag bypass location filter
- **Session timeout:**
  - Configurable per role: Admin 30min, Cashier 8hours (shift-based), Manager 4hours
  - Frontend idle detection triggers re-auth prompt
  - POS: idle for 5 minutes triggers PIN re-entry (not full logout)

**Frontend:**
- Login page already exists in base (email/password)
- POS PIN login screen (numeric keypad, large touch targets) -- new
- AuthProvider already exists in base (`src/client/provider/authProvider.tsx`); extend with PIN auth
- Protected route guards already exist in base (`Authorized` component, `has-roles`, `has-permissions`); add LocationGuard

> **Sprint 2 Status:** ✅ PIN login route (`/auth/pin-login`) and UI confirmed. ✅ RBAC with retail-specific predefined roles seeded. ✅ `approvalMiddleware.ts` and `auditMiddleware.ts` exist. ✅ JWT `locationIds` claim confirmed (login handler reads `userLocation` table). ✅ Redis token blacklisting confirmed (logout writes `token_blacklist:{token}`, `authenticated()` checks it). ✅ `resolveLocationScope()` middleware implemented and wired into `locationRoutes`, `posRoutes`, `shiftRoutes`, `inventoryMgmtRoutes` with `inArray` filtering on list endpoints.

### Sprint 3 (Weeks 5-6): Location Management and Tax Configuration — ✅ COMPLETE

**Deliverables:**
- **Location module** (created via `npm run create-module`):
  - `GET/POST /api/modules/location/location` -- list/create
  - `GET/PUT/DELETE /api/modules/location/location/:id` -- detail/update/deactivate
  - Fields: code (unique), name, type (shop/warehouse/dc), address, city, province, phone, operating_hours (JSONB), timezone, sync_config (JSONB), status
  - Location type determines module availability (POS only for shop type)
  - Route handlers use `req.tenantDb` for all queries, `authorized()` for permissions
- **Location hierarchy:**
  - Optional parent-child: Region > Area > Shop (up to 4 levels)
  - Materialized path pattern for efficient hierarchy queries
  - Frontend uses base's TreeView component for hierarchy display
- **Sync configuration per shop:**
  - `sync_config` JSONB: `{ frequency: "twice_daily", windows: ["06:00","18:00"], bandwidth_mode: "full", manual_sync_enabled: true }`
- **Tax configuration module** (created via `npm run create-module`):
  - `GET/PUT /api/modules/tax/config` -- get/update PPN config
  - Fields: rate_percent, effective_date, calc_mode (inclusive/exclusive), status
  - Historical rate preservation: new rate inserts new row, old row gets `status: historical`
  - Tax config synced to offline POS clients
- **Frontend** (using shadcn/ui components, React Hook Form + Zod):
  - Locations list page with DataTable (TanStack Table already in base)
  - Location create/edit form with React Hook Form + Zod validation
  - Sync configuration panel per shop location
  - Tax configuration page (admin only, protected via `<Authorized>` component)

### Sprint 4 (Weeks 7-8): Product/SKU Management — ✅ COMPLETE

**Deliverables:**
- **Product module** (created via `npm run create-module`, then `npm run add-page` for each entity):
  - `GET/POST /api/modules/product/product` -- list (with pagination, filters, search) / create
  - `GET/PUT/DELETE /api/modules/product/product/:id` -- detail/update/archive
  - Full-text search on name, sku_code, barcode using PostgreSQL `tsvector`
  - Product lifecycle: Draft > Active > Discontinued > Archived
- **Variants:**
  - `POST /api/modules/product/product/:id/variants` -- create variant
  - Variant attributes stored as JSONB (size, color, material, etc.)
  - Each variant has independent SKU code, cost price, selling price, barcodes
- **Barcodes:**
  - Multiple barcodes per product/variant (EAN-13, UPC-A, internal)
  - `GET /api/modules/product/barcode/:code` -- fast barcode lookup (indexed)
- **Categories:**
  - Multi-level category tree (up to 4 levels), adjacency list with materialized path
  - `GET/POST/PUT/DELETE /api/modules/product/category`
  - Frontend uses base's TreeView component
- **UoM conversion:**
  - Conversion factors table: product_id, procurement_uom, sales_uom, conversion_factor
  - Example: Pack of 12 (procurement) to Individual (sales), factor = 12
- **Location-specific pricing:**
  - `product_location_prices` table: product_id, location_id, selling_price, cost_price
  - Override logic: location price > default price
- **Product images:**
  - Upload via express-fileupload (already in base) to S3, store URLs in `product_images` table
  - Max 5 per product, primary image flagged
- **Bulk import/export:**
  - CSV template download endpoint
  - CSV import with row-level validation, partial import support
  - Idempotent import using sku_code as unique key
- **Frontend** (shadcn/ui + React Hook Form + Zod):
  - Product list with filters (category, status, search) using DataTable and DataPagination
  - Product create/edit form with variant management
  - Barcode assignment panel
  - Category tree management using TreeView component
  - CSV import wizard with error display
  - Bulk export to CSV

> **Sprint 4 Status:** ✅ Fully implemented. Product CRUD, Category CRUD with tree, variants (add/edit/delete with JSONB attributes), barcodes (EAN-13/UPC-A/internal), UoM conversions, location-specific pricing, product images (URL-based, primary flag), barcode lookup, and bulk import/export all confirmed in codebase. S3 upload for images is deferred — images are stored as URLs only.

### Sprint 5 (Weeks 9-10): Approval Engine and User Management — ✅ COMPLETE

**Deliverables:**
- **Configurable approval engine module** (via `npm run create-module`):
  - `GET/PUT /api/modules/approval/config` -- list/update approval configs
  - Supported transaction types: PurchaseOrder, GRN, SupplierReturn, StockTransfer, StockAdjustment, POSRefund, POSDiscount
  - Per-type config: `{ is_required: boolean, approver_role_id: UUID, threshold_amount: number | null, timeout_hours: number, timeout_action: 'escalate' | 'auto_approve' }`
  - Thresholds configurable per shop/retailer (as decided)
  - Approval middleware that intercepts state transitions and routes to approval queue if configured
- **Approval workflow:**
  - `GET /api/modules/approval/pending` -- pending approvals for current user's role
  - `POST /api/modules/approval/:id/approve` -- approve
  - `POST /api/modules/approval/:id/reject` -- reject (mandatory reason)
  - In-app notifications for pending approvals
  - Email notification via Nodemailer (optional, configurable)
  - Timeout job (BullMQ): check aged approvals, escalate or auto-approve
- **User management** (base already has `/api/system/user` CRUD):
  - Extend base user management with location assignment
  - User-location assignment with role per location
  - Invitation flow: create user, send email with password setup link via Nodemailer
- **Audit log:**
  - Middleware-based: intercepts all CRUD operations
  - Records: user_id, action, module, entity_id, before_data (JSONB), after_data (JSONB), ip_address, timestamp
  - Immutable: no update/delete on audit_logs table
  - `GET /api/modules/approval/audit-logs` -- searchable, filterable
- **Frontend** (shadcn/ui + React Hook Form):
  - Approval configuration page (admin, protected via `<Authorized>`)
  - Pending approvals dashboard widget
  - Approval detail with approve/reject actions using ConfirmDialog
  - User management CRUD pages extending base system user pages
  - Role management with permission matrix UI
  - Audit log viewer with filters using DataTable

### Sprint 6 (Weeks 11-12): Tenant Onboarding Wizard and CSV Import — ✅ COMPLETE

**Deliverables:**
- **Onboarding module** (via `npm run create-module`):
  - `GET /api/modules/onboarding/status` -- current step and progress
  - `PUT /api/modules/onboarding/step/:stepNumber` -- save step data
  - `POST /api/modules/onboarding/complete` -- finalize onboarding
- **10-step wizard:**
  1. Company profile (name, NPWP, address, logo upload via express-fileupload)
  2. Create locations (shops/warehouses)
  3. Configure tax (PPN rate, inclusive/exclusive)
  4. Create initial users with roles and location assignments
  5. Import products (CSV template download, upload, validate, review errors, confirm)
  6. Import suppliers (same CSV flow)
  7. Set opening stock balances (per location per SKU)
  8. Configure approval rules
  9. Configure offline sync settings per shop
  10. Review summary and go-live
- **CSV import engine:**
  - Template generation with headers, data types, sample rows, validation rules
  - Streaming CSV parser (Papa Parse) for large files
  - Row-by-row validation with Zod schemas
  - Partial import: valid rows imported, invalid rows returned with error details (row number, column, error)
  - Idempotent: re-import uses unique keys (sku_code, supplier_code) to upsert
  - Progress tracking for large imports (via WebSocket or polling)
- **Opening stock import:**
  - Sets initial inventory per SKU per location
  - Creates `inventory_movements` entry with type `opening_balance`
  - Effective date configurable (defaults to import date)
- **Frontend** (shadcn/ui + React Hook Form):
  - Step-by-step wizard with progress bar (shadcn/ui Card + Button components)
  - Steps skippable (except Company Profile and Tax Config)
  - Resumable: progress saved per step
  - CSV upload component with drag-and-drop
  - Import preview table showing parsed data using DataTable
  - Error table with row-level error display
  - Summary/review page with all configured data

---

## 6. Phase 2: Procurement (Weeks 13-22)

### Sprint 7 (Weeks 13-14): Supplier Management — ✅ COMPLETE

**Deliverables:**
- **Supplier module** (via `npm run create-module`):
  - `GET/POST /api/modules/supplier/supplier` -- list with search/filter, create
  - `GET/PUT/DELETE /api/modules/supplier/supplier/:id` -- detail/update/deactivate
  - Fields: code, name, NPWP (validated: 15 or 16 digits), address, payment_terms, lead_time_days, bank_details (JSONB), status
  - Multiple contact persons per supplier with roles (sales, AR, logistics)
- **Supplier-product catalog:**
  - `POST /api/modules/supplier/supplier/:id/products` -- link products with supplier-specific pricing and MOQ
  - Supplier-specific prices used in PO creation
- **Bulk import:**
  - CSV import for suppliers (same engine as onboarding)
- **Frontend** (shadcn/ui):
  - Supplier list and detail pages using DataTable + DataPagination
  - Supplier-product linking interface
  - Contact person management
  - Supplier import via CSV

### Sprint 8 (Weeks 15-17): Purchase Order Management — ✅ COMPLETE

**Deliverables:**
- **Purchase order module** (via `npm run create-module`):
  - `POST /api/modules/purchase-order/po` -- create PO
  - `PUT /api/modules/purchase-order/po/:id/status` -- state transitions
  - States: Draft > Pending Approval > Approved > Sent to Supplier > Partially Received > Fully Received > Closed
  - Approval integration: if APR config requires PO approval, transition Draft > Pending Approval
  - Auto-approve if not configured
- **PO features:**
  - Auto-generated PO number: `PO-{YYYYMM}-{SEQUENCE}` per tenant
  - Line items with SKU, qty, unit price (from supplier catalog), tax (PPN), discount
  - Tax calculation using admin-configured PPN rate
  - PO amendment before "Sent" state (versioned, audit trail)
  - PO cancellation with mandatory reason code
  - Partial receipt tracking: remaining qty per line
  - PDF generation for sending to supplier
- **Reorder suggestions:**
  - `GET /api/modules/purchase-order/suggestions` -- suggests reorders when stock < min threshold
  - Editable before PO creation
- **Frontend** (shadcn/ui + React Hook Form):
  - PO list with status filters using DataTable
  - PO create/edit form with supplier selection and line item management
  - PO detail with status timeline
  - PO PDF preview and download
  - Reorder suggestion dashboard

### Sprint 9 (Weeks 18-20): GRN with Quality Inspection — ✅ COMPLETE

**Deliverables:**
- **GRN module** (via `npm run create-module`):
  - `POST /api/modules/grn/grn` -- create GRN against a PO
  - States: Draft > Quality Inspection > Accepted > Stock Updated
  - Quality inspection step: bypassable per product/supplier config
  - Approval integration (configurable)
- **GRN features:**
  - GRN number auto-generated
  - Line items: received qty, accepted qty, rejected qty, rejection reason codes
  - Batch/lot number tracking (optional)
  - Expiry date recording for perishable goods
  - Delivery note/invoice reference capture
  - Partial receipt: multiple GRNs per PO
  - Stock update on acceptance: inventory incremented at receiving location
  - Barcode scanning for receiving (HID scanner support)
- **GRN offline capability:**
  - GRN creation works offline
  - Saved to IndexedDB, local stock updated immediately
  - Synced to server on next sync window
  - Reconciled with server stock on sync
- **Document generation:**
  - GRN PDF with all details and barcode
  - Printable via standard or thermal printer
- **Frontend** (shadcn/ui + React Hook Form):
  - GRN create form with PO lookup
  - Line item receiving interface with qty inputs
  - Quality inspection checklist
  - GRN detail and print view

### Sprint 10 (Weeks 21-22): Supplier Returns and Credit Notes — ✅ COMPLETE

**Deliverables:**
- **Supplier return module** (via `npm run create-module`):
  - States: Requested > Pending Approval > Approved > Dispatched > Acknowledged by Supplier > Credit Note Received > Closed
  - Reason codes: defective, damaged, expired, excess, wrong item
  - Line items with qty and per-item reason
  - Linked to original GRN/PO
  - Approval integration (configurable)
- **Credit notes:**
  - Record credit note number, amount, date, linked to return
  - Outstanding credits visible on supplier profile
- **Replacement receipt:**
  - Alternative to credit note: replacement GRN linked to return
- **Inventory adjustment:**
  - Stock decremented at source location on dispatch
- **Frontend** (shadcn/ui):
  - Return request form with GRN lookup
  - Return status tracking
  - Credit note recording form
  - Supplier returns history

---

## 7. Phase 3: POS and Offline (Weeks 23-34)

### Sprint 11 (Weeks 23-25): POS Sales Interface — ✅ COMPLETE

**Deliverables:**
- **POS module** (via `npm run create-module`):
- **POS sales screen (React 19, shadcn/ui, full-screen, touch-optimized):**
  - Layout: product grid (left/center), cart panel (right)
  - Top bar: current shift info, cashier name, online/offline indicator, pending sync count
  - Product grid: category tabs, product tiles (image/name/price), switchable to list view
  - Search bar with auto-focus for barcode scanner input
  - Large touch targets (minimum 44px per NFR)
  - Keyboard shortcuts: F1-F12 for payment methods, Enter for checkout, Esc to cancel
- **Cart management:**
  - Add item (scan or search)
  - Quantity +/- buttons
  - Per-item discount (percentage or fixed)
  - Per-transaction discount
  - Discount authorization: if discount exceeds threshold, require manager approval (inline PIN prompt)
  - Remove item
  - Line totals with tax calculation
  - Cart footer: subtotal, discount total, tax total, grand total (large font)
- **Barcode scanning:**
  - HID keyboard wedge: listen for rapid character input followed by Enter
  - `useBarcodeScanner` hook: debounced input detection distinguishing keyboard from scanner
  - Scanned barcode looks up product via indexed `barcodes` table (local Dexie.js when offline)
  - Audible feedback: success beep vs. error beep (Web Audio API)
  - Handles EAN-13, UPC-A, and internal barcode formats
- **Tax calculation:**
  - PPN applied per line item based on `tax_applicable` flag
  - Inclusive or exclusive mode per tenant tax config
  - Tax breakdown shown per line and as summary
- **Transaction ID generation:**
  - Format: `{SHOP_CODE}-{YYYYMMDD}-{SEQUENCE}`
  - Offline: local sequence counter stored in IndexedDB
  - On sync: local IDs remapped to server-issued IDs; local ID preserved as `offline_id` for reference
- **Inventory decrement:**
  - Stock decremented locally on sale completion
  - Configurable negative stock handling: block sale or allow with alert

### Sprint 12 (Weeks 26-27): Payments and Checkout — ✅ COMPLETE

**Deliverables:**
- **Checkout flow:**
  - Checkout button opens payment modal (shadcn/ui Dialog)
  - Payment method selection: Cash, QRIS (manual reference), Bank Transfer (manual reference), Card (manual reference)
  - Amount entry per method
  - Cash: change calculation displayed prominently (large font)
  - QRIS: reference number input field (manual entry, no gateway integration in Phase 1)
  - Bank Transfer: bank name, reference number
  - Card: last 4 digits, approval code
- **Split payments:**
  - Multiple payment methods per transaction
  - Running total showing remaining balance
  - Each method recorded with amount and reference
  - Validation: total payments must equal or exceed grand total
- **Post-payment:**
  - Receipt auto-prints to thermal printer
  - Success confirmation screen (3 seconds)
  - Cart resets for next customer
  - Transaction saved to local DB (IndexedDB if offline, server via Axios if online)

### Sprint 13 (Weeks 28-29): Thermal Printing and Receipt Management — ✅ COMPLETE

**Deliverables:**
- **Printer manager service:**
  - Abstraction layer over WebUSB and WebSerial APIs
  - Auto-detection of connected printers
  - Supported printer profiles:
    - Epson TM-T82 / TM-T82X / TMU-220B (USB, ESC/POS)
    - Star Micronics TSP645II (USB)
    - Iware MP-58II / MP-58R (USB)
    - VSC TM-58D (USB)
    - Kassen models (USB)
  - Paper width detection: 58mm vs 80mm (from printer profile config)
  - Connection management: connect, disconnect, reconnect, status check
  - Print queue with retry (up to 3 attempts)
  - **Chrome-only constraint**: WebUSB and WebSerial require Chrome/Chromium. Display browser compatibility warning on non-Chrome browsers.
- **ESC/POS command builder:**
  - Text formatting: bold, double-height, double-width, underline, alignment (left/center/right)
  - Line feed, cut paper (full/partial)
  - Barcode printing (Code128 for transaction ID)
  - QR code printing (for QRIS payment reference, if applicable)
  - Drawer kick command (documented but not used -- cash drawer is manual)
  - Character encoding: CP437 + Indonesian characters
- **Receipt template:**
  - Shop name and address (from location config)
  - Transaction ID, date/time, cashier name
  - Itemized lines: name, qty, unit price, discount, line total
  - Subtotal, discount total, tax (PPN) total, grand total
  - Payment method(s) with amounts
  - Change amount (for cash)
  - Footer: thank you message, shop contact
  - Barcode of transaction ID (for returns lookup)
- **Receipt reprint (new requirement):**
  - `POST /api/modules/pos/transaction/:id/reprint`
  - Lookup transaction by ID or by scanning receipt barcode
  - Reprint marked in audit log
  - Available to Cashier and Manager roles (via `authorized()`)
- **Void transaction (new requirement):**
  - `POST /api/modules/pos/transaction/:id/void`
  - Only allowed within current shift
  - Requires manager authorization (PIN prompt)
  - Reverses inventory: stock re-incremented
  - Void receipt printed
  - Full audit trail: who voided, reason, timestamp
  - Voided transactions excluded from shift summary totals but visible in reports

### Sprint 14 (Weeks 30-31): Shift Management and Hold/Recall — ✅ COMPLETE

**Deliverables:**
- **Shift module** (via `npm run create-module`):
  - `POST /api/modules/shift/shift/open` -- open shift (cashier, device, opening float)
  - `POST /api/modules/shift/shift/:id/close` -- close shift (cash count, variance)
  - `POST /api/modules/shift/shift/:id/cash-drop` -- mid-shift cash drop
  - No transactions processable without open shift
  - Shift close: expected vs. actual cash, variance with reason, optional manager sign-off
  - Shift summary report: total sales count, revenue by payment method, returns count/value, opening float, expected cash, actual cash, variance
  - Shift report printable via thermal printer
  - Shift data works offline, synced on next window
- **Hold/recall transactions (promoted to Must):**
  - `POST /api/modules/pos/transaction/hold` -- park current cart
  - `GET /api/modules/pos/transaction/held` -- list held transactions
  - `POST /api/modules/pos/transaction/:id/recall` -- recall to active cart
  - Max held transactions per shift: configurable (default 10)
  - Auto-release after configurable timeout (default 30 minutes)
  - Held transactions stored in IndexedDB (works offline)
  - Visual indicator: "3 held" badge on POS screen
  - Held transaction list: customer note, item count, total, age
- **Session timeout (new requirement):**
  - POS idle detection: 5 minutes of no interaction triggers screen lock
  - Screen lock requires PIN re-entry (not full logout, shift stays open)
  - Configurable timeout per role in system settings (via `sys_option` table already in base)
  - Active transaction preserved during screen lock

### Sprint 15-16 (Weeks 32-34): Offline Architecture and Sync Engine — ✅ COMPLETE

**Deliverables:**
- **Service Worker (Workbox via vite-plugin-pwa):**
  - Cache strategies:
    - App shell: CacheFirst (HTML, JS, CSS, images)
    - API responses (catalog, prices, tax): StaleWhileRevalidate with 24h TTL
    - Transaction API: NetworkFirst with offline fallback to IndexedDB
  - Background sync registration for queued transactions
  - Offline fallback page
  - Version management: prompt user to refresh when new SW available
- **IndexedDB schema (Dexie.js):**
  ```typescript
  // Conceptual Dexie schema
  db.version(1).stores({
    products: 'id, sku_code, *barcodes, category_id, status',
    prices: '[product_id+location_id], product_id',
    taxConfig: 'id, effective_date',
    syncQueue: '++localId, type, status, createdAt',
    transactions: 'id, offlineId, shiftId, locationId, createdAt, syncStatus',
    transactionLines: '++id, transactionId, productId',
    payments: '++id, transactionId',
    shifts: 'id, locationId, status',
    heldTransactions: 'id, shiftId, createdAt',
    inventory: '[locationId+productId], locationId',
    syncMeta: 'key',
    conflicts: '++id, type, resolvedAt'
  });
  ```
- **Sync engine module** (via `npm run create-module`):
  - **Outbound sync** (client to server):
    - Priority order: shifts > sales transactions > GRNs > stock counts > transfers > adjustments
    - Batch size: 50 transactions per request
    - Each transaction has UUID (idempotent -- server deduplicates)
    - Retry with exponential backoff (1s, 2s, 4s, 8s, max 30s)
    - Progress callback for UI (X of Y synced)
  - **Inbound sync** (server to client):
    - Delta sync: client sends `lastSyncTimestamp`, server returns changes since
    - Catalog updates (new/changed products, prices, tax rates)
    - Approval status updates
    - Transfer status updates
    - Inventory corrections
  - **Sync scheduling:**
    - Reads shop's `sync_config` from local cache
    - Schedules sync at configured windows (e.g., 06:00, 18:00)
    - Manual sync trigger button always available
    - Immediate sync when coming back online (if `auto_sync_on_reconnect: true`)
  - **Sync protocol:**
    ```
    POST /api/modules/sync/push
    Body: { locationId, deviceId, lastSyncId, transactions: [...], shifts: [...], grns: [...] }
    Response: { accepted: [...], conflicts: [...], serverSyncId }

    POST /api/modules/sync/pull
    Body: { locationId, lastPullTimestamp, categories: ['catalog','prices','tax','approvals'] }
    Response: { products: [...], prices: [...], taxConfig: {...}, timestamp }
    ```
  - **Queue management:**
    - Warning at 2,000 queued transactions
    - Hard block at 5,000: must sync before new transactions
    - Queue size displayed in sync status bar
    - Offline duration alert: notify manager if > 24 hours offline
  - **Bandwidth optimization:**
    - Compressed payloads (gzip)
    - Essential-only mode: omit product images, send minimal fields
    - Configurable per shop via `bandwidth_mode` in sync config
- **Data integrity:**
  - Each offline transaction gets UUID (v4)
  - Server-side idempotency check: reject if UUID already processed
  - Local sequence numbers replaced with server IDs on sync confirmation
  - Recovery mode: if IndexedDB corrupts, full re-sync from server
- **Encryption at rest:**
  - IndexedDB encryption using AES-256-GCM
  - Encryption key derived from user credentials + device fingerprint
  - Key stored in memory only (never persisted to disk)
  - On logout: encryption context cleared (data remains encrypted, inaccessible)

---

## 8. Phase 4: Transfers and Inventory (Weeks 35-42)

### Sprint 17 (Weeks 35-37): Inter-Shop Transfers — ✅ COMPLETE

**Deliverables:**
- **Transfer module** (via `npm run create-module`):
  - States: Requested > Pending Approval > Approved > Picking > Dispatched (In Transit) > Received > Closed
  - `POST /api/modules/transfer/transfer` -- create transfer request
  - `PUT /api/modules/transfer/transfer/:id/approve` -- approve (if configured)
  - `PUT /api/modules/transfer/transfer/:id/dispatch` -- dispatch (decrements source stock, marks In Transit)
  - `PUT /api/modules/transfer/transfer/:id/receive` -- receive at destination (increments destination stock)
  - Partial receipt with discrepancy recording (short/over/damaged with reason codes)
  - Approval integration (configurable)
- **In-transit tracking:**
  - In-transit inventory visible in reports but excluded from available-for-sale
  - `inventory.in_transit` field per SKU per location
  - Transfer status timeline visible to both source and destination
- **Document generation:**
  - Pick list (printable)
  - Packing slip
  - Transfer document (PDF)
- **Offline capability:**
  - Transfer request, dispatch, and receive all work offline
  - Queued in IndexedDB, synced on schedule
  - Conflict scenarios handled by sync engine (see Section 11)
- **Frontend** (shadcn/ui + React Hook Form):
  - Transfer request form (source, destination, items with qty)
  - Transfer list with status filters using DataTable + SortButton
  - Picking interface with barcode scanning
  - Receive interface with qty confirmation and discrepancy entry
  - Transfer detail with status timeline

### Sprint 18 (Weeks 38-40): Stock Counts and Adjustments — ✅ COMPLETE

**Deliverables:**
- **Inventory module** (via `npm run create-module`):
- **Stock counts (full inventory count):**
  - `POST /api/modules/inventory/stock-count` -- create count session
  - `PUT /api/modules/inventory/stock-count/:id/lines` -- record counted quantities
  - `POST /api/modules/inventory/stock-count/:id/finalize` -- finalize and apply adjustments
  - Count sheet generation per location (printable)
  - Barcode scanning for item identification during count
  - Variance report: system qty vs. counted qty per SKU
  - Offline-capable: count sessions work fully offline, sync on schedule
- **Stock adjustments:**
  - `POST /api/modules/inventory/stock-adjustment` -- manual adjustment
  - Mandatory reason codes: damage, theft, write-off, correction, other
  - Approval required if configured (via approval module)
  - Full audit trail
- **Inventory movement ledger:**
  - `GET /api/modules/inventory/movement` -- all movements for any SKU
  - Types: sale, return, grn, transfer_out, transfer_in, adjustment, opening_balance, stock_count
  - Running balance per SKU per location
  - Filterable by date, type, location, SKU
- **Low-stock alerts:**
  - Configurable min/max thresholds per SKU per location
  - In-app notification when stock falls below minimum
  - Optional email alerts via Nodemailer
  - Alert dashboard widget
- **Frontend** (shadcn/ui):
  - Inventory overview: stock by location with search/filter using DataTable + DataPagination
  - Stock count session: start, scan/enter counts, review variance, finalize
  - Adjustment form with reason code selection
  - Movement ledger with filters and drill-down
  - Alert configuration per SKU/location

### Sprint 19 (Weeks 41-42): Inventory Consolidation and Valuation — ✅ COMPLETE

**Deliverables:**
- Consolidated inventory view across all locations
- Drill-down from total to per-location stock
- Inventory valuation: Weighted Average Cost (default) or FIFO (configurable per tenant via `sys_option`)
- In-transit inventory visibility
- On-order quantities from open POs
- Stock quantity states: On Hand, Available, Reserved, In Transit, On Order

---

## 9. Phase 5: Reporting and Analytics (Weeks 43-50)

### Sprint 20 (Weeks 43-45): Consolidated Dashboard and Core Reports — ✅ COMPLETE

**Deliverables:**
- **Report module** (via `npm run create-module`):
- **Consolidated dashboard:**
  - KPI cards: Total Revenue (today/MTD), Total Inventory Value, Pending Approvals, Active Transfers, Low-Stock Alerts, Shops Offline
  - Revenue chart: bar/line comparing shops for selected period (Recharts)
  - Inventory distribution: stock value by location (Recharts)
  - Sync status panel: each shop's last sync time, pending transaction count
  - Recent activity feed: latest transactions, GRNs, transfers, approvals
  - Quick action buttons: New PO, New Transfer, Stock Count
  - Load time target: < 3 seconds
  - Data fetched via React Query (@tanstack/react-query) with appropriate caching/stale times
- **Inventory reports:**
  - Stock on hand by location
  - Stock movement history
  - Aging analysis
  - Valuation report
  - Slow-moving/dead stock
  - Stock count variance
- **Revenue reports:**
  - Sales by shop (daily/weekly/monthly)
  - Sales by product/category
  - Revenue comparison across shops
  - Gross margin analysis
  - Sales trend analysis
  - Top-selling SKUs

### Sprint 21 (Weeks 46-48): POS, Tax, Procurement, and Transfer Reports — ✅ COMPLETE

**Deliverables:**
- **POS reports:**
  - Transactions per shift
  - Average basket value
  - Payment method breakdown
  - Hourly sales distribution
  - Cashier performance
  - Discount utilization
  - Void transactions report
- **Tax reports:**
  - PPN collected by period
  - PPN by location
  - PPN by product category
  - Tax-inclusive vs. tax amount breakdown
  - Exportable for Faktur Pajak preparation (CSV/XLSX)
- **Procurement reports:**
  - PO status summary
  - Supplier performance scorecard
  - GRN timeliness
  - Return rate by supplier
- **Transfer reports:**
  - Transfer volume between locations
  - Transit time analysis
  - Discrepancy summary

### Sprint 22 (Weeks 49-50): Export and Scheduled Reports — ✅ COMPLETE

**Deliverables:**
- **Export formats:**
  - PDF (jsPDF with formatted tables and charts)
  - Excel/XLSX (SheetJS with formatted worksheets)
  - CSV (raw data export)
  - Export buttons on all report pages
- **Scheduled reports:**
  - `POST /api/modules/report/schedule` -- create schedule
  - Configurable: report type, parameters, frequency (daily/weekly/monthly), recipients
  - BullMQ job: generates report at scheduled time, emails via Nodemailer as attachment
  - Schedule management UI

> **Sprint 22 Status:** ✅ PDF export per module confirmed. ✅ Consolidated CSV/XLSX/PDF export added to all 6 report pages via `exportUtils.ts`. ✅ `report_schedules` table (`scripts/install.sql`). ✅ `POST/GET/PUT/DELETE /api/modules/report/schedule` CRUD. ✅ BullMQ `REPORT_GENERATION` worker generates CSV/XLSX and emails via Nodemailer. ✅ Repeating scheduler job (every 5 min) checks and enqueues due schedules. ✅ `ScheduledReports.tsx` management UI at `/console/modules/report/schedules`.

---

## Unplanned Additions (Implemented Beyond Original Scope)

- **Integration module** — API key management, webhook dispatch, partner and event management. Full CRUD with `apiKeyRoutes.ts`, `webhookRoutes.ts`, `partnerRoutes.ts`, `eventRoutes.ts`, `webhookDispatcher.ts`, and `apiKeyMiddleware.ts`. Not in the original plan but fully implemented.

---

## 10. Phase 6: Optimization and Migration (Weeks 51-56)

### Sprint 23 (Weeks 51-52): MokaPOS Data Migration — ❌ NOT STARTED

**Deliverables:**
- **Migration module** (via `npm run create-module`):
  - MokaPOS data export analysis and field mapping document
  - Migration scripts:
    - Products/SKUs with categories and barcodes
    - Suppliers with contracts and pricing
    - Historical transactions (for reporting continuity)
    - Customer data (if applicable)
    - Inventory balances (as opening stock)
  - Data transformation pipeline:
    1. Export from MokaPOS (CSV/API)
    2. Transform to system CSV templates
    3. Validate using existing CSV import engine
    4. Import via onboarding wizard or bulk import API
  - Reconciliation report: source record count vs. imported count per entity
  - Rollback capability: mark migrated records, bulk delete if needed
- **Migration wizard UI:**
  - Step-by-step guide for MokaPOS migration
  - Field mapping preview
  - Dry-run mode (validate without importing)
  - Progress tracking for large datasets

### Sprint 24 (Weeks 53-54): Cycle Counting and Performance Tuning — ❌ NOT STARTED

**Deliverables:**
- **Cycle counting:**
  - Rotating partial counts by category, zone, or ABC classification
  - Schedule configuration: which SKUs/categories counted when
  - Count sheet generation filtered by cycle criteria
  - Variance tracking with trend analysis
- **Performance tuning:**
  - PostgreSQL query optimization: EXPLAIN ANALYZE on critical queries
  - Index review and optimization
  - TenantConnectionManager pool tuning (connection limits, idle timeouts)
  - API response time profiling and optimization
  - Frontend bundle size optimization (code splitting, lazy loading via React Router 7)
  - React component memoization for POS performance
  - Sync engine throughput optimization:
    - Batch insert optimization using Drizzle's batch insert API
    - Parallel processing of independent sync batches
    - Target: process 5,000 transactions from a single shop in < 60 seconds

### Sprint 25 (Weeks 55-56): Data Archival and Mobile Optimization — ❌ NOT STARTED

**Deliverables:**
- **Data archival:**
  - Policy: 3 months online, then archive to S3
  - BullMQ scheduled job: runs nightly
  - Archive process:
    1. Select transactions older than 3 months via `req.tenantDb`
    2. Export to compressed JSON/Parquet files
    3. Upload to S3 with tenant/year/month path structure
    4. Record archive metadata in `archive_log` table
    5. Delete archived records from PostgreSQL
  - Restore capability: admin can request restore of archived period
  - Archived data accessible via separate "historical reports" endpoint
- **Mobile optimization:**
  - Responsive layout verification on tablet (768px+)
  - Touch target verification (44px minimum)
  - POS interface optimized for 10" tablet portrait and landscape
  - Reduced data payloads for mobile network
  - Image optimization (WebP, lazy loading, thumbnails)

---

## 11. Sync Conflict Resolution Spec

### 11.1 General Principles

- **Server-wins** as the default resolution strategy for master data (products, prices, tax rates)
- **Client-wins** for transaction data (sales are always accepted; the sale happened in reality)
- **Flag for review** when server-wins would materially affect a completed transaction
- Every conflict generates an entry in the `conflicts` table and appears in the manager's conflict resolution queue

### 11.2 Conflict Scenarios

#### Scenario 1: Price Changed on Server While Shop Offline

**Situation:** Admin changes selling price of SKU-A from Rp 50,000 to Rp 55,000 at 10:00. Shop-7 has been offline since 08:00 and sells 15 units of SKU-A at Rp 50,000 between 08:00 and 14:00. Shop syncs at 18:00.

**Resolution:**
1. Server accepts all 15 sales transactions at the offline price (Rp 50,000) -- the sale happened at that price.
2. Server flags these transactions as `price_stale` in the sync response.
3. Server calculates revenue delta: 15 units x (Rp 55,000 - Rp 50,000) = Rp 75,000 shortfall.
4. Conflict record created: type `price_change_during_offline`, affected transactions, delta amount.
5. Client receives updated price (Rp 55,000), updates local catalog.
6. Manager notification: "15 sales of SKU-A were at old price. Revenue difference: Rp 75,000."
7. Manager reviews and acknowledges (no financial adjustment needed -- price at time of sale is valid).

**Implementation:** During sync push, server compares each sale line's `unit_price` against the active price at the transaction timestamp. If different, flag the conflict.

#### Scenario 2: Same SKU Sold at Two Offline Shops Depleting Stock

**Situation:** SKU-B has 5 units at Warehouse-1 (allocated to Shop-A and Shop-B). Shop-A (offline) sells 3 units. Shop-B (offline) sells 4 units. Total sold: 7 units, but only 5 exist.

**Resolution:**
1. Both shops' sales are accepted (sales happened in reality).
2. Server processes Shop-A's sync first: stock goes from 5 to 2.
3. Server processes Shop-B's sync: stock goes from 2 to -2.
4. If tenant config `allow_negative_stock: true`: stock recorded as -2, conflict flagged.
5. If tenant config `allow_negative_stock: false`: sales still accepted (cannot un-sell), but stock set to 0 with a `stock_discrepancy` conflict record for the -2 units.
6. Manager notification: "SKU-B oversold by 2 units across Shop-A and Shop-B. Current stock: -2. Action required."
7. Manager resolution options:
   - Create emergency PO to replenish
   - Investigate and create stock adjustment
   - Transfer from another location

**Implementation:** Inventory update uses atomic SQL via `req.tenantDb`: `UPDATE inventory SET on_hand = on_hand - :qty` (atomic). After update, check if `on_hand < 0` and create conflict if so.

#### Scenario 3: GRN Received Offline While PO Cancelled on Server

**Situation:** PO-100 is cancelled by the admin at 09:00. Warehouse staff at Location-3 (offline since 07:00) receives goods against PO-100 at 11:00 and creates GRN-050. Location-3 syncs at 18:00.

**Resolution:**
1. Server receives GRN-050 referencing PO-100 (status: cancelled).
2. Server does NOT reject the GRN -- goods were physically received.
3. GRN-050 accepted with status `conflict_po_cancelled`.
4. Stock is NOT automatically incremented (unlike normal GRN acceptance).
5. Conflict record created: type `grn_against_cancelled_po`, GRN-050, PO-100.
6. Manager notification: "GRN-050 received against cancelled PO-100. Stock not updated. Review required."
7. Manager resolution options:
   - Confirm receipt and update stock (override, creates adjustment entry)
   - Initiate supplier return for the received goods
   - Reopen PO-100 if cancellation was in error

**Implementation:** During sync push, server checks PO status before processing GRN. If PO is cancelled/closed, accept GRN but hold stock update pending resolution.

#### Scenario 4: Transfer Dispatched but Destination Offline

**Situation:** Shop-A dispatches Transfer-200 (10 units of SKU-C) to Shop-B at 10:00. Shop-A syncs immediately (online). Shop-B has been offline since 08:00 and remains offline until 20:00.

**Resolution:**
1. Server records dispatch: Shop-A stock decremented, items marked In Transit.
2. Transfer-200 status: Dispatched/In Transit on server.
3. When Shop-B syncs at 20:00, inbound sync includes Transfer-200 with status "awaiting receipt."
4. Shop-B's local inventory shows incoming transfer notification.
5. Shop-B staff confirms receipt (online or offline for next sync).
6. If Shop-B never confirms within configurable timeout (e.g., 72 hours):
   - Auto-escalation notification to Shop-A manager and Business Owner
   - Transfer remains In Transit until manually resolved

**No conflict** in this case -- this is normal async workflow. The system handles it via the transfer state machine.

#### Scenario 5: Concurrent Stock Adjustments

**Situation:** Manager at Shop-A creates a stock adjustment (write-off 5 units of SKU-D, reason: damage) while offline. At the same time, a stock count at the same shop (conducted by another staff member, also offline) records SKU-D as having 20 units (system shows 25).

**Resolution:**
1. Both operations synced. Server processes in timestamp order.
2. If adjustment processed first: stock 25 - 5 = 20. Then stock count says actual is 20. No variance -- resolved.
3. If stock count processed first: system updated to 20 (adjustment of -5). Then write-off of 5 applied: 20 - 5 = 15. But the stock count already established the correct count.
4. Conflict: stock count and adjustment overlap, potential double-counting of the loss.
5. Conflict flagged: "Stock count and adjustment for SKU-D at Shop-A overlap. Verify actual quantity."
6. Manager must verify and resolve.

**Implementation:** Detect overlapping stock operations for the same SKU+location within the same offline period. Flag for review.

### 11.3 Conflict Resolution UI

- **Manager Conflict Queue** (`/conflicts`):
  - List of unresolved conflicts with: type, affected entities, timestamp, severity (DataTable + SortButton)
  - Detail view per conflict with full context (before/after, affected transactions)
  - Resolution actions specific to conflict type
  - Bulk acknowledge for informational conflicts (e.g., stale prices) using ConfirmDialog
  - Resolution audit trail

---

## 12. API Design Conventions

### 12.1 URL Structure

The base framework uses `/api/` directly (no version prefix). Core system routes use `/api/auth/*` and `/api/system/*`. All retail module routes follow the base's module pattern: `/api/modules/{module-id}/{entity}`.

```
Base URL: /api
Tenant context: derived from JWT or X-Tenant-Code header (no tenant ID in URL)

System routes (already in base):
  POST   /api/auth/login                          # User login
  POST   /api/auth/register                       # User registration
  POST   /api/auth/refresh                        # Refresh token
  POST   /api/auth/forget-password                # Password reset request
  POST   /api/auth/reset-password                 # Password reset
  GET    /api/system/user                          # User management
  GET    /api/system/role                          # Role management
  GET    /api/system/permission                    # Permission management

Retail module routes (new):
  POST   /api/auth/login/pin                       # POS PIN login (extends base auth)

  GET    /api/modules/location/location            # List locations
  POST   /api/modules/location/location            # Create location
  GET    /api/modules/location/location/:id        # Get location detail
  PUT    /api/modules/location/location/:id        # Update location
  DELETE /api/modules/location/location/:id        # Deactivate location

  GET    /api/modules/product/product              # List products (paginated)
  POST   /api/modules/product/product              # Create product
  GET    /api/modules/product/product/:id          # Get product detail
  PUT    /api/modules/product/product/:id          # Update product
  DELETE /api/modules/product/product/:id          # Soft delete / deactivate
  GET    /api/modules/product/product/:id/variants # List variants
  POST   /api/modules/product/product/:id/variants # Create variant
  GET    /api/modules/product/barcode/:code        # Barcode lookup

  POST   /api/modules/shift/shift/open             # Open POS shift
  POST   /api/modules/shift/shift/:id/close        # Close POS shift
  POST   /api/modules/pos/transaction              # Create sale
  POST   /api/modules/pos/transaction/:id/void     # Void sale
  POST   /api/modules/pos/transaction/:id/reprint  # Reprint receipt
  POST   /api/modules/pos/transaction/hold         # Hold transaction
  GET    /api/modules/pos/transaction/held          # List held
  POST   /api/modules/pos/transaction/:id/recall   # Recall held

  POST   /api/modules/sync/push                    # Push offline data
  POST   /api/modules/sync/pull                    # Pull server updates
```

### 12.2 Request/Response Format

```json
// Successful response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 150,
    "totalPages": 8
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product with ID xyz not found",
    "details": []    // Optional: validation errors
  }
}

// Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "sku_code", "message": "SKU code is required" },
      { "field": "selling_price", "message": "Must be a positive number" }
    ]
  }
}
```

### 12.3 Pagination

- Cursor-based for large datasets (transactions, movements): `?cursor=eyJ...&limit=50`
- Offset-based for smaller datasets (products, suppliers): `?page=1&pageSize=20`
- Default page size: 20. Maximum: 100.
- Frontend uses base's DataPagination component for pagination UI

### 12.4 Filtering and Sorting

```
GET /api/modules/product/product?status=active&category_id=abc&search=keyword&sort=-created_at&page=1&pageSize=20
```

- `sort`: field name, prefix `-` for descending (frontend uses base's SortButton component)
- `search`: full-text search across relevant fields
- Filters: query parameters matching field names

### 12.5 Versioning

- No URL-based versioning -- the base uses `/api/` directly
- Breaking changes managed via module versioning in `module.json`
- Deprecation: 6-month notice before removing old endpoints

### 12.6 Rate Limiting

- Auth endpoints: 10 requests/minute per IP (already configured in base)
- General API: 100 requests/minute per user
- Sync endpoints: 10 requests/minute per device (syncs are batched)
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## 13. Testing Strategy

### 13.1 Unit Tests (Vitest)

- **Target coverage**: 80% for business logic
- **Backend**: Service layer functions (tax calculation, inventory updates, approval logic, sync conflict resolution)
- **Frontend**: React components (POS cart logic, discount calculation, payment splitting), React Query hooks, utility functions
- **Shared**: Zod validation schemas, currency formatting, ID generation

### 13.2 Integration Tests (Vitest + Supertest)

- All API endpoints tested with authenticated requests
- Multi-tenant isolation verified: request with Tenant-A token must not access Tenant-B data
- Database state setup/teardown per test suite using `req.tenantDb`
- Approval workflow state machine transitions
- CSV import with valid/invalid data
- Sync push/pull with conflict scenarios

### 13.3 End-to-End Tests (Playwright)

The base already has Playwright set up with authenticated page fixtures (`tests/fixtures/auth.ts`).

#### Admin E2E Suite — TA-001 to TA-050 (59/59 passing as of 2026-05-11)

| Phase | Spec File | Tests | Scenarios |
|-------|-----------|-------|-----------|
| Phase 1 | `smoke.spec.ts` | 11 | Auth, navigation, basic CRUD |
| Phase 2 | `product.spec.ts` | 6 | TA-001..006 product catalog |
| Phase 2 | `po-grn-sr-chain.spec.ts` | 16 | TA-020..029 PO → GRN → SR lifecycle |
| Phase 2 | `inventory.spec.ts` | 5 | TA-030..032, TA-047 stock count, adjustments, alerts |
| Phase 3 | `transfer.spec.ts` | 4 | TA-033..034, TA-046 transfer lifecycle + discrepancy |
| Phase 3 | `report.spec.ts` | 5 | TA-035..038, TA-049 dashboard KPIs + scheduled reports |
| Phase 3 | `user-management.spec.ts` | 3 | TA-039..040 create MANAGER/CASHIER users |
| Phase 3 | `moka-migration.spec.ts` | 3 | TA-041..042 CSV import + rollback |
| Phase 3 | `edge-cases.spec.ts` | 2 | TA-048, TA-050 audit log + inactive location |

**Key implementation notes:**
- POs are created as `draft`; approval engine triggers on `PUT /po/:id/status { status: 'approved' }` (not on creation)
- GRN receivable response uses `purchaseOrderItemId` and `orderedQuantity` (not `id`/`quantity`)
- SR returnable response uses `grnItemId` (maps grn_item.id in context)
- PO status updates to `partially_received`/`fully_received` only when GRN reaches `stock_updated`
- Inventory `ON CONFLICT` requires `UNIQUE (location_id, product_id)` constraint — added to `create-module-tables.mjs`
- Alert config GET returns `{ configs }` not `{ alertConfigs }`
- Stock count lines PUT requires `{ productId, skuCode, productName, countedQty }` (not `{ id, countedQty }`)
- Role list `/api/system/role` filters `isSystem=false`; use `/api/system/user/ref-roles` for MANAGER/CASHIER
- `report_schedules` table may be absent — TA-038 accepts 500 from that endpoint gracefully

- **Critical paths:**
  - Full POS sale flow: open shift, scan item, checkout, print receipt, close shift
  - Offline POS: disable network, complete sale, re-enable, verify sync
  - Onboarding wizard: complete all 10 steps
  - Procurement: create PO, receive GRN, verify stock update
  - Transfer: create, approve, dispatch, receive, verify stock at both locations
- **Offline testing:**
  - Playwright's `context.setOffline(true)` to simulate network loss
  - Verify all offline-capable operations work
  - Verify sync queue builds up
  - Re-enable network, trigger sync, verify data reaches server
- **Cross-browser:** Chrome only for POS (WebUSB/WebSerial). Other modules tested on Chrome and Firefox.
- **Running tests** (already configured in base):
  ```bash
  npm run test:e2e              # Run all tests headless
  npm run test:e2e:ui           # Interactive UI mode
  npm run test:e2e:headed       # See browser while testing
  npm run test:e2e:debug        # Debug mode with inspector
  npm run test:e2e:report       # View HTML report
  ```

### 13.4 Performance Tests

- **Load testing** (k6 or Artillery):
  - Simulate 500 concurrent users across tenants
  - POS transaction throughput: target 1,000 transactions/minute across all shops
  - Sync endpoint: 200 shops syncing 100 transactions each concurrently
  - Report generation under load
- **Sync stress test:**
  - Single shop pushing 5,000 queued transactions
  - 200 shops syncing simultaneously (worst case: all sync at same window)
  - Measure: throughput, latency, database write contention, connection pool saturation

### 13.5 Security Tests

- OWASP ZAP automated scan in CI
- SQL injection testing (parameterized queries via Drizzle ORM verified)
- JWT manipulation testing
- Cross-tenant access attempts
- Rate limiting verification
- IndexedDB encryption verification

---

## 14. Deployment Architecture

### 14.1 Environments

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| Local Dev | Developer machines | Docker Compose (PG, Redis) |
| CI | Automated testing | GitHub Actions runners |
| Staging | Pre-production testing | AWS ECS (single instance) |
| Production | Live system | AWS ECS (multi-AZ) |

### 14.2 Docker Setup

```
docker-compose.yml (development):
  - app: Node.js app (Vite dev server + Express backend, hot-reload)
  - postgres: PostgreSQL 16
  - redis: Redis 7

docker-compose.prod.yml:
  - app: Node.js production build (multi-stage Docker)
  - nginx: Serving static build + reverse proxy
```

### 14.3 Production Architecture (AWS)

```
Internet
  └── Cloudflare (CDN, WAF, DDoS protection)
        └── ALB (Application Load Balancer)
              ├── ECS Fargate: API Service (2-4 tasks, auto-scaling)
              ├── ECS Fargate: Sync Worker Service (2-4 tasks, auto-scaling)
              └── ECS Fargate: Job Worker (BullMQ processors, 1-2 tasks)
        └── S3 + CloudFront: Static frontend assets

  RDS PostgreSQL 16 (Multi-AZ, db.r6g.xlarge)
    └── Read replica (for reports)
  ElastiCache Redis (for sessions, BullMQ, cache)
  S3 (for archived data, product images, CSV uploads, report exports)
  SES / Nodemailer SMTP (for email delivery)
  CloudWatch + Prometheus + Grafana (monitoring)
  Sentry (error tracking)
  AWS Secrets Manager (credentials)
```

### 14.4 CI/CD Pipeline (GitHub Actions)

```
On Pull Request:
  1. Lint (ESLint)
  2. Type check (tsc --noEmit)
  3. Unit tests (Vitest)
  4. Integration tests (Vitest + Supertest against Docker PG)
  5. Build check

On merge to main:
  1. All PR checks
  2. Build Docker images
  3. Push to ECR
  4. Deploy to Staging
  5. Run E2E tests against Staging (Playwright)
  6. Manual approval gate
  7. Deploy to Production (blue-green)
  8. Smoke tests
  9. Rollback if smoke tests fail
```

### 14.5 Database Migrations in Production

1. Drizzle migrations applied to public schema during deployment (`npm run db:migrate`)
2. Tenant schema updates applied via module SQL scripts:
   - For new modules: `install.sql` applied to each active tenant schema
   - For module updates: incremental SQL scripts applied via background job
   - Iterate all active tenant schemas
   - Apply pending SQL scripts in order
   - If a tenant migration fails, alert ops team; do not block other tenants
3. Backward-compatible changes only (no column drops without deprecation period)

---

## 15. Security Considerations

### 15.1 Authentication and Sessions

- JWT signed with RS256 (asymmetric keys)
- Access token: 15-minute expiry, contains: userId, tenantId, schemaName, role, locationIds
- Refresh token: 7-day expiry, opaque string stored in Redis, rotated on each use
- Token blacklisting: on logout, access token added to Redis blacklist (TTL = remaining token life)
- POS PIN: 6-digit, stored as bcrypt hash (cost factor 10), never transmitted in plaintext
- Password policy: minimum 8 characters, at least one uppercase, one lowercase, one digit
- Failed login lockout: 5 attempts, 15-minute lockout

### 15.2 Session Timeouts

| Role | Idle Timeout | Absolute Timeout |
|------|-------------|-----------------|
| Platform Super Admin | 15 minutes | 8 hours |
| Tenant Admin | 30 minutes | 8 hours |
| Business Owner | 30 minutes | 12 hours |
| Shop Manager | 60 minutes | 12 hours |
| Cashier (POS) | 5 minutes (PIN re-entry) | Shift duration |
| Warehouse Staff | 30 minutes | 8 hours |
| Viewer | 15 minutes | 4 hours |

### 15.3 Data Security

- TLS 1.2+ for all data in transit
- AES-256 encryption at rest (RDS encryption, S3 server-side encryption)
- Tenant data isolation enforced at:
  - Database level (schema separation via TenantConnectionManager)
  - Middleware level (tenant context from JWT via `resolveTenantContext()`)
  - Query level (Drizzle ORM instance scoped to tenant schema via `req.tenantDb`)
- Input validation with Zod on all API endpoints (validationMiddleware already in base)
- Parameterized queries (Drizzle ORM default) -- no raw SQL without review
- CORS configured per environment (allow only known origins, already in base)
- CSRF protection for cookie-based sessions (if used alongside JWT)
- Content Security Policy headers
- Rate limiting on all authentication endpoints (already in base)

### 15.4 IndexedDB Security

- All data in IndexedDB encrypted using AES-256-GCM
- Encryption key: derived using PBKDF2 from (user PIN/password + device fingerprint + salt)
- Salt stored in browser's `crypto.subtle` keystore (not in IndexedDB)
- On logout: encryption key purged from memory
- On shift close: POS-specific cached data (transactions) marked for cleanup
- Data at rest in IndexedDB is ciphertext -- if browser storage is compromised, data is unreadable without credentials

### 15.5 Browser Support Matrix

| Browser | POS Module | Admin/Back-Office |
|---------|-----------|------------------|
| Chrome 120+ | Full support (WebUSB, WebSerial) | Full support |
| Chromium-based (Edge, Opera) | Full support | Full support |
| Firefox | NOT SUPPORTED for POS | Supported (no printing) |
| Safari | NOT SUPPORTED for POS | Limited (no printing) |

**Chrome-only constraint for POS**: WebUSB and WebSerial APIs are available only in Chrome/Chromium browsers. The POS module will display a browser compatibility check on load and block access from unsupported browsers with a clear message directing users to Chrome.

Admin/back-office modules that do not require hardware integration will work on modern browsers (Chrome, Firefox, Edge).

### 15.6 Audit Trail

- Immutable audit log table (no UPDATE/DELETE permissions)
- All CRUD operations logged via middleware
- Before/after values stored as JSONB
- Includes: user_id, action, module, entity_type, entity_id, ip_address, user_agent, timestamp
- Retention: 1 year online, then archived to S3
- Accessible to Tenant Admin and Platform Super Admin (via `authorized()` middleware)

---

## 16. Performance Targets and Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| POS checkout (scan to receipt) | < 3 seconds | E2E test with thermal printer |
| Barcode scan to product display | < 0.5 seconds | Frontend performance test (IndexedDB lookup) |
| Dashboard page load | < 3 seconds | Lighthouse / RUM |
| API response (transactional) | < 2 seconds (p95) | Load test with k6 |
| Report generation (standard) | < 10 seconds | API test under load |
| Concurrent users | 500+ simultaneous | Load test (across all tenants) |
| Inventory update propagation | < 5 seconds | Integration test (online locations) |
| System uptime | 99.5% | Monitoring (Prometheus/CloudWatch) |
| Offline POS performance | No degradation vs. online | Comparative E2E test |
| Sync throughput (single shop) | 5,000 transactions in < 60 seconds | Sync stress test |
| Sync throughput (200 shops concurrent) | Complete within 15-minute window | Sync stress test |
| Database write throughput (sync) | 10,000 inserts/second sustained | PG benchmark during sync |
| IndexedDB barcode lookup | < 50ms | Browser performance test |
| Service Worker cache hit (app shell) | < 500ms cold, < 100ms warm | Lighthouse |
| Full catalog sync (100K SKUs) | < 5 minutes | Sync integration test |
| Delta catalog sync | < 30 seconds | Sync integration test |
| Offline queue: warning threshold | 2,000 transactions | UI alert test |
| Offline queue: hard block | 5,000 transactions | UI block test |

### Critical Bottleneck: Sync Engine Write Throughput

The most demanding scenario is 200 shops per tenant syncing simultaneously, each pushing up to 5,000 transactions. This yields up to 1,000,000 write operations in a single sync window.

**Mitigation strategy:**
1. **Stagger sync windows**: Default sync times distributed across the hour (not all at :00)
2. **Batch inserts**: Use Drizzle ORM's batch insert API with 100-row batches (not individual inserts)
3. **Dedicated sync worker pool**: Separate ECS service with dedicated TenantConnectionManager pool
4. **Write-ahead buffer**: Sync worker writes to Redis queue first, then bulk-inserts to PG asynchronously
5. **Connection management**: Dedicated pool of 20 connections for sync, separate from API pool (configured via TenantConnectionManager)
6. **Read replica**: Reports and dashboards query the read replica, keeping primary free for writes
7. **Partitioned transaction tables**: Monthly partitions reduce write contention on hot tables
8. **Monitoring**: Alert when sync processing time exceeds 5 minutes per shop

---

### Critical Files for Implementation

These are the most critical files, split between what already exists in the base and what must be created:

**Already exists in base (foundation -- no creation needed):**
- `src/server/lib/db/tenant-connection-manager.ts` -- Multi-tenant connection pooling and schema provisioning; provides `req.tenantDb` and `req.sharedDb`
- `src/server/middleware/authMiddleware.ts` -- `resolveTenantContext()`, `authenticated()`, `authorized()` middleware chain; every API call flows through this
- `src/server/middleware/moduleAuthMiddleware.ts` -- Module-level authorization checking if tenant has access to a module
- `src/server/lib/db/schema/system.ts` -- Shared schema definitions (sys_tenant, sys_module_registry, etc.)
- `src/server/main.ts` -- Express server config with route registration pattern
- `src/client/route.ts` -- React Router 7 configuration
- `src/client/provider/authProvider.tsx` -- AuthProvider with token refresh
- `src/client/components/auth/authorized.tsx` -- Permission-based component rendering
- `src/modules/moduleHelpers.ts` -- Module registration utilities
- `drizzle.config.ts` -- Drizzle ORM configuration

**Must be created (retail-specific):**
- `src/client/services/sync/sync-engine.ts` -- Core sync orchestrator handling push/pull, conflict detection, queue management, and retry logic; the most architecturally complex component
- `src/client/services/db/index.ts` -- Dexie.js IndexedDB schema definition and encrypted storage layer; foundation for all offline capability
- `src/client/services/printing/printer-manager.ts` -- WebUSB/WebSerial abstraction for thermal printer integration
- `src/client/services/printing/escpos-builder.ts` -- ESC/POS command generation for receipt printing
- `src/client/services/barcode/scanner-listener.ts` -- HID barcode scanner detection and handling
- `src/server/middleware/location-scope.ts` -- Location-based data filtering middleware
- `src/server/middleware/audit.ts` -- Audit trail middleware for all CRUD operations
- `src/modules/pos/` -- Complete POS module (the largest and most complex retail module)
- `src/modules/sync/` -- Sync engine server-side module with conflict resolution
- `src/modules/location/` -- Location management module (first module to create)

**Module creation workflow** (for each retail module):
```bash
npm run create-module          # Generate module scaffold
npm run add-page               # Add additional entities/pages
npm run register-module        # Register in 5 locations
npm run generate-sql {id}      # Generate SQL install script
npm run db:register-module {id} # Register in sys_module_registry
```
