import { test, expect } from '../../fixtures/auth';

/**
 * SA Module Registry tests: SA-003, SA-025
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
// SA-003 Smoke — Module Registry page
// ============================================================

test('SA-003: Module Registry page loads', async ({ adminPage }) => {
  await adminPage.goto('/console/system/module-registry');
  await expect(adminPage).toHaveURL(/.*module-registry/);
  const { status, data } = await api(adminPage, 'GET', '/api/system/module-registry');
  expect(status).toBe(200);
  expect(Array.isArray(data.data)).toBe(true);
  expect(data.data.length).toBeGreaterThan(0);
});

// ============================================================
// SA-025 — Disabling module in registry hides it from auth list
// ============================================================

test('SA-025: Disabling module in registry removes it from module-authorization list', async ({ adminPage }) => {
  // Find the 'report' module in the registry
  const listRes = await api(adminPage, 'GET', '/api/system/module-registry?search=report&limit=50');
  expect(listRes.status).toBe(200);
  const reportMod = listRes.data.data.find((m: any) => m.moduleId === 'report');
  expect(reportMod).toBeTruthy();

  const modId = reportMod.id;

  try {
    // Disable the module
    const disableRes = await api(adminPage, 'PUT', `/api/system/module-registry/${modId}`, {
      isActive: false,
    });
    expect(disableRes.status).toBe(200);
    expect(disableRes.data.isActive).toBe(false);

    // Verify it no longer appears in the registered-modules authorization list
    // (that endpoint filters to isActive=true only)
    const authListRes = await api(adminPage, 'GET', '/api/system/module-authorization/registered-modules');
    expect(authListRes.status).toBe(200);
    const reportInAuth = authListRes.data.find((m: any) => m.moduleId === 'report');
    expect(reportInAuth).toBeUndefined();

  } finally {
    // Always re-enable so other tests are not affected
    await api(adminPage, 'PUT', `/api/system/module-registry/${modId}`, {
      isActive: true,
    });
  }
});
