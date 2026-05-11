import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 Shift management tests: EU-019 to EU-021
 * Shift open/close/cash-drop uses cashierPage (retail.pos.shift permission ✓)
 * locationId fetched via tenantAdminPage (cashier lacks location-management permission)
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

test.describe('EU-019..021 — Shift management', () => {
  test.describe.configure({ mode: 'serial' });

  let locationId = '';
  let shiftId = '';

  test('Setup: get location and open shift as cashier', async ({ tenantAdminPage, cashierPage }) => {
    const { data: locData } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location?perPage=10');
    const activeLoc = (locData?.locations ?? []).find((l: any) => l.status === 'active');
    expect(activeLoc).toBeTruthy();
    locationId = activeLoc.id;

    // Close any existing open shift for cashier
    const { data: cur } = await api(cashierPage, 'GET', '/api/modules/pos/shift/current');
    if (cur?.shift?.id) {
      await api(cashierPage, 'POST', `/api/modules/pos/shift/${cur.shift.id}/close`, {
        actualCash: 0, varianceReason: 'shift.spec setup cleanup',
      });
    }

    const { status, data } = await api(cashierPage, 'POST', '/api/modules/pos/shift/open', {
      locationId,
      openingFloat: 500000,
    });
    expect([200, 201]).toContain(status);
    shiftId = data.id;
    expect(shiftId).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-019 — Cash drop during open shift
  // ──────────────────────────────────────────────────────────

  test('EU-019: Cash drop during open shift', async ({ cashierPage }) => {
    expect(shiftId).toBeTruthy();

    const { status, data } = await api(cashierPage, 'POST', `/api/modules/pos/shift/${shiftId}/cash-drop`, {
      amount: 200000,
      reason: 'Pengeluaran ke brankas — EU-019',
    });
    expect([200, 201]).toContain(status);
    expect(data.id).toBeTruthy();
    expect(Number(data.amount)).toBe(200000); // Postgres returns numeric as string
  });

  // ──────────────────────────────────────────────────────────
  // EU-020 — Close shift with balanced count
  // ──────────────────────────────────────────────────────────

  test('EU-020: Close shift with balanced cash count (variance=0)', async ({ cashierPage }) => {
    expect(shiftId).toBeTruthy();

    // Get shift detail to know expected cash
    const { data: sd } = await api(cashierPage, 'GET', `/api/modules/pos/shift/${shiftId}`);
    const expectedCash = sd?.shift?.expectedCash ?? sd?.expectedCash ?? 300000; // openingFloat - drop

    const { status, data } = await api(cashierPage, 'POST', `/api/modules/pos/shift/${shiftId}/close`, {
      actualCash: expectedCash,
      notes: 'EU-020 balanced count',
    });
    expect([200, 201]).toContain(status);
    expect(data.status).toBe('closed');
    const variance = data.cashVariance ?? data.variance ?? 0;
    expect(Number(variance)).toBe(0);
  });

  // ──────────────────────────────────────────────────────────
  // EU-021 — Close shift with variance and reason
  // ──────────────────────────────────────────────────────────

  test('EU-021: Close new shift with variance and reason recorded', async ({ cashierPage, tenantAdminPage }) => {
    expect(locationId).toBeTruthy();

    // Close any existing open shift
    const { data: cur } = await api(cashierPage, 'GET', '/api/modules/pos/shift/current');
    if (cur?.shift?.id) {
      await api(cashierPage, 'POST', `/api/modules/pos/shift/${cur.shift.id}/close`, {
        actualCash: 0, varianceReason: 'EU-021 cleanup pre-open',
      });
    }

    // Open a fresh shift with known float
    const { data: od } = await api(cashierPage, 'POST', '/api/modules/pos/shift/open', {
      locationId,
      openingFloat: 500000,
    });
    const freshShiftId = od.id;
    expect(freshShiftId).toBeTruthy();

    // Close with short cash (simulate -5000 variance)
    const { status, data } = await api(cashierPage, 'POST', `/api/modules/pos/shift/${freshShiftId}/close`, {
      actualCash: 495000, // 5000 short of 500000 float
      varianceReason: 'Rp 5000 shortage — possible counting error',
      notes: 'EU-021 variance test',
    });
    expect([200, 201]).toContain(status);
    expect(data.status).toBe('closed');
    const variance = data.cashVariance ?? data.variance;
    // Variance should be -5000 (short) or 5000 (absolute) depending on implementation
    expect(Math.abs(variance ?? 0)).toBe(5000);
  });
});
