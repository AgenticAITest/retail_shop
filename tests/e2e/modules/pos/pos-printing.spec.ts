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
    await page.waitForTimeout(1000);
  }
  // Handle shift open dialog
  const shiftDialog = page.locator('[role="alertdialog"]:has-text("Open Shift")');
  if (await shiftDialog.isVisible().catch(() => false)) {
    await page.locator('[role="alertdialog"] button:has-text("Open Shift")').click();
    await page.waitForTimeout(1500);
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
    test('PRT-001: printer status visible on POS screen', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);

      // Printer status should be in top bar (shows "disconnected")
      await expect(tenantAdminPage.locator('text=disconnected').first()).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });

    test('PRT-002: printer settings popover opens', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);

      // Click the printer status area to open popover
      await tenantAdminPage.locator('text=disconnected').first().click();
      await tenantAdminPage.waitForTimeout(500);

      // Popover should show Paper Width and Connection selectors
      await expect(tenantAdminPage.locator('text=Paper Width')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Connection')).toBeVisible();
      // Connect button inside popover (use exact match)
      await expect(tenantAdminPage.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();

      // Close popover by pressing Escape
      await tenantAdminPage.keyboard.press('Escape');
      await tenantAdminPage.waitForTimeout(300);

      await ensureOnConsole(tenantAdminPage);
    });

    test('PRT-003: TransactionView has Reprint and PDF buttons', async ({ tenantAdminPage }) => {
      const { id } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('button:has-text("Reprint Receipt")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();
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
    test('PRT-006: Reprint button triggers action on TransactionView', async ({ tenantAdminPage }) => {
      const { id } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click Reprint Receipt
      await tenantAdminPage.locator('button:has-text("Reprint Receipt")').click();
      await tenantAdminPage.waitForTimeout(2000);

      // Should show toast (reprint logged or PDF fallback) — no crash
      // Just verify no error alert appeared
      await expect(tenantAdminPage.locator('text=Failed to reprint receipt')).not.toBeVisible();
    });

    test('PRT-007: Download PDF button works on TransactionView', async ({ tenantAdminPage }) => {
      const { id } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.locator('button:has-text("Download PDF")').click();
      await tenantAdminPage.waitForTimeout(2000);

      await expect(tenantAdminPage.locator('text=Failed to generate PDF')).not.toBeVisible();
    });

    test('PRT-008: checkout success shows Print and PDF buttons', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Open checkout
      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      // Pay full via card
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Complete
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      // Success screen should have Print and PDF buttons
      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("Print")')).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("PDF")')).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });

    test('PRT-009: PDF download from checkout success', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      // Click PDF button
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("PDF")').click();
      await tenantAdminPage.waitForTimeout(2000);

      // No error
      await expect(tenantAdminPage.locator('text=Failed to generate receipt')).not.toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
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
