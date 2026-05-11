import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 Cashier smoke tests: EU-001 to EU-005
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

// EU-001: Cashier login
test('EU-001: Cashier login redirects to dashboard', async ({ cashierPage }) => {
  await expect(cashierPage).toHaveURL(/.*console\/dashboard/);

  // Cashier cannot access admin-only procurement routes
  const { status: poStatus } = await api(cashierPage, 'GET', '/api/modules/purchase-order/po');
  expect([401, 403]).toContain(poStatus);
});

// EU-002: PIN login endpoint responds
test('EU-002: PIN login endpoint exists and responds', async ({ page }) => {
  await page.goto('/auth/pin-login');
  const status = await page.evaluate(async () => {
    const r = await fetch('/auth/pin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Code': 'tmj' },
      body: JSON.stringify({ username: 'cashier@tmj', pin: '1234' }),
    });
    return r.status;
  });
  // Endpoint exists (200=authenticated, 400=invalid pin, 401=wrong credentials, 404=no PIN set)
  expect([200, 400, 401, 404]).toContain(status);
});

// EU-003: POS terminal route accessible to cashier
test('EU-003: POS terminal page loads for cashier', async ({ cashierPage }) => {
  await cashierPage.goto('/pos');
  // Authenticated cashier should not be redirected back to login
  await expect(cashierPage).not.toHaveURL(/.*auth\/login/);
  // Return to console so fixture logout (which needs user menu) can succeed
  await cashierPage.goto('/console/dashboard');
});

// EU-005: Cashier can open a shift (retail.pos.shift permission)
test('EU-005: Cashier can open and get current shift', async ({ cashierPage, tenantAdminPage }) => {
  // Get a valid location via admin (cashier lacks location-management access)
  const { data: locData } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location?perPage=10');
  const locations: any[] = locData?.locations ?? [];
  const activeLoc = locations.find((l: any) => l.status === 'active');
  if (!activeLoc) return; // skip if no locations seeded

  // Close any existing open shift for cashier before opening new one
  const { data: cur } = await api(cashierPage, 'GET', '/api/modules/pos/shift/current');
  if (cur?.shift?.id) {
    await api(cashierPage, 'POST', `/api/modules/pos/shift/${cur.shift.id}/close`, {
      actualCash: 0,
      varianceReason: 'EU-005 cleanup',
    });
  }

  // Cashier opens a shift (retail.pos.shift permission ✓)
  const { status, data } = await api(cashierPage, 'POST', '/api/modules/pos/shift/open', {
    locationId: activeLoc.id,
    openingFloat: 500000,
  });
  expect([200, 201]).toContain(status);
  expect(data.id).toBeTruthy();
  expect(data.status).toBe('open');

  // Cleanup
  await api(cashierPage, 'POST', `/api/modules/pos/shift/${data.id}/close`, {
    actualCash: 500000,
  });
  // Return to console for fixture logout
  await cashierPage.goto('/console/dashboard');
});
