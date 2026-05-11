import { test, expect } from '../../fixtures/auth';

/**
 * SA Module Authorization tests: SA-004, SA-010, SA-019, SA-028
 *
 * Uses a dedicated test tenant ('samod') created via the API so that sysadmin@system
 * is automatically seeded into it with ADMIN role — enabling cross-tenant API calls.
 * (The 'tmj' seeded tenant does NOT have sysadmin in its user table, so X-Tenant-Code: tmj
 * returns 401 for authenticated routes when called by sysadmin@system.)
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

const TEST_MODULE_ID = 'demo-module';
const TEST_MODULE_NAME = 'Demo Module';

// ============================================================
// SA-004 Smoke — Module Authorization page loads
// ============================================================

test('SA-004: Module Authorization page loads', async ({ adminPage }) => {
  await adminPage.goto('/console/system/module-authorization');
  await expect(adminPage).toHaveURL(/.*module-authorization/);
  const { status } = await api(adminPage, 'GET', '/api/system/module-authorization/registered-modules');
  expect(status).toBe(200);
});

// ============================================================
// C2 — Module auth lifecycle (serial): SA-010 → SA-019 → SA-028
// Uses a dedicated tenant created via the API so sysadmin is in its user table.
// ============================================================

test.describe('SA-010..019..028 — Module auth lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  const SAMOD_CODE = 'samod';
  let samodTenantId = '';

  test('SA-010 setup: create dedicated module-auth test tenant', async ({ adminPage }) => {
    // Creating via API seeds sysadmin@system into the new tenant with ADMIN role,
    // which allows authenticated cross-tenant calls with X-Tenant-Code: samod.
    const { status, data } = await api(adminPage, 'POST', '/api/system/tenant/add', {
      code: SAMOD_CODE,
      name: 'SA Module Auth Test',
      description: 'E2E test tenant for module authorization tests',
    });

    if (status === 201) {
      samodTenantId = data.id;
      await api(adminPage, 'PUT', `/api/system/tenant/${samodTenantId}/edit`, {
        id: samodTenantId,
        code: SAMOD_CODE,
        name: 'SA Module Auth Test',
        description: 'E2E test tenant for module authorization tests',
        status: 'active',
      });
    } else {
      // 400 = code in sys_tenant from prior run; 500 = schema creation failed after INSERT.
      // Either way the record is in sys_tenant — recover the ID via the current-tenant endpoint.
      const cur = await api(adminPage, 'GET', '/api/system/tenant/current', undefined, { 'X-Tenant-Code': SAMOD_CODE });
      expect(cur.status).toBe(200);
      samodTenantId = cur.data.id;
    }

    expect(samodTenantId).toBeTruthy();
  });

  test('SA-010: Authorize demo-module for samod tenant', async ({ adminPage }) => {
    const SAMOD_HEADERS = { 'X-Tenant-Code': SAMOD_CODE };

    const { status, data } = await api(adminPage, 'POST', '/api/system/module-authorization', {
      moduleId: TEST_MODULE_ID,
      moduleName: TEST_MODULE_NAME,
      isEnabled: true,
      createTables: false,
    }, SAMOD_HEADERS);
    // 201 = new record; 200 = updated existing; both confirm auth was applied
    expect([200, 201]).toContain(status);
    expect(data.isEnabled).toBe(true);

    // Verify it appears in the registered-modules list with isAuthorized=true
    const listRes = await api(adminPage, 'GET', '/api/system/module-authorization/registered-modules', undefined, SAMOD_HEADERS);
    expect(listRes.status).toBe(200);
    const mod = listRes.data.find((m: any) => m.moduleId === TEST_MODULE_ID);
    expect(mod?.isAuthorized).toBe(true);
  });

  test('SA-019: Revoke demo-module from samod tenant', async ({ adminPage }) => {
    const SAMOD_HEADERS = { 'X-Tenant-Code': SAMOD_CODE };

    const { status, data } = await api(adminPage, 'POST', '/api/system/module-authorization', {
      moduleId: TEST_MODULE_ID,
      moduleName: TEST_MODULE_NAME,
      isEnabled: false,
      deleteTables: false,
    }, SAMOD_HEADERS);
    expect([200, 201]).toContain(status);
    expect(data.isEnabled).toBe(false);

    // Verify the module is no longer authorized
    const listRes = await api(adminPage, 'GET', '/api/system/module-authorization/registered-modules', undefined, SAMOD_HEADERS);
    expect(listRes.status).toBe(200);
    const mod = listRes.data.find((m: any) => m.moduleId === TEST_MODULE_ID);
    expect(mod?.isAuthorized).toBe(false);
  });

  test('SA-028: Re-authorizing demo-module restores access for samod', async ({ adminPage }) => {
    const SAMOD_HEADERS = { 'X-Tenant-Code': SAMOD_CODE };

    // Re-authorize
    const { status, data } = await api(adminPage, 'POST', '/api/system/module-authorization', {
      moduleId: TEST_MODULE_ID,
      moduleName: TEST_MODULE_NAME,
      isEnabled: true,
      createTables: false,
    }, SAMOD_HEADERS);
    expect([200, 201]).toContain(status);
    expect(data.isEnabled).toBe(true);

    // Verify restored
    const listRes = await api(adminPage, 'GET', '/api/system/module-authorization/registered-modules', undefined, SAMOD_HEADERS);
    expect(listRes.status).toBe(200);
    const mod = listRes.data.find((m: any) => m.moduleId === TEST_MODULE_ID);
    expect(mod?.isAuthorized).toBe(true);
  });

  test('SA-010 teardown: delete samod test tenant', async ({ adminPage }) => {
    if (samodTenantId) {
      await api(adminPage, 'DELETE', `/api/system/tenant/${samodTenantId}/delete`).catch(() => {});
    }
  });
});
