import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * POS Checkout & Split Payment E2E Tests (Sprint 12)
 *
 * Tests split payments, receipt download, payment breakdown in transaction detail.
 * POS screen tests use ensureOnConsole() before returning to avoid logout fixture issues.
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

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
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

async function createSplitPaymentTxnViaApi(): Promise<{ id: string; transactionId: string; totalAmount: string }> {
  const headers = await getAuthHeaders();
  const loc = await getLocationViaApi();
  const prod = await getProductViaApi();
  const price = parseFloat(prod.sellingPrice);
  const total = price * 2; // qty=2

  const result = await apiPost('/api/modules/pos/transaction/checkout', {
    locationId: loc.id,
    items: [{
      productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
      quantity: 2, unitPrice: price, taxApplicable: prod.taxApplicable,
    }],
    payments: [
      { paymentMethod: 'cash', amount: Math.floor(total / 2), amountTendered: Math.floor(total / 2) },
      { paymentMethod: 'qris', amount: total - Math.floor(total / 2), paymentRef: 'QRIS-TEST-001' },
    ],
  }, headers);

  return { id: result.id, transactionId: result.transactionId, totalAmount: result.totalAmount };
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
  const tile = page.locator('[data-testid^="product-tile-"]').first();
  await tile.click();
}

async function openCheckout(page: Page) {
  await page.locator('[data-testid="pos-pay-button"]').click();
  await page.waitForTimeout(500);
}

