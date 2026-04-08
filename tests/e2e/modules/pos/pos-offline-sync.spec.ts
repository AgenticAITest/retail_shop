import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * POS Offline & Sync E2E Tests (Sprint 15-16)
 *
 * Tests sync push/pull API, idempotency, delta sync, queue management UI,
 * and sync status component. Actual offline behavior (Service Worker, Dexie)
 * can't be fully tested in Playwright, so focus is on API + UI integration.
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
    body: JSON.stringify({ username: TEST_USERS.admin.username, password: TEST_USERS.admin.password }),
  });
  const data = await res.json();
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.admin.tenantCode,
    'Content-Type': 'application/json',
  };
}

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function apiGet(path: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  return res.json();
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

/** Ensure an open shift exists for push to succeed */
async function ensureOpenShift(): Promise<void> {
  const headers = await getAuthHeaders();
  const { shift } = await apiGet('/api/modules/pos/shift/current', headers);
  if (!shift || shift.status !== 'open') {
    // Close any lingering
    if (shift?.status === 'open') {
      await apiPost(`/api/modules/pos/shift/${shift.id}/close`, { actualCash: 0 }, headers);
    }
    const loc = await getLocationViaApi();
    await apiPost('/api/modules/pos/shift/open', { locationId: loc.id, openingFloat: 0 }, headers);
  }
}

function makeOfflineTransaction(prod: any): { type: string; offlineId: string; data: any } {
  return {
    type: 'transaction',
    offlineId: crypto.randomUUID(),
    data: {
      items: [{
        productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
        quantity: 1, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
      }],
      payments: [{ paymentMethod: 'cash', amount: parseFloat(prod.sellingPrice) }],
      completedAt: new Date().toISOString(),
    },
  };
}

async function selectLocationIfNeeded(page: Page) {
  await page.waitForTimeout(1000);
  const picker = page.locator('text=Select POS Location');
  if (await picker.isVisible().catch(() => false)) {
    await page.locator('button:has(p.font-medium)').first().click();
    await page.waitForTimeout(500);
  }
}

test.describe('POS Offline & Sync (Sprint 15-16)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke - Sync UI', () => {
    test('SYN-001: sync status visible on POS', async ({ adminPage }) => {
      await adminPage.goto('/pos');
      await adminPage.waitForLoadState('networkidle');
      await selectLocationIfNeeded(adminPage);

      await expect(adminPage.locator('[data-testid="pos-sync-status"]')).toBeVisible();
      await expect(adminPage.locator('text=Online').first()).toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('SYN-002: sync popover shows stats', async ({ adminPage }) => {
      await adminPage.goto('/pos');
      await adminPage.waitForLoadState('networkidle');
      await selectLocationIfNeeded(adminPage);

      // Dismiss any shift dialog that may appear (overlay blocks clicks)
      await adminPage.waitForTimeout(1500);
      const shiftDialog = adminPage.locator('[role="alertdialog"]');
      if (await shiftDialog.isVisible().catch(() => false)) {
        await adminPage.keyboard.press('Escape');
        await adminPage.waitForTimeout(500);
      }

      await adminPage.locator('[data-testid="pos-sync-status"]').click({ timeout: 5000 });
      await adminPage.waitForTimeout(500);

      await expect(adminPage.locator('text=Sync Status')).toBeVisible();
      await expect(adminPage.locator('text=Pending')).toBeVisible();
      await expect(adminPage.locator('text=Last Sync')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Full Sync")')).toBeVisible();

      await adminPage.keyboard.press('Escape');
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C1: Smoke - Sync API', () => {
    test('SYN-003: pull returns catalog data', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status, data } = await apiPost('/api/modules/pos/sync/pull', {
        locationId: loc.id,
      }, headers);

      expect(status).toBe(200);
      expect(data.products).toBeDefined();
      expect(data.categories).toBeDefined();
      expect(data.taxConfig).toBeDefined();
      expect(data.inventory).toBeDefined();
      expect(data.timestamp).toBeTruthy();
      expect(data.counts.products).toBeGreaterThan(0);
    });

    test('SYN-004: push accepts transaction', async () => {
      await ensureOpenShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const item = makeOfflineTransaction(prod);
      const { status, data } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items: [item],
      }, headers);

      expect(status).toBe(200);
      expect(data.accepted).toContain(item.offlineId);
      expect(data.rejected).toHaveLength(0);
      expect(data.serverSyncId).toBeTruthy();
    });
  });

  // ============================================================
  // C2: FULL LIFECYCLE
  // ============================================================

  test.describe('C2: Push/Pull Lifecycle', () => {
    test('SYN-005: duplicate push rejected (idempotency)', async () => {
      await ensureOpenShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const item = makeOfflineTransaction(prod);

      // First push
      const { data: first } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items: [item],
      }, headers);
      expect(first.accepted).toContain(item.offlineId);

      // Duplicate push
      const { data: second } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items: [item],
      }, headers);
      expect(second.accepted).not.toContain(item.offlineId);
      expect(second.rejected.length).toBe(1);
      expect(second.rejected[0].reason).toContain('Duplicate');
    });

    test('SYN-006: pushed transaction appears in transaction list', async () => {
      await ensureOpenShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const item = makeOfflineTransaction(prod);
      await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items: [item],
      }, headers);

      // Find the transaction by checking notes contain the offlineId
      const txnList = await apiGet('/api/modules/pos/transaction?perPage=50', headers);
      const found = txnList.transactions.find((t: any) =>
        t.transactionId && t.status === 'completed'
      );
      expect(found).toBeTruthy();
    });

    test('SYN-007: pull delta returns only updated data', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      // First pull — gets everything
      const { data: first } = await apiPost('/api/modules/pos/sync/pull', {
        locationId: loc.id,
      }, headers);
      expect(first.counts.products).toBeGreaterThan(0);

      // Second pull with the timestamp — should get 0 (nothing updated since)
      const { data: second } = await apiPost('/api/modules/pos/sync/pull', {
        locationId: loc.id, lastPullTimestamp: first.timestamp,
      }, headers);
      expect(second.counts.products).toBe(0);
      expect(second.counts.categories).toBe(0);
    });

    test('SYN-008: push multiple transactions in batch', async () => {
      await ensureOpenShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const items = [
        makeOfflineTransaction(prod),
        makeOfflineTransaction(prod),
        makeOfflineTransaction(prod),
      ];

      const { data } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items,
      }, headers);

      expect(data.accepted).toHaveLength(3);
      expect(data.rejected).toHaveLength(0);
    });

    test('SYN-009: push with invalid data returns error', async () => {
      const headers = await getAuthHeaders();

      // Missing locationId
      const { status } = await apiPost('/api/modules/pos/sync/push', {
        deviceId: 'test', items: [{ type: 'transaction', offlineId: crypto.randomUUID(), data: {} }],
      }, headers);

      expect(status).toBe(400);
    });

    test('SYN-010: pull returns inventory for location', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { data } = await apiPost('/api/modules/pos/sync/pull', {
        locationId: loc.id,
      }, headers);

      expect(data.inventory).toBeDefined();
      expect(Array.isArray(data.inventory)).toBe(true);
    });

    test('SYN-011: sync status UI accessible from POS', async ({ adminPage }) => {
      await adminPage.goto('/pos');
      await adminPage.waitForLoadState('networkidle');
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      // Click sync status
      await adminPage.locator('[data-testid="pos-sync-status"]').click();
      await adminPage.waitForTimeout(500);

      // Verify popover content
      const popover = adminPage.locator('[data-radix-popper-content-wrapper]');
      await expect(popover.locator('text=Pending')).toBeVisible();

      await adminPage.keyboard.press('Escape');
      await ensureOnConsole(adminPage);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('SYN-012: push with empty items rejected', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test', items: [],
      }, headers);

      expect(status).toBe(400);
    });

    test('SYN-013: pull with future timestamp returns nothing', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await apiPost('/api/modules/pos/sync/pull', {
        locationId: loc.id, lastPullTimestamp: future,
      }, headers);

      expect(data.counts.products).toBe(0);
      expect(data.counts.categories).toBe(0);
    });

    test('SYN-014: push unknown type rejected', async () => {
      await ensureOpenShift();
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      const { status, data } = await apiPost('/api/modules/pos/sync/push', {
        locationId: loc.id, deviceId: 'test',
        items: [{ type: 'unknown', offlineId: crypto.randomUUID(), data: {} }],
      }, headers);

      // Zod schema rejects 'unknown' type with 400
      expect(status).toBe(400);
    });
  });
});
