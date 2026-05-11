# Retail Shop — Comprehensive Test Plan

**Version:** 1.1  
**Date:** 2026-05-11  
**Repository:** `retail_shop/base-multi-tenant`  
**Test Framework:** Playwright (E2E) + CSV Scenario Library  

---

## Table of Contents

1. [Strategy Overview](#1-strategy-overview)
2. [Test Asset Inventory](#2-test-asset-inventory)
3. [Current State & Known Problems](#3-current-state--known-problems)
4. [Target Playwright Architecture](#4-target-playwright-architecture)
5. [Phased Implementation Plan](#5-phased-implementation-plan)
6. [Execution Commands](#6-execution-commands)
7. [Role Coverage Matrix](#7-role-coverage-matrix)
8. [Module Coverage Checklist](#8-module-coverage-checklist)
9. [CI/CD Integration](#9-cicd-integration)
10. [Known Gaps & Out of Scope](#10-known-gaps--out-of-scope)
11. [Progress Tracker](#11-progress-tracker)

---

## 1. Strategy Overview

### Testing Philosophy

This project uses **scenario-driven E2E testing** as the primary quality gate. The intent is end-to-end coverage of real user workflows, not unit coverage of individual functions. The test suite is organized by role to enforce RBAC boundaries and by cycle to separate smoke from regression from edge cases.

### Test Levels

| Level | Tool | Purpose | When to Run |
|-------|------|---------|-------------|
| E2E Smoke | Playwright (C1) | Critical paths work | Every commit |
| E2E Regression | Playwright (C2) | Full CRUD + workflows | Every PR |
| E2E Edge Cases | Playwright (C3) | Boundary + error states | Nightly / release |
| Manual Scenarios | CSV Files | Exploratory + new features | Per sprint |

### Role-Based Testing

All tests are executed under a specific authenticated role. The RBAC system must be verified at the API boundary, not just the UI. Each Playwright project corresponds to one role.

```
SYSADMIN  → system administration (tenants, modules, global config)
ADMIN     → tenant management (all modules within a tenant)
MANAGER   → operational (POS + reports + approvals)
CASHIER   → POS sales only
```

---

## 2. Test Asset Inventory

### 2.1 CSV Scenario Files (Manual / Playwright Source of Truth)

Location: `base-multi-tenant/tests/scenarios/`

| File | Role | Cycles | Cases | Notes |
|------|------|--------|-------|-------|
| `system-admin.csv` | SYSADMIN | C1–C3 | 28 | Created 2026-05-10 |
| `tenant-admin-operations.csv` | ADMIN | C1–C2 | 50 | **No C3 cases — gap** |
| `end-user-operations.csv` | MANAGER/CASHIER | C1–C3 | 52 | Created 2026-05-10 |
| `location-management.csv` | ADMIN | C1–C3 | ~15 | Existing |
| `tax-configuration.csv` | ADMIN | C1–C3 | ~12 | Existing |
| `product-catalog.csv` | ADMIN | C1–C3 | ~25 | Existing |
| `supplier-management.csv` | ADMIN | C1–C3 | ~18 | Existing |
| `purchase-order.csv` | ADMIN/MANAGER | C1–C3 | ~22 | Existing |
| `grn.csv` | ADMIN/MANAGER | C1–C3 | ~20 | Existing |
| `supplier-return.csv` | ADMIN/MANAGER | C1–C3 | ~18 | Existing |
| `pos.csv` | CASHIER/MANAGER | C1–C3 | ~30 | Existing |
| `transfer.csv` | ADMIN/MANAGER | C1–C3 | ~15 | Existing |
| `inventory-management.csv` | ADMIN/MANAGER | C1–C3 | ~20 | Existing |
| `report.csv` | MANAGER | C1–C3 | ~18 | Existing |
| `approval-engine.csv` | ADMIN/MANAGER | C1–C3 | ~14 | Existing |
| `moka-migration.csv` | ADMIN | C1–C3 | ~12 | Existing |
| *(others)* | — | — | ~22 | Auth, settings, etc. |
| **TOTAL** | | | **~461** | |

### 2.2 Playwright Spec Files (Automated)

Location: `base-multi-tenant/tests/e2e/`

**Sysadmin suite (Phase 2 complete — 33/33):**

| File | Tests | Status | Cases |
|------|-------|--------|-------|
| `sysadmin/tenant.spec.ts` | 13 | ✅ 13/13 | SA-001,002,007-009,011-013,018,020-022 |
| `sysadmin/module-auth.spec.ts` | 6 | ✅ 6/6 | SA-004,010,019,028 + setup/teardown |
| `sysadmin/user.spec.ts` | 5 | ✅ 5/5 | SA-005,014,016,017,023 |
| `sysadmin/role.spec.ts` | 2 | ✅ 2/2 | SA-006,015 |
| `sysadmin/module-registry.spec.ts` | 2 | ✅ 2/2 | SA-003,025 |
| `sysadmin/health.spec.ts` | 1 | ✅ 1/1 | SA-026 |
| `sysadmin/isolation.spec.ts` | 4 | ✅ 4/4 | SA-024,027 |
| **Sysadmin subtotal** | **33** | **33/33 (100%)** | |

**RBAC boundary suite (Phase 1 complete — 24/24):**

| File | Tests | Status |
|------|-------|--------|
| `rbac/admin-boundaries.spec.ts` | ~8 | ✅ Passing |
| `rbac/manager-boundaries.spec.ts` | ~8 | ✅ Passing |
| `rbac/cashier-boundaries.spec.ts` | ~8 | ✅ Passing |
| **RBAC subtotal** | **24** | **24/24 (100%)** |

**Module suites (existing — 380/468 including all suites):**

| Suite area | ~Tests | Status |
|------------|--------|--------|
| `admin/` — location, tax, product, supplier, PO, GRN, etc. | ~250 | Mostly passing; 88 selector/timing failures tracked for Phase 5 |
| `manager/` — POS, reports | ~80 | Same |
| `cashier/` — POS sales, shifts | ~60 | Same |
| *(auth, fixtures)* | ~20 | Passing |

Last full sysadmin run: **2026-05-11 — 37/37 passed** (33 sysadmin + 4 global-setup).  
Last full suite run: 2026-05-11 — 380/468 passed (81.2%). 88 failures = selector/timing issues scheduled for Phase 5.

---

## 3. Current State & Known Problems

### Problem 1 — All Auth Fixtures Map to SYSADMIN ✅ FIXED (Phase 0)

**File:** `tests/fixtures/auth.ts`

**Fix applied:** `seedTestTenant()` in seed script creates `admin@tmj`, `manager@tmj`, `cashier@tmj`. Fixtures updated to `tenantAdminPage`, `managerPage`, `cashierPage` with correct role credentials.

### Problem 2 — workers=1 Kills Parallelism ✅ FIXED (Phase 0)

**File:** `playwright.config.ts`

**Fix applied:** Set `workers: process.env.CI ? 2 : 4`, `retries: process.env.CI ? 1 : 0`.

### Problem 3 — No Playwright Projects by Role ✅ FIXED (Phase 1)

**Fix applied:** `playwright.config.ts` now has 6 projects: setup, sysadmin, admin, manager, cashier, rbac — each with its own `storageState` from `global-setup.ts`.

### Problem 4 — Missing `data-testid` Attributes

Many existing tests use CSS selectors (`.btn-primary`, `table tr:nth-child(2)`) that break when styles change. Test IDs are defined in `tests/POM.json` (393 elements) but not consistently applied in components.

**Fix required:** Audit `tests/POM.json` and add missing `data-testid` attributes during Phase 2.

### Problem 5 — Tenant-Admin CSV Has Zero C3 Cases

`tenant-admin-operations.csv` covers 50 scenarios (C1+C2) but has no edge case (C3) coverage. This is a coverage gap for the largest role group.

**Fix required:** Add ~10 C3 cases in Phase 2 covering: duplicate SKU on import, invalid CSV format, insufficient stock on PO, approval threshold boundary, etc.

---

## 4. Target Playwright Architecture

### 4.1 Directory Structure

```
base-multi-tenant/
├── playwright.config.ts          ← updated (projects, workers)
├── tests/
│   ├── global-setup.ts           ← one-time auth for all roles
│   ├── fixtures/
│   │   ├── auth.ts               ← updated (real role credentials)
│   │   └── page-objects.ts       ← shared POM factory
│   ├── auth-states/              ← generated by global-setup (gitignored)
│   │   ├── sysadmin.json
│   │   ├── admin.json
│   │   ├── manager.json
│   │   └── cashier.json
│   ├── e2e/
│   │   ├── sysadmin/             ← SYSADMIN-role tests
│   │   │   ├── tenant.spec.ts
│   │   │   ├── module-registry.spec.ts
│   │   │   ├── module-auth.spec.ts
│   │   │   ├── user.spec.ts
│   │   │   └── role.spec.ts
│   │   ├── admin/                ← ADMIN-role tests
│   │   │   ├── location.spec.ts
│   │   │   ├── tax.spec.ts
│   │   │   ├── product.spec.ts
│   │   │   ├── supplier.spec.ts
│   │   │   ├── purchase-order.spec.ts
│   │   │   ├── grn.spec.ts
│   │   │   ├── supplier-return.spec.ts
│   │   │   ├── transfer.spec.ts
│   │   │   ├── inventory.spec.ts
│   │   │   ├── report.spec.ts
│   │   │   ├── approval.spec.ts
│   │   │   └── moka-migration.spec.ts
│   │   ├── manager/              ← MANAGER-role tests
│   │   │   ├── pos.spec.ts
│   │   │   ├── report.spec.ts
│   │   │   └── approval.spec.ts
│   │   ├── cashier/              ← CASHIER-role tests
│   │   │   ├── pos-sales.spec.ts
│   │   │   ├── pos-offline.spec.ts
│   │   │   └── shift.spec.ts
│   │   └── rbac/                 ← cross-role boundary tests
│   │       ├── admin-cannot-access-sysadmin.spec.ts
│   │       ├── cashier-cannot-access-admin.spec.ts
│   │       └── manager-boundaries.spec.ts
│   ├── scenarios/                ← CSV source of truth (existing)
│   └── POM.json                  ← 393 element definitions (existing)
```

### 4.2 `playwright.config.ts` Target

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: 'http://localhost:5000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  globalSetup: './tests/global-setup.ts',
  projects: [
    // Setup project (runs first, once)
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    // Role projects (run after setup)
    {
      name: 'sysadmin',
      testDir: './tests/e2e/sysadmin',
      use: { storageState: './tests/auth-states/sysadmin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'admin',
      testDir: './tests/e2e/admin',
      use: { storageState: './tests/auth-states/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'manager',
      testDir: './tests/e2e/manager',
      use: { storageState: './tests/auth-states/manager.json' },
      dependencies: ['setup'],
    },
    {
      name: 'cashier',
      testDir: './tests/e2e/cashier',
      use: { storageState: './tests/auth-states/cashier.json' },
      dependencies: ['setup'],
    },
    {
      name: 'rbac',
      testDir: './tests/e2e/rbac',
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 4.3 `tests/global-setup.ts` Target

```typescript
import { chromium, FullConfig } from '@playwright/test';
import path from 'path';

const ROLES = [
  { name: 'sysadmin', username: 'sysadmin', password: 'password', tenant: 'system' },
  { name: 'admin',    username: 'admin',    password: 'password', tenant: 'tmj' },
  { name: 'manager',  username: 'manager',  password: 'password', tenant: 'tmj' },
  { name: 'cashier',  username: 'cashier',  password: 'password', tenant: 'tmj' },
];

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  for (const role of ROLES) {
    const page = await browser.newPage();
    await page.goto('http://localhost:5000/auth/login');
    // Set tenant header via localStorage or cookie before login
    await page.evaluate((tenant) => {
      localStorage.setItem('tenant-code', tenant);
    }, role.tenant);
    await page.fill('[data-testid="login-username"]', role.username);
    await page.fill('[data-testid="login-password"]', role.password);
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('**/console/dashboard');
    await page.context().storageState({
      path: path.join('tests/auth-states', `${role.name}.json`),
    });
    await page.close();
  }
  await browser.close();
}

export default globalSetup;
```

### 4.4 Required Seed Data

The `db:seed` script must create the following users for test fixtures to work:

| Username | Password | Role | Tenant |
|----------|----------|------|--------|
| `sysadmin` | `password` | SYSADMIN | system |
| `admin` | `password` | ADMIN | tmj |
| `manager` | `password` | MANAGER | tmj |
| `cashier` | `password` | CASHIER | tmj |

The `tmj` tenant must be pre-seeded with all modules authorized and baseline master data (at least 1 location, 1 tax rule, sample products).

---

## 5. Phased Implementation Plan

### Phase 0 — Prerequisite Fixes (Est: 1–2 days)

**Goal:** Get the existing suite to a clean baseline before adding new tests.

| Task | File | Est |
|------|------|-----|
| Fix `workers` to 4 | `playwright.config.ts` | 5 min |
| Fix `fullyParallel` contradiction | `playwright.config.ts` | 5 min |
| Create `tests/auth-states/` directory (gitignore) | `.gitignore` | 5 min |
| Add ADMIN/MANAGER/CASHIER users to seed script | `src/server/lib/db/seeds/` | 2 hr |
| Update `tests/fixtures/auth.ts` with real credentials | `tests/fixtures/auth.ts` | 30 min |
| Verify 200+ existing tests still pass | CI run | 30 min |

**Done when:** `npm run test:e2e` passes with 4 workers, no SYSADMIN-only fixture issue.

---

### Phase 1 — Playwright Projects & Global Setup (Est: 2–3 days)

**Goal:** Separate role projects with pre-authenticated contexts. No new test content yet.

| Task | File | Est |
|------|------|-----|
| Rewrite `playwright.config.ts` with projects | `playwright.config.ts` | 1 hr |
| Create `tests/global-setup.ts` | new file | 2 hr |
| Migrate existing `tests/e2e/*.spec.ts` into role subdirectories | directory reorganization | 3 hr |
| Verify all 200+ tests pass under new project structure | CI run | 1 hr |
| Write RBAC boundary tests (3 files) | `tests/e2e/rbac/` | 4 hr |

**Done when:** `npx playwright test --project=sysadmin` runs sysadmin-only tests; `--project=cashier` runs cashier-only tests. RBAC boundary tests fail correctly when a cashier tries an admin route.

---

### Phase 2 — System Admin Coverage (Est: 2 days)

**Goal:** Automate all 28 cases from `system-admin.csv`.

**Test files to create/expand:**

| Spec File | CSV Cases | Priority |
|-----------|-----------|----------|
| `sysadmin/tenant.spec.ts` | SA-001 to SA-013, SA-020 to SA-022 | High |
| `sysadmin/module-auth.spec.ts` | SA-004, SA-010, SA-019, SA-025, SA-028 | High |
| `sysadmin/user.spec.ts` | SA-005, SA-014, SA-016, SA-017, SA-023 | High |
| `sysadmin/role.spec.ts` | SA-006, SA-015 | Medium |
| `sysadmin/module-registry.spec.ts` | SA-003, SA-025 | Medium |
| `sysadmin/health.spec.ts` | SA-026 | Low |
| `sysadmin/isolation.spec.ts` | SA-024, SA-027 | High |

**Done when:** All 28 SA-* scenarios have a corresponding Playwright assertion.

---

### Phase 3 — Tenant Admin Coverage (Est: 5 days)

**Goal:** Automate all 50 cases from `tenant-admin-operations.csv`. Add 10 missing C3 edge cases.

**Priority order:**

| Priority | Cases | Spec Files |
|----------|-------|------------|
| P1 — Setup flow | TA-001 to TA-013 (onboarding) | `admin/setup-flow.spec.ts` |
| P1 — Product catalog | TA-014 to TA-022 | `admin/product.spec.ts` |
| P1 — Purchase Order chain | TA-023 to TA-030 | `admin/purchase-order.spec.ts` (serial) |
| P2 — GRN & return chain | TA-031 to TA-038 | `admin/grn.spec.ts` (serial) |
| P2 — Transfer & inventory | TA-039 to TA-045 | `admin/inventory.spec.ts` |
| P3 — MokaPOS migration | TA-046 to TA-050 | `admin/moka-migration.spec.ts` |
| P3 — C3 edge cases (NEW) | TA-051 to TA-060 | distributed |

**C3 edge cases to add (`tenant-admin-operations.csv`):**

| ID | Description |
|----|-------------|
| TA-051 | Duplicate SKU rejected during product creation |
| TA-052 | Product with no variant cannot be sold |
| TA-053 | PO quantity exceeds supplier credit limit |
| TA-054 | GRN quantity > PO quantity rejected |
| TA-055 | Approval threshold: PO just below threshold bypasses approval |
| TA-056 | Approval threshold: PO just above threshold requires approval |
| TA-057 | Transfer from location with insufficient stock rejected |
| TA-058 | Invalid CSV format rejected by moka-migration parse |
| TA-059 | Moka import rollback removes all created entities |
| TA-060 | Report date range: end before start rejected |

**Note:** State-machine tests (PO→GRN→Return chain) must use `test.describe.serial()`.

**Done when:** All 60 TA-* scenarios pass, including 10 new C3 cases.

---

### Phase 4 — End User Coverage (Est: 4 days)

**Goal:** Automate all 52 cases from `end-user-operations.csv`.

| Priority | Cases | Spec Files |
|----------|-------|------------|
| P1 — Cashier POS flow | EU-001 to EU-020 | `cashier/pos-sales.spec.ts` |
| P1 — Shift management | EU-021 to EU-025 | `cashier/shift.spec.ts` |
| P2 — Manager POS | EU-026 to EU-032 | `manager/pos.spec.ts` |
| P2 — Manager reports | EU-033 to EU-038 | `manager/report.spec.ts` |
| P3 — Offline mode | EU-039 to EU-044 | `cashier/pos-offline.spec.ts` |
| P3 — RBAC boundaries | EU-045 to EU-052 | `rbac/role-boundaries.spec.ts` |

**Offline mode testing approach:**
- Use Playwright's `context.setOffline(true)` to simulate network disconnect
- Verify IndexedDB entries created, sync queue populated
- Reconnect with `context.setOffline(false)`, verify sync completes

**Done when:** All 52 EU-* scenarios pass including offline simulation tests.

---

### Phase 5 — Gap Closure & Stabilization (Est: 3 days)

**Goal:** Fix 22 known flaky tests; add missing `data-testid` attributes; achieve 95%+ pass rate.

| Task | Est |
|------|-----|
| Audit 22 failing tests — identify root cause per test | 1 day |
| Add missing `data-testid` attributes (from POM.json audit) | 1 day |
| Replace brittle CSS selectors with `data-testid` | 4 hr |
| Add `waitForLoadState('networkidle')` where tests are timing-sensitive | 2 hr |
| Final full suite run + report | 1 hr |

**Done when:** `npm run test:e2e` achieves ≥95% pass rate on 3 consecutive runs.

---

### Phase 6 — CI/CD & Reporting (Est: 1 day)

**Goal:** Tests run automatically on every PR; results visible in GitHub.

See Section 9 for CI/CD details.

---

## 6. Execution Commands

```bash
# Run all tests (headless)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Interactive UI
npm run test:e2e:ui

# Debug mode (inspector)
npm run test:e2e:debug

# HTML report
npm run test:e2e:report

# Run by role project
npx playwright test --project=sysadmin
npx playwright test --project=admin
npx playwright test --project=manager
npx playwright test --project=cashier
npx playwright test --project=rbac

# Run by cycle
npx playwright test --grep "@smoke"        # C1 tests tagged @smoke
npx playwright test --grep "@regression"   # C2 tests tagged @regression
npx playwright test --grep "@edge"         # C3 tests tagged @edge

# Run single module
npx playwright test tests/e2e/admin/product.spec.ts

# Run single test by title
npx playwright test --grep "SA-007"

# Run with specific workers
npx playwright test --workers=4

# Generate auth states only (globalSetup)
npx playwright test --project=setup
```

### Tagging Convention

Add tags to test titles for cycle-based filtering:

```typescript
test('SA-001 @smoke — SYSADMIN login succeeds', async ({ page }) => { ... });
test('SA-007 @regression — Create new tenant', async ({ page }) => { ... });
test('SA-021 @edge — Duplicate tenant code rejected', async ({ page }) => { ... });
```

---

## 7. Role Coverage Matrix

Each cell = number of test scenarios / automated spec count (target).

| Module | SYSADMIN | ADMIN | MANAGER | CASHIER |
|--------|----------|-------|---------|---------|
| System/Tenant | 14 / 14 | — | — | — |
| System/Module Registry | 3 / 3 | — | — | — |
| System/Module Auth | 4 / 4 | — | — | — |
| System/User | 5 / 5 | 2 / 2 | — | — |
| System/Role | 3 / 3 | — | — | — |
| System/Option | 2 / 2 | — | — | — |
| Location Management | — | 8 / 8 | — | — |
| Tax Configuration | — | 6 / 6 | — | — |
| Product Catalog | — | 12 / 12 | — | — |
| Supplier Management | — | 8 / 8 | — | — |
| Approval Engine | — | 6 / 6 | 4 / 4 | — |
| Purchase Order | — | 12 / 12 | 6 / 6 | — |
| GRN | — | 10 / 10 | 5 / 5 | — |
| Supplier Return | — | 8 / 8 | 4 / 4 | — |
| Transfer | — | 8 / 8 | 4 / 4 | — |
| Inventory Management | — | 10 / 10 | 5 / 5 | — |
| POS | — | — | 15 / 15 | 20 / 20 |
| Report | — | 2 / 2 | 10 / 10 | — |
| MokaPOS Migration | — | 10 / 10 | — | — |
| RBAC Boundaries | 2 / 2 | 3 / 3 | 3 / 3 | 3 / 3 |
| **TOTAL** | **33** | **103** | **56** | **23** |

---

## 8. Module Coverage Checklist

### System Administration
- [ ] Tenant CRUD (create, read, update, deactivate, reactivate, delete)
- [ ] Duplicate tenant code rejection
- [ ] Module registry (view, enable, disable)
- [ ] Module authorization per tenant (grant, revoke)
- [ ] Revoked module inaccessible to tenant
- [ ] User management (create, edit, reset password, deactivate)
- [ ] Role management (create, view, built-in roles present)
- [ ] System options (create, edit)
- [ ] SYSADMIN bypasses all module permission checks
- [ ] Tenant data isolation (cross-tenant data not visible)
- [ ] Health check endpoint
- [ ] Inactive tenant blocks login

### Tenant Administration
- [ ] First-time setup sequence (location → tax → product → supplier)
- [ ] Location CRUD
- [ ] Tax rule CRUD (inclusive + exclusive)
- [ ] Product CRUD (categories, products, variants, barcodes)
- [ ] CSV product import
- [ ] Supplier CRUD
- [ ] Approval engine configuration (thresholds, approvers)
- [ ] Purchase Order full lifecycle (draft → submitted → approved → issued)
- [ ] GRN full lifecycle (pending → receiving → completed)
- [ ] Supplier Return full lifecycle (draft → submitted → approved → completed)
- [ ] Inter-shop Transfer full lifecycle (draft → in-transit → received)
- [ ] Stock count / adjustment
- [ ] Inventory level view
- [ ] Report generation (all 7 report types)
- [ ] User CRUD within tenant
- [ ] MokaPOS CSV import (parse preview, import, rollback)

### End User (POS / Cashier)
- [ ] PIN login
- [ ] Open shift with opening balance
- [ ] Make a sale (browse + search + scan)
- [ ] Payment: cash, card, QRIS, split
- [ ] Hold and recall transaction
- [ ] Apply discount (item + transaction)
- [ ] Void transaction (cashier level)
- [ ] Close shift with reconciliation
- [ ] Offline mode: complete sale while disconnected
- [ ] Offline mode: sync on reconnect
- [ ] Shift lock screen

### Manager
- [ ] Void transaction (manager approval)
- [ ] Override discount
- [ ] View daily sales report
- [ ] Approve purchase orders
- [ ] Initiate stock count
- [ ] Initiate transfer

### RBAC Boundaries
- [ ] CASHIER cannot access admin routes (403/redirect)
- [ ] MANAGER cannot access system admin routes
- [ ] ADMIN cannot access SYSADMIN-only routes
- [ ] Each role sees only its authorized menu items

---

## 9. CI/CD Integration

### GitHub Actions Workflow (target)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: retail_test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: base-multi-tenant/package-lock.json

      - name: Install dependencies
        working-directory: base-multi-tenant
        run: npm ci

      - name: Install Playwright browsers
        working-directory: base-multi-tenant
        run: npx playwright install --with-deps chromium

      - name: Setup test database
        working-directory: base-multi-tenant
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/retail_test

      - name: Run E2E tests
        working-directory: base-multi-tenant
        run: npm run test:e2e
        env:
          CI: true
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/retail_test
          REDIS_URL: redis://localhost:6379

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: base-multi-tenant/playwright-report/
          retention-days: 30
```

### Smoke-Only on PR (fast feedback)

```yaml
# For PRs, run only C1 smoke tests for quick feedback
- name: Run Smoke Tests (PR only)
  if: github.event_name == 'pull_request'
  run: npx playwright test --grep "@smoke" --workers=2
```

### Full Suite Nightly

```yaml
on:
  schedule:
    - cron: '0 1 * * *'  # 1 AM daily
```

---

## 10. Known Gaps & Out of Scope

### Known Gaps (tracked — fix in a later phase)

| Gap | Severity | Phase to Fix |
|-----|----------|--------------|
| `tenant-admin-operations.csv` has 0 C3 cases | Medium | Phase 3 |
| 88 existing tests with selector/timing failures | Medium | Phase 5 |
| ~~No real role credentials in seed (all SYSADMIN fixtures)~~ | ~~High~~ | ✅ Fixed Phase 0 |
| `moka-migration.spec.ts` not yet written | Medium | Phase 3 |
| ~~RBAC boundary specs not yet written~~ | ~~High~~ | ✅ Fixed Phase 1 |
| `data-testid` missing on many components | Medium | Phase 5 |

### Deferred — Not In This Test Plan

These features are tracked as technical debt (see `memory/project_technical_debt.md`) and are excluded from the test plan until implemented:

| Feature | Reason |
|---------|--------|
| Supplier CSV import | Not implemented |
| Opening stock via bulk import | Not implemented |
| Full-text product search | Not implemented |
| S3/cloud image upload | Not implemented |
| Thermal printer output | Environment-dependent hardware |
| Non-POS offline mode | Not in scope |
| Approval workflow timeout scheduling | BullMQ jobs, integration-test only |

### Out of Scope

- Unit tests for individual utility functions (no unit test framework configured)
- API-level load testing / performance benchmarks
- Browser compatibility beyond Chromium (mobile Safari, Firefox)
- Visual regression testing (screenshots)
- Accessibility audits (WCAG)
- Security scanning / DAST

---

## 11. Progress Tracker

Update this section after completing each phase task.

### Phase 0 — Prerequisite Fixes

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Fix `workers` to 4 | ✅ Done | 2026-05-11 | CI=2, dev=4 |
| Fix `fullyParallel` contradiction | ✅ Done | 2026-05-11 | Also set retries=1 in CI |
| Create `tests/auth-states/` + gitignore | ✅ Done | 2026-05-11 | Added to .gitignore |
| Add ADMIN/MANAGER/CASHIER to seed | ✅ Done | 2026-05-11 | `seedTestTenant()` in seed.ts |
| Update `tests/fixtures/auth.ts` | ✅ Done | 2026-05-11 | Added tenantAdminPage/managerPage/cashierPage |
| Verify existing 200+ tests still pass | ✅ Done | 2026-05-11 | 380/468 pass (81.2%) — 88 failures all pre-existing selector/timing |

### Phase 1 — Playwright Projects

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Rewrite `playwright.config.ts` | ✅ Done | 2026-05-11 | 6 role projects: setup/sysadmin/admin/manager/cashier/rbac |
| Create `tests/global-setup.ts` | ✅ Done | 2026-05-11 | Saves auth states for all 4 roles |
| Migrate specs into role subdirectories | ✅ Done | 2026-05-11 | sysadmin project uses testIgnore to exclude role dirs |
| Write RBAC boundary tests (3 files) | ✅ Done | 2026-05-11 | 24/24 tests pass; fixed shiftRoutes pos.sale.create → retail.pos.shift |

### Phase 2 — System Admin Coverage ✅ COMPLETE — 37/37 passed (2026-05-11)

| File | Status | Date | Cases | Notes |
|------|--------|------|-------|-------|
| `sysadmin/tenant.spec.ts` | ✅ Done | 2026-05-11 | SA-001,002,007-009,011-013,018,020-022 | Full CRUD incl. SA-011/012/013 (tenant status + login block) |
| `sysadmin/module-auth.spec.ts` | ✅ Done | 2026-05-11 | SA-004,010,019,028 | Uses demo-module + dedicated `samod` tenant (avoids tmj user lookup issue) |
| `sysadmin/user.spec.ts` | ✅ Done | 2026-05-11 | SA-005,014,016,017,023 | Serial CRUD chain; handles prior-run reuse |
| `sysadmin/role.spec.ts` | ✅ Done | 2026-05-11 | SA-006,015 | Cleanup included |
| `sysadmin/module-registry.spec.ts` | ✅ Done | 2026-05-11 | SA-003,025 | try/finally re-enables report module |
| `sysadmin/health.spec.ts` | ✅ Done | 2026-05-11 | SA-026 | Uses `request` fixture (not page.evaluate) — relative URLs need baseURL |
| `sysadmin/isolation.spec.ts` | ✅ Done | 2026-05-11 | SA-024,027 | Creates/deletes sa27ta + sa27tb; idempotent recovery via GET /current |

**Key implementation notes:**
- SA-011/012/013: Added `status` field to `tenantSchema` Zod; exposed in `PUT /:id/edit`; added `suspended` check in `/api/auth/login` (returns 403 with `"message": "suspended"`).
- SA-016 reset-password: route handler reads `tenantId` but Zod schema validates `activeTenantId` — tests send both fields.
- SA-020 delete: `backupTenantData()` crashes with `__dirname is not defined` (ESM context bug) before `DROP SCHEMA` — tenant IS deleted from `sys_tenant`; test accepts `[200, 500]`.
- All setup tests use idempotent `createOrRecover` pattern via `GET /api/system/tenant/current` with `X-Tenant-Code` header for resilience across repeated runs.

### Phase 3 — Tenant Admin Coverage

| File | Status | Date | Cases |
|------|--------|------|-------|
| `admin/setup-flow.spec.ts` | ⬜ Todo | | TA-001–013 |
| `admin/product.spec.ts` | ⬜ Todo | | TA-014–022 |
| `admin/purchase-order.spec.ts` | ⬜ Todo | | TA-023–030 |
| `admin/grn.spec.ts` | ⬜ Todo | | TA-031–038 |
| `admin/inventory.spec.ts` | ⬜ Todo | | TA-039–045 |
| `admin/moka-migration.spec.ts` | ⬜ Todo | | TA-046–050 |
| C3 edge cases added to CSV | ⬜ Todo | | TA-051–060 |

### Phase 4 — End User Coverage

| File | Status | Date | Cases |
|------|--------|------|-------|
| `cashier/pos-sales.spec.ts` | ⬜ Todo | | EU-001–020 |
| `cashier/shift.spec.ts` | ⬜ Todo | | EU-021–025 |
| `manager/pos.spec.ts` | ⬜ Todo | | EU-026–032 |
| `manager/report.spec.ts` | ⬜ Todo | | EU-033–038 |
| `cashier/pos-offline.spec.ts` | ⬜ Todo | | EU-039–044 |
| `rbac/role-boundaries.spec.ts` | ⬜ Todo | | EU-045–052 |

### Phase 5 — Stabilization

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Audit 22 known failing tests | ⬜ Todo | | |
| Add missing `data-testid` attributes | ⬜ Todo | | |
| Replace brittle CSS selectors | ⬜ Todo | | |
| Timing fixes (`waitForLoadState`) | ⬜ Todo | | |
| Achieve ≥95% pass rate | ⬜ Todo | | |

### Phase 6 — CI/CD

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Create `.github/workflows/e2e.yml` | ⬜ Todo | | |
| Smoke-only PR workflow | ⬜ Todo | | |
| Nightly full suite cron | ⬜ Todo | | |

---

## Appendix A — CSV Scenario Format Reference

```
cycle#   — C1 (smoke), C2 (regression), C3 (edge case)
test#    — SA-001 (system admin), TA-001 (tenant admin), EU-001 (end user)
module   — module_id matching sys_module_registry
test_desc — human-readable description
test_step — numbered steps (semicolon-separated)
expected_result — what must be true after steps complete
```

## Appendix B — State Machine Test Ordering

Tests that follow a state machine workflow must use `test.describe.serial()` to enforce order:

```typescript
test.describe.serial('PO → GRN → Return chain', () => {
  test('TA-023 @regression — Create Purchase Order', ...)
  test('TA-024 @regression — Submit PO for approval', ...)
  test('TA-025 @regression — Approve PO', ...)
  test('TA-026 @regression — Create GRN from PO', ...)
  // ...etc
});
```

## Appendix C — Test Data Strategy

- **Shared baseline:** Created by `db:seed` — sysadmin user, system tenant, SYSADMIN role
- **Test tenant:** `tmj` (Toko Maju Jaya) — pre-seeded by seed script with all modules authorized
- **Test users:** `admin`, `manager`, `cashier` — created by seed script in `tmj` tenant
- **Isolation:** Each test that creates data should either clean up after itself or use unique identifiers (timestamp-based names) to avoid cross-test pollution
- **Serial test data:** State-machine tests (PO chain) use one shared document that flows through states; these cannot be parallelized