test.describe('POS Checkout & Split Payments (Sprint 12)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke', () => {
    test('CHK-001: checkout dialog opens with split payment UI', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await openCheckout(adminPage);

      // Dialog visible
      await expect(adminPage.locator('[role="alertdialog"]')).toBeVisible();

      // Add Payment section
      await expect(adminPage.locator('text=Add Payment')).toBeVisible();

      // Payment method buttons (use first() since they also appear in "Pay full" row)
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("Cash")').first()).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("Card")').first()).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("QRIS")').first()).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"] button:has-text("Transfer")').first()).toBeVisible();

      // Remaining balance shown
      await expect(adminPage.locator('text=Remaining')).toBeVisible();

      // Complete Sale disabled (no payments added yet)
      const completeBtn = adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")');
      await expect(completeBtn).toBeDisabled();

      // Cancel
      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await adminPage.waitForTimeout(300);
      await ensureOnConsole(adminPage);
    });

    test('CHK-002: quick amount buttons visible', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Quick amount buttons should be visible (contain "Rp")
      const quickBtns = adminPage.locator('[role="alertdialog"] button:has-text("Rp")');
      const count = await quickBtns.count();
      expect(count).toBeGreaterThan(0);

      // Cancel
      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(adminPage);
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE
  // ============================================================

  test.describe('C2: Single Payment', () => {
    test('CHK-003: single cash payment completes sale', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Click a quick amount to fill (first one = exact amount)
      const quickBtn = adminPage.locator('[role="alertdialog"] button:has-text("Rp")').first();
      await quickBtn.click();
      await adminPage.waitForTimeout(200);

      // Cash tendered should auto-fill too — click Add
      await adminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await adminPage.waitForTimeout(500);

      // Should show Fully Paid
      await expect(adminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete Sale enabled
      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      // Success
      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(adminPage.locator('[data-testid="pos-new-sale"]')).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });

    test('CHK-004: single card payment via Pay full shortcut', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Click "Card" in the Pay full row
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      // Should be Fully Paid
      await expect(adminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete
      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Split Payment', () => {
    test('CHK-005: split payment Cash + QRIS', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Add partial cash payment
      const amountInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('20000');
      const tenderedInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('20000');

      await adminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await adminPage.waitForTimeout(500);

      // Should show Remaining (not Fully Paid)
      await expect(adminPage.locator('text=Remaining')).toBeVisible();

      // Payment line should show in list
      await expect(adminPage.locator('text=Payments Added')).toBeVisible();

      // Add QRIS for remaining via Pay full shortcut
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("QRIS")').click();
      await adminPage.waitForTimeout(500);

      // Should be Fully Paid now
      await expect(adminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete
      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      // Success screen should show multiple payments
      await expect(adminPage.locator('[role="alertdialog"]').locator('text=cash').first()).toBeVisible();
      await expect(adminPage.locator('[role="alertdialog"]').locator('text=qris').first()).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });

    test('CHK-006: split payment with cash change', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Add cash payment for partial amount with overpayment
      const amountInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('20000');
      const tenderedInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('25000');

      await adminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await adminPage.waitForTimeout(500);

      // Should show change in the payment line
      await expect(adminPage.locator('text=change:')).toBeVisible();

      // Add remaining via card
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Remove Payment', () => {
    test('CHK-007: remove payment from list', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Add a payment
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      // Should be Fully Paid
      await expect(adminPage.locator('text=Fully Paid')).toBeVisible();

      // Remove it
      const removeBtn = adminPage.locator('[role="alertdialog"]').locator('button').filter({ has: adminPage.locator('svg.lucide-trash2') }).first();
      await removeBtn.click();
      await adminPage.waitForTimeout(300);

      // Should be back to Remaining
      await expect(adminPage.locator('text=Remaining')).toBeVisible();

      // Cancel
      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Receipt Download', () => {
    test('CHK-008: download receipt after checkout', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Quick full cash payment
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Cash")').click();
      await adminPage.waitForTimeout(200);
      // Fill tendered for cash
      const tenderedInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) {
        const amountInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
        const val = await amountInput.inputValue();
        await tenderedInput.fill(val || '500000');
      }
      await adminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      // Click Download Receipt
      const downloadBtn = adminPage.locator('button:has-text("Download Receipt")');
      await expect(downloadBtn).toBeVisible();
      await downloadBtn.click();
      await adminPage.waitForTimeout(2000);

      // Verify no error toast
      await expect(adminPage.locator('text=Failed to generate receipt')).not.toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: New Sale Reset', () => {
    test('CHK-009: new sale clears everything', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(1000);

      // Cart should be empty
      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Transaction Detail - Payment Breakdown', () => {
    test('CHK-010: shows payment breakdown for split payment', async ({ adminPage }) => {
      const { id } = await createSplitPaymentTxnViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      // Payments table should be visible
      await expect(adminPage.locator('h3:has-text("Payments")')).toBeVisible();

      // Should show at least 2 payment rows
      const paymentRows = adminPage.locator('table').last().locator('tbody tr');
      const rowCount = await paymentRows.count();
      expect(rowCount).toBeGreaterThanOrEqual(2);

      // Method names visible
      await expect(adminPage.locator('td:has-text("cash")').first()).toBeVisible();
      await expect(adminPage.locator('td:has-text("qris")').first()).toBeVisible();
    });

    test('CHK-011: void split payment transaction', async ({ adminPage }) => {
      const { id } = await createSplitPaymentTxnViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.locator('button:has-text("Void Transaction")').click();
      await adminPage.waitForTimeout(500);
      await adminPage.fill('textarea[placeholder="Reason..."]', 'Split payment test void');
      await adminPage.locator('[role="alertdialog"] button:has-text("Void Transaction")').click();
      await adminPage.waitForTimeout(2000);

      // Voided
      await expect(adminPage.locator('h3:has-text("Transaction Voided")')).toBeVisible();

      // Payments section should still be visible
      await expect(adminPage.locator('h3:has-text("Payments")')).toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Insufficient Payment', () => {
    test('CHK-012: cannot complete with insufficient payment', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Add a very small payment
      const amountInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('100');
      const tenderedInput = adminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('100');
      await adminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await adminPage.waitForTimeout(300);

      // Remaining should still show positive
      await expect(adminPage.locator('text=Remaining')).toBeVisible();

      // Complete Sale should be disabled
      const completeBtn = adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")');
      await expect(completeBtn).toBeDisabled();

      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C3: API Validation', () => {
    test('CHK-013: API rejects insufficient payment total', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();

      const res = await fetch('http://127.0.0.1:5000/api/modules/pos/transaction/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId: loc.id,
          items: [{
            productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
            quantity: 1, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
          }],
          payments: [{ paymentMethod: 'cash', amount: 1, amountTendered: 1 }],
        }),
      });

      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('Insufficient payment');
    });

    test('CHK-016: three-way split payment via API', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi();
      const price = parseFloat(prod.sellingPrice);
      const total = price * 3;

      const result = await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{
          productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
          quantity: 3, unitPrice: price, taxApplicable: prod.taxApplicable,
        }],
        payments: [
          { paymentMethod: 'cash', amount: Math.floor(total / 3), amountTendered: Math.floor(total / 3) },
          { paymentMethod: 'card', amount: Math.floor(total / 3), paymentRef: 'CARD-1234' },
          { paymentMethod: 'qris', amount: total - 2 * Math.floor(total / 3), paymentRef: 'QRIS-5678' },
        ],
      }, headers);

      expect(result.transactionId).toBeTruthy();
      expect(result.payments).toHaveLength(3);
      expect(result.payments[0].paymentMethod).toBe('cash');
      expect(result.payments[1].paymentMethod).toBe('card');
      expect(result.payments[2].paymentMethod).toBe('qris');

      // Verify via detail endpoint
      const detail = await apiGet(`/api/modules/pos/transaction/${result.id}`, headers);
      expect(detail.payments).toHaveLength(3);
    });
  });

  test.describe('C3: Cancel Resets', () => {
    test('CHK-015: cancel checkout resets payments', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);
      await openCheckout(adminPage);

      // Add a payment
      const payFullRow = adminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await adminPage.waitForTimeout(300);

      await expect(adminPage.locator('text=Fully Paid')).toBeVisible();

      // Cancel
      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await adminPage.waitForTimeout(500);

      // Reopen checkout
      await openCheckout(adminPage);

      // Should be fresh - Remaining visible, no Fully Paid
      await expect(adminPage.locator('text=Remaining')).toBeVisible();

      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C3: Transaction in List', () => {
    test('CHK-014: split payment transaction appears in list', async ({ adminPage }) => {
      const { transactionId } = await createSplitPaymentTxnViaApi();

      await adminPage.goto('/console/modules/pos/transaction');
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(2000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill(transactionId);
      await adminPage.waitForTimeout(1500);

      await expect(adminPage.locator(`text=${transactionId}`)).toBeVisible({ timeout: 10000 });
    });
  });
});
