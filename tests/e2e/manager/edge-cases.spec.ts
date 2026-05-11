import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 Manager edge-case tests: EU-043, EU-049
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

// ──────────────────────────────────────────────────────────
// EU-043 — Manager cannot access system administration
// ──────────────────────────────────────────────────────────

test('EU-043: Manager cannot access system admin routes', async ({ managerPage }) => {
  // Tenant management (SYSADMIN only)
  const { status: ts } = await api(managerPage, 'GET', '/api/system/tenant');
  expect([401, 403]).toContain(ts);

  // Module registry (SYSADMIN only)
  const { status: mr } = await api(managerPage, 'GET', '/api/system/module-registry');
  expect([401, 403]).toContain(mr);

  // Global user creation (SYSADMIN only)
  const { status: uc } = await api(managerPage, 'POST', '/api/system/user/add', {
    username: 'hacker', fullname: 'Hacker', email: 'hack@hack.com', password: 'h4ck3r',
  });
  expect([401, 403]).toContain(uc);
});

// ──────────────────────────────────────────────────────────
// EU-049 — Stock count progress saved on interruption
// ──────────────────────────────────────────────────────────

test('EU-049: Stock count in-progress state persists after save', async ({ managerPage, tenantAdminPage }) => {
  // Get location and seed stock via admin
  const { data: ld } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location?perPage=5');
  const loc = (ld?.locations ?? []).find((l: any) => l.status === 'active');
  if (!loc) return;

  const { data: pd } = await api(tenantAdminPage, 'GET', '/api/modules/product-catalog/product?status=active');
  const product = (pd?.products ?? [])[0];
  if (!product) return;

  // Seed stock
  await api(tenantAdminPage, 'POST', '/api/modules/inventory-management/adjustment', {
    locationId: loc.id, productId: product.id,
    skuCode: product.skuCode, productName: product.name,
    qty: 100, reasonCode: 'correction', notes: 'EU-049 seed',
  });

  // Manager creates stock count (retail.inventory.count ✓)
  const { status: cs, data: cd } = await api(managerPage, 'POST',
    '/api/modules/inventory-management/stock-count', { locationId: loc.id });
  expect(cs).toBe(201);
  const countId = cd.id;

  // Get lines and partially update
  const { data: ld2 } = await api(managerPage, 'GET',
    `/api/modules/inventory-management/stock-count/${countId}`);
  const lines = (ld2.lines ?? []).slice(0, 3).map((l: any) => ({
    productId: l.productId,
    skuCode: l.skuCode,
    productName: l.productName,
    countedQty: Math.max(0, (l.systemQty ?? 0) - 2), // introduce a small variance
  }));

  if (lines.length > 0) {
    const { status: us } = await api(managerPage, 'PUT',
      `/api/modules/inventory-management/stock-count/${countId}/lines`, { lines });
    expect(us).toBe(200);
  }

  // Re-fetch count — verify lines are still in_progress (not auto-finalized)
  const { status: gs, data: gd } = await api(managerPage, 'GET',
    `/api/modules/inventory-management/stock-count/${countId}`);
  expect(gs).toBe(200);
  expect(gd.status).toBe('in_progress');

  // Verify updated counts persisted
  if (lines.length > 0) {
    const savedLine = (gd.lines ?? []).find((l: any) => l.productId === lines[0].productId);
    if (savedLine && savedLine.countedQty !== null) {
      expect(Number(savedLine.countedQty)).toBe(Number(lines[0].countedQty)); // DB returns numeric as string
    }
  }

  // Count is resumable — finalize now
  const { status: fs } = await api(managerPage, 'POST',
    `/api/modules/inventory-management/stock-count/${countId}/finalize`);
  expect(fs).toBe(200);
});
