import { test, expect } from '../../fixtures/auth';

/**
 * SA User tests: SA-005, SA-014, SA-016, SA-017, SA-023
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

// Decode tenantId from JWT stored in localStorage
async function getSystemTenantId(page: any): Promise<string> {
  return page.evaluate(() => {
    const token = localStorage.getItem('token');
    if (!token) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.tenantId || '';
    } catch {
      return '';
    }
  });
}

// ============================================================
// SA-005 Smoke — User management page
// ============================================================

test('SA-005: User management page loads', async ({ adminPage }) => {
  await adminPage.goto('/console/system/user');
  await expect(adminPage).toHaveURL(/.*user/);
  const { status } = await api(adminPage, 'GET', '/api/system/user');
  expect(status).toBe(200);
});

// ============================================================
// C2 — User CRUD lifecycle (serial): SA-014 → SA-016 → SA-017
// ============================================================

test.describe('SA-014..016..017 — User CRUD lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let userId = '';
  let tenantId = '';
  const TEST_USERNAME = 'sa14.budi';
  const TEST_PASSWORD = 'SecurePass123!';

  test('SA-014: Create system-level user', async ({ adminPage }) => {
    tenantId = await getSystemTenantId(adminPage);
    expect(tenantId).toBeTruthy();

    // If user from prior run exists, re-activate them and reuse instead of creating duplicate
    const listRes = await api(adminPage, 'GET', `/api/system/user?filter=${TEST_USERNAME}`);
    const existing = listRes.data?.users?.find((u: any) => u.username.startsWith(TEST_USERNAME));
    if (existing) {
      await api(adminPage, 'PUT', `/api/system/user/${existing.id}/edit`, {
        id: existing.id,
        username: TEST_USERNAME,
        fullname: 'Budi Santoso',
        email: 'budi@sa14test.co.id',
        status: 'active',
        activeTenantId: tenantId,
        activeTenantCode: 'system',
        roleIds: [],
      });
      userId = existing.id;
      return;
    }

    const { status, data } = await api(adminPage, 'POST', '/api/system/user/add', {
      username: TEST_USERNAME,
      fullname: 'Budi Santoso',
      password: TEST_PASSWORD,
      activeTenantId: tenantId,
      email: 'budi@sa14test.co.id',
      roleIds: [],
    });
    expect(status).toBe(201);
    expect(data.username).toContain(TEST_USERNAME);
    userId = data.id;
  });

  test('SA-016: Reset user password', async ({ adminPage }) => {
    expect(userId).toBeTruthy();
    const { status } = await api(adminPage, 'POST', `/api/system/user/${userId}/reset-password`, {
      id: userId,
      activeTenantId: tenantId,  // Zod schema validates this field name
      tenantId,                  // route handler reads this field name for the 403 check
      password: 'NewPass456!',
      confirmPassword: 'NewPass456!',
    });
    expect(status).toBe(200);
  });

  test('SA-017: Deactivate user account', async ({ adminPage }) => {
    expect(userId).toBeTruthy();
    const { status, data } = await api(adminPage, 'PUT', `/api/system/user/${userId}/edit`, {
      id: userId,
      username: TEST_USERNAME,
      fullname: 'Budi Santoso',
      email: 'budi@sa14test.co.id',
      status: 'inactive',
      activeTenantId: tenantId,
      activeTenantCode: 'system',
      roleIds: [],
    });
    expect(status).toBe(200);
    expect(data.status).toBe('inactive');
  });
});

// ============================================================
// C3 — Edge case: duplicate username rejected (SA-023)
// ============================================================

test('SA-023: Duplicate username is rejected', async ({ adminPage }) => {
  const tenantId = await getSystemTenantId(adminPage);
  // 'sysadmin@system' already exists — submitting 'sysadmin' should fail
  const { status } = await api(adminPage, 'POST', '/api/system/user/add', {
    username: 'sysadmin',
    fullname: 'Duplicate Sysadmin',
    password: 'TestPass1!',
    activeTenantId: tenantId,
    email: 'dup@test.co.id',
    roleIds: [],
  });
  expect([400, 409, 422]).toContain(status);
});
