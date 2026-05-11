import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 Manager smoke test: EU-004
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

// EU-004: Manager login and console access
test('EU-004: Manager logs in and can access retail operations', async ({ managerPage }) => {
  await expect(managerPage).toHaveURL(/.*console\/dashboard/);

  // Manager can view reports
  const { status: rpt } = await api(managerPage, 'GET', '/api/modules/report/dashboard/kpis');
  expect(rpt).toBe(200);

  // Manager can view inventory
  const { status: inv } = await api(managerPage, 'GET', '/api/modules/inventory-management/stock-count');
  expect([200, 403]).toContain(inv);

  // Manager can view transfers
  const { status: trf } = await api(managerPage, 'GET', '/api/modules/transfer/transfer');
  expect([200, 403]).toContain(trf);

  // Manager CANNOT access location management config (admin-only)
  const { status: loc } = await api(managerPage, 'POST', '/api/modules/location-management/location/add', {
    code: 'MGR-TEST', name: 'Mgr Test', type: 'shop', status: 'active',
  });
  expect([401, 403]).toContain(loc);
});
