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

  // Ensure a shift is open (ignore 400 if one already exists)
  await fetch('http://127.0.0.1:5000/api/modules/pos/shift/open', {
    method: 'POST', headers, body: JSON.stringify({ locationId: loc.id, openingFloat: 0 }),
  });

  const prod = await getProductViaApi();
  const price = parseFloat(prod.sellingPrice);
  const total = Math.ceil(price * 2 * 1.15); // qty=2 + 15% tax buffer

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
    test('CHK-001: checkout dialog opens with split payment UI', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await openCheckout(tenantAdminPage);

      // Dialog visible
      await expect(tenantAdminPage.locator('[role="alertdialog"]')).toBeVisible();

      // Add Payment section
      await expect(tenantAdminPage.locator('text=Add Payment')).toBeVisible();

      // Payment method buttons (use first() since they also appear in "Pay full" row)
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cash")').first()).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("Card")').first()).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("QRIS")').first()).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"] button:has-text("Transfer")').first()).toBeVisible();

      // Remaining balance shown
      await expect(tenantAdminPage.locator('text=Remaining')).toBeVisible();

      // Complete Sale disabled (no payments added yet)
      const completeBtn = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")');
      await expect(completeBtn).toBeDisabled();

      // Cancel
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await tenantAdminPage.waitForTimeout(300);
      await ensureOnConsole(tenantAdminPage);
    });

    test('CHK-002: quick amount buttons visible', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Quick amount buttons should be visible (contain "Rp")
      const quickBtns = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Rp")');
      const count = await quickBtns.count();
      expect(count).toBeGreaterThan(0);

      // Cancel
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(tenantAdminPage);
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE
  // ============================================================

  test.describe('C2: Single Payment', () => {
    test('CHK-003: single cash payment completes sale', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Click a quick amount to fill (first one = exact amount)
      const quickBtn = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Rp")').first();
      await quickBtn.click();
      await tenantAdminPage.waitForTimeout(200);

      // Cash tendered should auto-fill too — click Add
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should show Fully Paid
      await expect(tenantAdminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete Sale enabled
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      // Success
      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(tenantAdminPage.locator('[data-testid="pos-new-sale"]')).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });

    test('CHK-004: single card payment via Pay full shortcut', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Click "Card" in the Pay full row
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should be Fully Paid
      await expect(tenantAdminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Split Payment', () => {
    test('CHK-005: split payment Cash + QRIS', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Add partial cash payment
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('20000');
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('20000');

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should show Remaining (not Fully Paid)
      await expect(tenantAdminPage.locator('text=Remaining')).toBeVisible();

      // Payment line should show in list
      await expect(tenantAdminPage.locator('text=Payments Added')).toBeVisible();

      // Add QRIS for remaining via Pay full shortcut
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("QRIS")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should be Fully Paid now
      await expect(tenantAdminPage.locator('text=Fully Paid')).toBeVisible();

      // Complete
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      // Success screen should show multiple payments
      await expect(tenantAdminPage.locator('[role="alertdialog"]').locator('text=cash').first()).toBeVisible();
      await expect(tenantAdminPage.locator('[role="alertdialog"]').locator('text=qris').first()).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });

    test('CHK-006: split payment with cash change', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Add cash payment for partial amount with overpayment
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('20000');
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('25000');

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should show change in the payment line
      await expect(tenantAdminPage.locator('text=change:')).toBeVisible();

      // Add remaining via card
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Remove Payment', () => {
    test('CHK-007: remove payment from list', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Add a payment
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Should be Fully Paid
      await expect(tenantAdminPage.locator('text=Fully Paid')).toBeVisible();

      // Remove it
      const removeBtn = tenantAdminPage.locator('[role="alertdialog"]').locator('button').filter({ has: tenantAdminPage.locator('svg.lucide-trash2') }).first();
      await removeBtn.click();
      await tenantAdminPage.waitForTimeout(300);

      // Should be back to Remaining
      await expect(tenantAdminPage.locator('text=Remaining')).toBeVisible();

      // Cancel
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Receipt Download', () => {
    test('CHK-008: download receipt after checkout', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Quick full cash payment
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Cash")').click();
      await tenantAdminPage.waitForTimeout(200);
      // Fill tendered for cash
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) {
        const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
        const val = await amountInput.inputValue();
        await tenderedInput.fill(val || '500000');
      }
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      // Click Download Receipt
      const downloadBtn = tenantAdminPage.locator('button:has-text("Download Receipt")');
      await expect(downloadBtn).toBeVisible();
      await downloadBtn.click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify no error toast
      await expect(tenantAdminPage.locator('text=Failed to generate receipt')).not.toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: New Sale Reset', () => {
    test('CHK-009: new sale clears everything', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(1000);

      // Cart should be empty
      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Transaction Detail - Payment Breakdown', () => {
    test('CHK-010: shows payment breakdown for split payment', async ({ tenantAdminPage }) => {
      const { id } = await createSplitPaymentTxnViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Payments table should be visible
      await expect(tenantAdminPage.locator('h3:has-text("Payments")')).toBeVisible();

      // Should show at least 2 payment rows
      const paymentRows = tenantAdminPage.locator('table').last().locator('tbody tr');
      const rowCount = await paymentRows.count();
      expect(rowCount).toBeGreaterThanOrEqual(2);

      // Method names visible
      await expect(tenantAdminPage.locator('td:has-text("cash")').first()).toBeVisible();
      await expect(tenantAdminPage.locator('td:has-text("qris")').first()).toBeVisible();
    });

    test('CHK-011: void split payment transaction', async ({ tenantAdminPage }) => {
      const { id } = await createSplitPaymentTxnViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.locator('button:has-text("Void Transaction")').click();
      await tenantAdminPage.waitForTimeout(500);
      await tenantAdminPage.fill('textarea[placeholder="Reason..."]', 'Split payment test void');
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Void Transaction")').click();
      await tenantAdminPage.waitForTimeout(2000);

      // Voided
      await expect(tenantAdminPage.locator('h3:has-text("Transaction Voided")')).toBeVisible();

      // Payments section should still be visible
      await expect(tenantAdminPage.locator('h3:has-text("Payments")')).toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Insufficient Payment', () => {
    test('CHK-012: cannot complete with insufficient payment', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Add a very small payment
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('100');
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible()) await tenderedInput.fill('100');
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(300);

      // Remaining should still show positive
      await expect(tenantAdminPage.locator('text=Remaining')).toBeVisible();

      // Complete Sale should be disabled
      const completeBtn = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")');
      await expect(completeBtn).toBeDisabled();

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(tenantAdminPage);
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
    test('CHK-015: cancel checkout resets payments', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);
      await openCheckout(tenantAdminPage);

      // Add a payment
      const payFullRow = tenantAdminPage.locator('text=Pay full:').locator('..');
      await payFullRow.locator('button:has-text("Card")').click();
      await tenantAdminPage.waitForTimeout(300);

      await expect(tenantAdminPage.locator('text=Fully Paid')).toBeVisible();

      // Cancel
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await tenantAdminPage.waitForTimeout(500);

      // Reopen checkout
      await openCheckout(tenantAdminPage);

      // Should be fresh - Remaining visible, no Fully Paid
      await expect(tenantAdminPage.locator('text=Remaining')).toBeVisible();

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C3: Transaction in List', () => {
    test('CHK-014: split payment transaction appears in list', async ({ tenantAdminPage }) => {
      const { transactionId } = await createSplitPaymentTxnViaApi();

      await tenantAdminPage.goto('/console/modules/pos/transaction');
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(2000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill(transactionId);
      await tenantAdminPage.waitForTimeout(1500);

      await expect(tenantAdminPage.locator(`text=${transactionId}`)).toBeVisible({ timeout: 10000 });
    });
  });
});
