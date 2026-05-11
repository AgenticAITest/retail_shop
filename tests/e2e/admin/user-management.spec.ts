import { test, expect } from '../../fixtures/auth';

/**
 * Phase 3 User management tests: TA-039, TA-040
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

async function getTenantId(page: any): Promise<string> {
  return page.evaluate(() => {
    const tenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
    return tenant.id || '';
  });
}

test.describe('TA-039..040 — User management', () => {
  test.describe.configure({ mode: 'serial' });

  let managerRoleId = '';
  let cashierRoleId = '';

  test('Setup: fetch MANAGER and CASHIER role IDs', async ({ tenantAdminPage }) => {
    // ref-roles returns ALL roles including system roles (MANAGER, CASHIER, ADMIN)
    const { status, data } = await api(tenantAdminPage, 'GET', '/api/system/user/ref-roles');
    expect(status).toBe(200);

    const roles: any[] = Array.isArray(data) ? data : data?.roles ?? [];
    const managerRole = roles.find((r: any) => r.code === 'MANAGER');
    const cashierRole = roles.find((r: any) => r.code === 'CASHIER');

    expect(managerRole).toBeTruthy();
    expect(cashierRole).toBeTruthy();

    managerRoleId = managerRole.id;
    cashierRoleId = cashierRole.id;
  });

  // ──────────────────────────────────────────────────────────
  // TA-039 — Create staff user with MANAGER role
  // ──────────────────────────────────────────────────────────

  test('TA-039: Create MANAGER user siti.rahayu', async ({ tenantAdminPage }) => {
    expect(managerRoleId).toBeTruthy();

    const tenantId = await getTenantId(tenantAdminPage);
    expect(tenantId).toBeTruthy();

    // Check if already exists
    const listRes = await api(tenantAdminPage, 'GET', '/api/system/user?filter=siti.rahayu');
    const users: any[] = listRes.data?.users ?? listRes.data ?? [];
    const existing = users.find((u: any) => u.username?.includes('siti.rahayu'));

    if (existing) {
      // User already exists — test passes idempotently
      expect(existing.id).toBeTruthy();
      return;
    }

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/system/user/add', {
      username: 'siti.rahayu',
      fullname: 'Siti Rahayu',
      email: 'siti@tmj.co.id',
      password: 'Manager123!',
      activeTenantId: tenantId,
      roleIds: [managerRoleId],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    // Username gets @tmj suffix appended by the server
    expect(data.username).toContain('siti.rahayu');

    // Verify user appears in list
    const { status: ls, data: ld } = await api(tenantAdminPage, 'GET', '/api/system/user?filter=siti.rahayu');
    expect(ls).toBe(200);
    const usersAfter: any[] = ld?.users ?? ld ?? [];
    const created = usersAfter.find((u: any) => u.username?.includes('siti.rahayu'));
    expect(created).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // TA-040 — Create cashier user
  // ──────────────────────────────────────────────────────────

  test('TA-040: Create CASHIER user dedi.kurniawan', async ({ tenantAdminPage }) => {
    expect(cashierRoleId).toBeTruthy();

    const tenantId = await getTenantId(tenantAdminPage);
    expect(tenantId).toBeTruthy();

    // Check if already exists
    const listRes = await api(tenantAdminPage, 'GET', '/api/system/user?filter=dedi.kurniawan');
    const users: any[] = listRes.data?.users ?? listRes.data ?? [];
    const existing = users.find((u: any) => u.username?.includes('dedi.kurniawan'));

    if (existing) {
      expect(existing.id).toBeTruthy();
      return;
    }

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/system/user/add', {
      username: 'dedi.kurniawan',
      fullname: 'Dedi Kurniawan',
      email: 'dedi@tmj.co.id',
      password: 'Cashier123!',
      activeTenantId: tenantId,
      roleIds: [cashierRoleId],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.username).toContain('dedi.kurniawan');

    // Verify user appears in list
    const { status: ls, data: ld } = await api(tenantAdminPage, 'GET', '/api/system/user?filter=dedi.kurniawan');
    expect(ls).toBe(200);
    const usersAfter: any[] = ld?.users ?? ld ?? [];
    const created = usersAfter.find((u: any) => u.username?.includes('dedi.kurniawan'));
    expect(created).toBeTruthy();
  });
});
