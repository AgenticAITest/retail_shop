import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * POS Shift Management, Hold/Recall E2E Tests (Sprint 14)
 *
 * Tests shift open/close/cash-drop, hold/recall transactions,
 * shift admin pages, and checkout-shift integration.
 */

// ============================================================
// HELPERS
// ============================================================

async function ensureOnConsole(page: Page) {
  if (page.url().includes('/pos') && !page.url().includes('/console')) {
    await page.goto('/console/dashboard');
    await page.waitForURL('**/console/dashboard**', { timeout: 5000 }).catch(() => {});
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERS.tenantAdmin.username, password: TEST_USERS.tenantAdmin.password }),
  });
  const data = await res.json();
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.tenantAdmin.tenantCode,
    'Content-Type': 'application/json',
  };
}

async function apiGet(path: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  return res.json();
}

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function apiDelete(path: string, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'DELETE', headers });
  return { status: res.status, data: await res.json() };
}

async function getLocationViaApi(): Promise<{ id: string; code: string }> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/location-management/location?perPage=1', headers);
  return { id: data.locations[0].id, code: data.locations[0].code };
}

async function getProductViaApi(): Promise<any> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/pos/transaction/products?perPage=1', headers);
  return data.products?.[0];
}

/** Close any open shifts for the current user */
async function closeAllOpenShifts(): Promise<void> {
  const headers = await getAuthHeaders();
  const { shift } = await apiGet('/api/modules/pos/shift/current', headers);
  if (shift && shift.status === 'open') {
    await apiPost(`/api/modules/pos/shift/${shift.id}/close`, { actualCash: 0 }, headers);
  }
}

/** Open a fresh shift, return shift ID */
async function openFreshShift(): Promise<string> {
  await closeAllOpenShifts();
  const headers = await getAuthHeaders();
  const loc = await getLocationViaApi();
  const { data } = await apiPost('/api/modules/pos/shift/open', { locationId: loc.id, openingFloat: 100000 }, headers);
  return data.id;
}

