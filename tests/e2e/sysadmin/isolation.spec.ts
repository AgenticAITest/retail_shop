import { test, expect } from '../../fixtures/auth';

/**
 * SA Edge Case tests: SA-024, SA-027
 */

async function api(page: any, method: string, url: string, body?: object, extraHeaders?: Record<string, string>) {
  return page.evaluate(async ({ m, u, b, h }: any) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
    const r = await fetch(u, {
      method: m,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Code': tenant.code || 'system',
        'Content-Type': 'application/json',
        ...(h || {}),
      },
      body: b ? JSON.stringify(b) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }, { m: method, u: url, b: body, h: extraHeaders || {} });
}

// ============================================================
// SA-024 — SYSADMIN bypasses all module permission checks
// ============================================================

test('SA-024: SYSADMIN can access all module APIs regardless of authorization', async ({ adminPage }) => {
  // SYSADMIN role bypasses authorized() and hasPermissions() checks.
  // Test a selection of system and module routes — all should return non-403.

  const routes = [
    { url: '/api/system/tenant', label: 'system/tenant' },
    { url: '/api/system/user', label: 'system/user' },
    { url: '/api/system/role', label: 'system/role' },
    { url: '/api/system/module-registry', label: 'system/module-registry' },
    { url: '/api/modules/location-management/location', label: 'location-management' },
    { url: '/api/modules/product-catalog/product', label: 'product-catalog' },
  ];

  for (const route of routes) {
    const { status } = await api(adminPage, 'GET', route.url);
    // 403 would indicate SYSADMIN is being blocked — that's a test failure.
    // 500 is acceptable (e.g., missing tenant table), 200/404 are fine.
    expect(status).not.toBe(403);
  }
});

// ============================================================
// SA-027 — Tenant data isolation
// ============================================================

test.describe('SA-027: Tenant data isolation', () => {
  test.describe.configure({ mode: 'serial' });

  const TA_CODE = 'sa27ta';
  const TB_CODE = 'sa27tb';
  let taId = '';
  let tbId = '';

  test('SA-027 setup: create two tenants', async ({ adminPage }) => {
    // Helper: create tenant or recover existing ID via the current-tenant endpoint.
    async function createOrRecover(code: string, name: string): Promise<string> {
      const { status, data } = await api(adminPage, 'POST', '/api/system/tenant/add', {
        code, name, description: 'isolation test',
      });
      if (status === 201) return data.id;
      // 400 = code already in sys_tenant from prior run; 500 = schema error after INSERT.
      // Recover the existing record's ID via the current-tenant endpoint.
      const cur = await api(adminPage, 'GET', '/api/system/tenant/current', undefined, { 'X-Tenant-Code': code });
      expect(cur.status).toBe(200);
      return cur.data.id;
    }

    taId = await createOrRecover(TA_CODE, 'SA27 Tenant A');
    tbId = await createOrRecover(TB_CODE, 'SA27 Tenant B');
    expect(taId).toBeTruthy();
    expect(tbId).toBeTruthy();
  });

  test('SA-027 isolation: roles created in tenant A are not visible in tenant B', async ({ adminPage }) => {
    expect(taId).toBeTruthy();
    expect(tbId).toBeTruthy();

    const EXCLUSIVE_CODE = 'SA27_EXCLUSIVE_A';

    // Create an exclusive role in Tenant A (SYSADMIN is ADMIN in ta1 after tenant creation)
    const createRes = await api(adminPage, 'POST', '/api/system/role/add', {
      code: EXCLUSIVE_CODE,
      name: 'Exclusive Role for Tenant A',
      description: 'Should NOT appear in Tenant B',
      permissionIds: [],
    }, { 'X-Tenant-Code': TA_CODE });
    // 201 = new role; 400 = already exists from prior run's stale schema — both are fine for isolation testing
    expect([201, 400]).toContain(createRes.status);

    // Verify role exists in Tenant A
    const taRoles = await api(adminPage, 'GET', `/api/system/role?filter=${EXCLUSIVE_CODE}`, undefined, { 'X-Tenant-Code': TA_CODE });
    expect(taRoles.status).toBe(200);
    expect(taRoles.data?.roles?.some((r: any) => r.code === EXCLUSIVE_CODE)).toBe(true);

    // Verify role does NOT appear in Tenant B
    const tbRoles = await api(adminPage, 'GET', `/api/system/role?filter=${EXCLUSIVE_CODE}`, undefined, { 'X-Tenant-Code': TB_CODE });
    expect(tbRoles.status).toBe(200);
    expect(tbRoles.data?.roles?.some((r: any) => r.code === EXCLUSIVE_CODE)).toBe(false);
  });

  test('SA-027 cleanup: delete test tenants', async ({ adminPage }) => {
    if (taId) await api(adminPage, 'DELETE', `/api/system/tenant/${taId}/delete`);
    if (tbId) await api(adminPage, 'DELETE', `/api/system/tenant/${tbId}/delete`);
  });
});
