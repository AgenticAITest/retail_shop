import { test, expect } from '../../fixtures/auth';

/**
 * SA Role tests: SA-006, SA-015
 */

async function api(page: any, method: string, url: string, body?: object) {
  return page.evaluate(async ({ m, u, b }: any) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
    const r = await fetch(u, {
      method: m,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Code': tenant.code || 'system',
        'Content-Type': 'application/json',
      },
      body: b ? JSON.stringify(b) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }, { m: method, u: url, b: body });
}

// ============================================================
// SA-006 Smoke — Role management page
// ============================================================

test('SA-006: Role management page loads', async ({ adminPage }) => {
  await adminPage.goto('/console/system/role');
  await expect(adminPage).toHaveURL(/.*role/);
  const { status, data } = await api(adminPage, 'GET', '/api/system/role');
  expect(status).toBe(200);
});

// ============================================================
// SA-015 — Create custom role
// ============================================================

test('SA-015: Create custom role SUPERVISOR', async ({ adminPage }) => {
  const ROLE_CODE = 'SA15_SUPERVISOR';

  // Clean up prior run
  const listRes = await api(adminPage, 'GET', `/api/system/role?filter=${ROLE_CODE}`);
  if (listRes.status === 200 && listRes.data?.roles?.length > 0) {
    for (const r of listRes.data.roles) {
      if (r.code === ROLE_CODE) {
        await api(adminPage, 'DELETE', `/api/system/role/${r.id}/delete`);
      }
    }
  }

  const { status, data } = await api(adminPage, 'POST', '/api/system/role/add', {
    code: ROLE_CODE,
    name: 'Store Supervisor',
    description: 'Custom supervisor role for SA-015 test',
    permissionIds: [],
  });
  expect(status).toBe(201);
  expect(data.code).toBe(ROLE_CODE);
  expect(data.name).toBe('Store Supervisor');

  // Verify it appears in the role list
  const verifyRes = await api(adminPage, 'GET', `/api/system/role?filter=${ROLE_CODE}`);
  expect(verifyRes.status).toBe(200);
  const found = verifyRes.data?.roles?.find((r: any) => r.code === ROLE_CODE);
  expect(found).toBeTruthy();

  // Cleanup
  if (data.id) {
    await api(adminPage, 'DELETE', `/api/system/role/${data.id}/delete`);
  }
});