test.describe('POS Shift & Hold/Recall (Sprint 14)', () => {

  // ============================================================
  // C1: SMOKE - API
  // ============================================================

  test.describe('C1: Smoke - Shift API', () => {
    test('SHF-001: open shift', async () => {
      await closeAllOpenShifts();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status, data } = await apiPost('/api/modules/pos/shift/open', {
        locationId: loc.id, openingFloat: 50000,
      }, headers);

      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('open');
      expect(data.openingFloat).toBe('50000.00');

      // Cleanup
      await apiPost(`/api/modules/pos/shift/${data.id}/close`, { actualCash: 50000 }, headers);
    });

    test('SHF-002: get current shift with summary', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();

      const result = await apiGet('/api/modules/pos/shift/current', headers);

      expect(result.shift).toBeTruthy();
      expect(result.shift.id).toBe(shiftId);
      expect(result.shift.status).toBe('open');
      expect(result.summary).toBeTruthy();
      expect(result.summary.expectedCash).toBeDefined();

      await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 100000 }, headers);
    });

    test('SHF-003: close shift', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();

      const { status, data } = await apiPost(`/api/modules/pos/shift/${shiftId}/close`, {
        actualCash: 95000, varianceReason: 'Test variance',
      }, headers);

      expect(status).toBe(200);
      expect(data.status).toBe('closed');
      expect(data.expectedCash).toBeTruthy();
      expect(data.actualCash).toBe('95000.00');
      expect(data.variance).toBeTruthy();
    });
  });

  test.describe('C1: Smoke - Shift Admin Page', () => {
    test('SHF-004: shift history page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/pos/shift');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Shift History');
      await expect(tenantAdminPage.locator('th:has-text("Cashier")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Location")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Variance")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE
  // ============================================================

  test.describe('C2: Shift + Checkout Integration', () => {
    test('SHF-005: checkout blocked without open shift', async () => {
      await closeAllOpenShifts();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const { status, data } = await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{
          productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
          quantity: 1, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
        }],
        payments: [{ paymentMethod: 'cash', amount: parseFloat(prod.sellingPrice), amountTendered: 50000 }],
      }, headers);

      expect(status).toBe(400);
      expect(data.error).toContain('No open shift');
    });

    test('SHF-006: checkout stores shiftId', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const { data } = await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{
          productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
          quantity: 1, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
        }],
        payments: [{ paymentMethod: 'cash', amount: parseFloat(prod.sellingPrice), amountTendered: 50000 }],
      }, headers);

      expect(data.shiftId).toBe(shiftId);

      await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 0 }, headers);
    });

    test('SHF-007: cash drop recorded', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();

      const { status, data } = await apiPost(`/api/modules/pos/shift/${shiftId}/cash-drop`, {
        amount: 25000, reason: 'Mid-shift pickup',
      }, headers);

      expect(status).toBe(201);
      expect(data.amount).toBe('25000.00');
      expect(data.reason).toBe('Mid-shift pickup');

      // Verify in current shift summary
      const current = await apiGet('/api/modules/pos/shift/current', headers);
      expect(current.summary.totalCashDrops).toBe(25000);

      await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 0 }, headers);
    });

    test('SHF-008: close shift with variance', async () => {
      const shiftId = await openFreshShift(); // 100K opening
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();
      const price = parseFloat(prod.sellingPrice);

      // Make a cash sale
      await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{ productId: prod.id, skuCode: prod.skuCode, productName: prod.name, quantity: 1, unitPrice: price, taxApplicable: prod.taxApplicable }],
        payments: [{ paymentMethod: 'cash', amount: price, amountTendered: price }],
      }, headers);

      // Close with different actual
      const { data } = await apiPost(`/api/modules/pos/shift/${shiftId}/close`, {
        actualCash: 130000, varianceReason: 'Test variance calc',
      }, headers);

      // Expected = 100000 (float) + price (cash sale)
      const expected = 100000 + price;
      expect(parseFloat(data.expectedCash)).toBe(expected);
      expect(parseFloat(data.actualCash)).toBe(130000);
      expect(parseFloat(data.variance)).toBeCloseTo(130000 - expected, 1);
    });
  });

  test.describe('C2: Hold/Recall API', () => {
    test('SHF-009: hold transaction', async () => {
      await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status, data } = await apiPost('/api/modules/pos/transaction/hold', {
        locationId: loc.id,
        cartData: { items: [{ name: 'Widget', qty: 3, price: 15000 }] },
        totalAmount: 45000,
        customerNote: 'Customer Jane',
      }, headers);

      expect(status).toBe(201);
      expect(data.totalAmount).toBe('45000.00');
      expect(data.customerNote).toBe('Customer Jane');
      expect(data.cartData.items).toHaveLength(1);

      await closeAllOpenShifts();
    });

    test('SHF-010: list held transactions', async () => {
      await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      // Hold 2
      await apiPost('/api/modules/pos/transaction/hold', {
        locationId: loc.id, cartData: { items: [{ name: 'A' }] }, totalAmount: 10000,
      }, headers);
      await apiPost('/api/modules/pos/transaction/hold', {
        locationId: loc.id, cartData: { items: [{ name: 'B' }] }, totalAmount: 20000,
      }, headers);

      const result = await apiGet('/api/modules/pos/transaction/held', headers);
      expect(result.held.length).toBeGreaterThanOrEqual(2);

      await closeAllOpenShifts();
    });

    test('SHF-011: recall held transaction', async () => {
      await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { data: held } = await apiPost('/api/modules/pos/transaction/hold', {
        locationId: loc.id, cartData: { items: [{ name: 'Recall Test', qty: 1 }] }, totalAmount: 25000,
      }, headers);

      const { data: recalled } = await apiPost(`/api/modules/pos/transaction/held/${held.id}/recall`, {}, headers);

      expect(recalled.cartData.items[0].name).toBe('Recall Test');
      expect(recalled.totalAmount).toBe('25000.00');

      // Verify it's deleted
      const list = await apiGet('/api/modules/pos/transaction/held', headers);
      const found = list.held.find((h: any) => h.id === held.id);
      expect(found).toBeUndefined();

      await closeAllOpenShifts();
    });

    test('SHF-012: delete held transaction', async () => {
      await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { data: held } = await apiPost('/api/modules/pos/transaction/hold', {
        locationId: loc.id, cartData: { items: [] }, totalAmount: 0,
      }, headers);

      const { data } = await apiDelete(`/api/modules/pos/transaction/held/${held.id}`, headers);
      expect(data.message).toContain('released');

      await closeAllOpenShifts();
    });

    test('SHF-013: shift detail shows summary', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      // Make a sale
      await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{ productId: prod.id, skuCode: prod.skuCode, productName: prod.name, quantity: 2, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable }],
        payments: [{ paymentMethod: 'cash', amount: parseFloat(prod.sellingPrice) * 2, amountTendered: 100000 }],
      }, headers);

      const detail = await apiGet(`/api/modules/pos/shift/${shiftId}`, headers);
      expect(detail.summary.totalSales).toBeGreaterThanOrEqual(1);

      await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 0 }, headers);
    });
  });

  test.describe('C2: Shift Admin UI', () => {
    test('SHF-014: shift list shows shifts', async ({ tenantAdminPage }) => {
      // Ensure there's at least one shift
      await openFreshShift();
      await closeAllOpenShifts();

      await tenantAdminPage.goto('/console/modules/pos/shift');
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(2000);

      // Should have at least one row
      const rows = tenantAdminPage.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('SHF-015: cannot open duplicate shift', async () => {
      await openFreshShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status, data } = await apiPost('/api/modules/pos/shift/open', {
        locationId: loc.id, openingFloat: 0,
      }, headers);

      expect(status).toBe(400);
      expect(data.error).toContain('already have an open shift');

      await closeAllOpenShifts();
    });

    test('SHF-016: cannot close already closed shift', async () => {
      const shiftId = await openFreshShift();
      const headers = await getAuthHeaders();

      // Close once
      await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 0 }, headers);

      // Try closing again
      const { status, data } = await apiPost(`/api/modules/pos/shift/${shiftId}/close`, { actualCash: 0 }, headers);
      expect(status).toBe(400);
      expect(data.error).toContain('already closed');
    });

    test('SHF-017: hold button visible on POS', async ({ tenantAdminPage }) => {
      await openFreshShift();

      await tenantAdminPage.goto('/pos');
      await tenantAdminPage.waitForLoadState('networkidle');
      // Select location if needed
      await tenantAdminPage.waitForTimeout(1000);
      const picker = tenantAdminPage.locator('text=Select POS Location');
      if (await picker.isVisible().catch(() => false)) {
        await tenantAdminPage.locator('button:has(p.font-medium)').first().click();
        await tenantAdminPage.waitForTimeout(500);
      }
      await tenantAdminPage.waitForTimeout(1000);

      // Hold button should be visible in cart area
      await expect(tenantAdminPage.locator('[data-testid="pos-hold-button"]')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
      await closeAllOpenShifts();
    });

    test('SHF-018: held badge visible on POS', async ({ tenantAdminPage }) => {
      await openFreshShift();

      await tenantAdminPage.goto('/pos');
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);
      const picker = tenantAdminPage.locator('text=Select POS Location');
      if (await picker.isVisible().catch(() => false)) {
        await tenantAdminPage.locator('button:has(p.font-medium)').first().click();
        await tenantAdminPage.waitForTimeout(500);
      }

      // Held badge
      await expect(tenantAdminPage.locator('[data-testid="pos-held-badge"]')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
      await closeAllOpenShifts();
    });

    test('SHF-019: shift view page loads', async ({ tenantAdminPage }) => {
      const shiftId = await openFreshShift();
      await closeAllOpenShifts();

      await tenantAdminPage.goto(`/console/modules/pos/shift/${shiftId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Shift Detail');
      await expect(tenantAdminPage.locator('text=Cash Summary')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Opening Float')).toBeVisible();
    });
  });
});
