import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * POS Printing & Receipt E2E Tests (Sprint 13)
 *
 * Tests reprint API, audit logging, UI buttons, and PDF fallback.
 * Thermal printing hardware cannot be tested in E2E — those paths
 * gracefully fall back to PDF download.
 */

// ============================================================
// HELPERS
// ============================================================

async function navigateToPosScreen(page: Page) {
  await page.goto('/pos');
  await page.waitForURL('**/pos**');
  await page.waitForLoadState('networkidle');
}

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

async function apiGet(path: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  return res.json();
}

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data };
}

async function getLocationViaApi(): Promise<{ id: string; code: string }> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/location-management/location?perPage=1', headers);
  const loc = (data.locations || []).find((l: any) => l.status === 'active');
  if (!loc) throw new Error('No active location');
  return { id: loc.id, code: loc.code };
}

async function getProductViaApi(): Promise<any> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/pos/transaction/products?perPage=1', headers);
  return data.products?.[0];
}

async function createTransactionViaApi(): Promise<{ id: string; transactionId: string }> {
  const headers = await getAuthHeaders();
  const loc = await getLocationViaApi();
  const prod = await getProductViaApi();

  const { data } = await apiPost('/api/modules/pos/transaction/checkout', {
    locationId: loc.id,
    items: [{
      productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
      quantity: 1, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
    }],
    payments: [{ paymentMethod: 'cash', amount: parseFloat(prod.sellingPrice), amountTendered: parseFloat(prod.sellingPrice) }],
  }, headers);

  return { id: data.id, transactionId: data.transactionId };
}

async function selectLocationIfNeeded(page: Page) {
  await page.waitForTimeout(1000);
  const picker = page.locator('text=Select POS Location');
  if (await picker.isVisible().catch(() => false)) {
    await page.locator('button:has(p.font-medium)').first().click();
    await page.waitForTimeout(500);
  }
}

async function addFirstProductToCart(page: Page) {
  await page.waitForTimeout(1500);
  await page.locator('[data-testid^="product-tile-"]').first().click();
}

test.describe('POS Printing & Receipt (Sprint 13)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke', () => {
    test('PRT-001: printer status visible on POS screen', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);

      // Printer status should be in top bar (shows "disconnected")
      await expect(adminPage.locator('text=disconnected').first()).toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('PRT-002: printer settings popover opens', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);

      // Click the printer status area to open popover
      await adminPage.locator('text=disconnected').first().click();
      await adminPage.waitForTimeout(500);

      // Popover should show Paper Width and Connection selectors
      await expect(adminPage.locator('text=Paper Width')).toBeVisible();
      await expect(adminPage.locator('text=Connection')).toBeVisible();
      // Connect button inside popover (use exact match)
      await expect(adminPage.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();

      // Close popover by pressing Escape
      await adminPage.keyboard.press('Escape');
      await adminPage.waitForTimeout(300);

      await ensureOnConsole(adminPage);
    });

    test('PRT-003: TransactionView has Reprint and PDF buttons', async ({ adminPage }) => {
      const { id } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('button:has-text("Reprint Receipt")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Download PDF")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE
  // ============================================================

  test.describe('C2: Reprint API', () => {
    test('PRT-004: reprint returns full transaction data', async () => {
      const headers = await getAuthHeaders();
      const { id, transactionId } = await createTransactionViaApi();

      const { status, data } = await apiPost(`/api/modules/pos/transaction/${id}/reprint`, {}, headers);

      expect(status).toBe(200);
      expect(data.reprinted).toBe(true);
      expect(data.transactionId).toBe(transactionId);
      expect(data.items).toBeDefined();
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.payments).toBeDefined();
      expect(data.location).toBeDefined();
      expect(data.cashier).toBeDefined();
    });

    test('PRT-005: reprint creates audit log entry', async () => {
      const headers = await getAuthHeaders();
      const { id } = await createTransactionViaApi();

      // Reprint
      await apiPost(`/api/modules/pos/transaction/${id}/reprint`, {}, headers);

      // Check audit log
      const auditData = await apiGet('/api/modules/approval-engine/audit-log?perPage=5&sort=createdAt&order=desc', headers);
      const logs = auditData.auditLogs || auditData.data || [];

      const reprintLog = logs.find((l: any) =>
        l.action === 'reprint' && l.module === 'pos' && l.entityId === id
      );
      expect(reprintLog).toBeTruthy();
      expect(reprintLog.entityType).toBe('pos_transaction');
    });
  });

  test.describe('C2: UI Buttons', () => {
    test('PRT-006: Reprint button triggers action on TransactionView', async ({ adminPage }) => {
      const { id } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      // Click Reprint Receipt
      await adminPage.locator('button:has-text("Reprint Receipt")').click();
      await adminPage.waitForTimeout(2000);

      // Should show toast (reprint logged or PDF fallback) — no crash
      // Just verify no error alert appeared
      await expect(adminPage.locator('text=Failed to reprint receipt')).not.toBeVisible();
    });

    test('PRT-007: Download PDF button works on TransactionView', async ({ adminPage }) => {
      const { id } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.locator('button:has-text("Download PDF")').click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage.locator('text=Failed to generate PDF')).not.toBeVisible();
    });

    test('PRT-008: checkout success shows Print and PDF buttons', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Open checkout
      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      // Pay full via card
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      // Complete
      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      // Success screen should have Print and PDF buttons
      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("Print")')).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("PDF")')).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });

    test('PRT-009: PDF download from checkout success', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      // Click PDF button
      await adminPage.locator('[role="alertdialog"] button:has-text("PDF")').click();
      await adminPage.waitForTimeout(2000);

      // No error
      await expect(adminPage.locator('text=Failed to generate receipt')).not.toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('PRT-010: reprint non-existent transaction returns 404', async () => {
      const headers = await getAuthHeaders();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const { status, data } = await apiPost(`/api/modules/pos/transaction/${fakeId}/reprint`, {}, headers);

      expect(status).toBe(404);
      expect(data.error).toContain('not found');
    });

    test('PRT-011: multiple reprints create multiple audit entries', async () => {
      const headers = await getAuthHeaders();
      const { id } = await createTransactionViaApi();

      // Reprint twice
      await apiPost(`/api/modules/pos/transaction/${id}/reprint`, {}, headers);
      await apiPost(`/api/modules/pos/transaction/${id}/reprint`, {}, headers);

      // Check audit logs
      const auditData = await apiGet('/api/modules/approval-engine/audit-log?perPage=20&sort=createdAt&order=desc', headers);
      const logs = auditData.auditLogs || auditData.data || [];

      const reprintLogs = logs.filter((l: any) =>
        l.action === 'reprint' && l.module === 'pos' && l.entityId === id
      );
      expect(reprintLogs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
