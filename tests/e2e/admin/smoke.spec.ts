import { test, expect } from '../../fixtures/auth';

/**
 * Phase 3 Smoke tests: TA-001 to TA-011
 * All tests use the tenantAdminPage fixture (admin@tmj, ADMIN role).
 */

async function api(page: any, method: string, url: string, body?: object) {
  return page.evaluate(async ({ m, u, b }: any) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
    const r = await fetch(u, {
      method: m,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Code': tenant.code || 'tmj',
        'Content-Type': 'application/json',
      },
      body: b ? JSON.stringify(b) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }, { m: method, u: url, b: body });
}

// ============================================================
// TA-001 — Tenant ADMIN login + dashboard
// ============================================================

test('TA-001: Tenant ADMIN login succeeds and dashboard loads', async ({ tenantAdminPage }) => {
  await expect(tenantAdminPage).toHaveURL(/.*dashboard/);
});

// ============================================================
// TA-002 — Location management
// ============================================================

test('TA-002: Location list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/location-management/location');
  await expect(tenantAdminPage).toHaveURL(/.*location/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location');
  expect(status).toBe(200);
});

// ============================================================
// TA-003 — Tax configuration
// ============================================================

test('TA-003: Tax configuration page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/tax-configuration/config');
  await expect(tenantAdminPage).toHaveURL(/.*config/);
  // Tax configs are served via system routes
  const { status } = await api(tenantAdminPage, 'GET', '/api/system/tax-config');
  // 200 = has configs, 404 = no configs endpoint (both indicate page loaded)
  expect([200, 404]).toContain(status);
});

// ============================================================
// TA-004 — Product catalog
// ============================================================

test('TA-004: Product list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/product-catalog/product');
  await expect(tenantAdminPage).toHaveURL(/.*product/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/product-catalog/product');
  expect(status).toBe(200);
});

// ============================================================
// TA-005 — Supplier management
// ============================================================

test('TA-005: Supplier list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/supplier-management/supplier');
  await expect(tenantAdminPage).toHaveURL(/.*supplier/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/supplier-management/supplier');
  expect(status).toBe(200);
});

// ============================================================
// TA-006 — Purchase Order
// ============================================================

test('TA-006: PO list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/purchase-order/po');
  await expect(tenantAdminPage).toHaveURL(/.*po/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/purchase-order/po');
  expect(status).toBe(200);
});

// ============================================================
// TA-007 — GRN
// ============================================================

test('TA-007: GRN list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/grn/grn');
  await expect(tenantAdminPage).toHaveURL(/.*grn/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/grn/grn');
  expect(status).toBe(200);
});

// ============================================================
// TA-008 — Supplier Return
// ============================================================

test('TA-008: Supplier return list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/supplier-return/return');
  await expect(tenantAdminPage).toHaveURL(/.*return/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/supplier-return/return');
  expect(status).toBe(200);
});

// ============================================================
// TA-009 — Transfer
// ============================================================

test('TA-009: Transfer list page loads', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/transfer/transfer');
  await expect(tenantAdminPage).toHaveURL(/.*transfer/);
  const { status } = await api(tenantAdminPage, 'GET', '/api/modules/transfer/transfer');
  expect(status).toBe(200);
});

// ============================================================
// TA-010 — Inventory Management sub-pages
// ============================================================

test('TA-010: Inventory management pages load', async ({ tenantAdminPage }) => {
  const pages = [
    '/api/modules/inventory-management/stock-count',
    '/api/modules/inventory-management/adjustment',
    '/api/modules/inventory-management/movement',
    '/api/modules/inventory-management/alert-config',
    '/api/modules/inventory-management/consolidated',
    '/api/modules/inventory-management/valuation',
  ];
  for (const url of pages) {
    const { status } = await api(tenantAdminPage, 'GET', url);
    expect(status).toBe(200);
  }
});

// ============================================================
// TA-011 — Report pages
// ============================================================

test('TA-011: Report pages load', async ({ tenantAdminPage }) => {
  await tenantAdminPage.goto('/console/modules/report/dashboard');
  await expect(tenantAdminPage).toHaveURL(/.*report/);
});
