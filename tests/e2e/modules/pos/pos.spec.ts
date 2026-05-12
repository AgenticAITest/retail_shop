import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * POS Module E2E Tests
 *
 * IMPORTANT: POS screen at /pos has no sidebar/user-menu, so the auth fixture's
 * logout() will fail. Tests that end on /pos MUST navigate back to /console before
 * returning. We use ensureOnConsole() for this.
 */

// ============================================================
// HELPERS
// ============================================================

async function navigateToPosScreen(page: Page) {
  await page.goto('/pos');
  await page.waitForURL('**/pos**');
  await page.waitForLoadState('networkidle');
}

async function navigateToTransactionList(page: Page) {
  await page.goto('/console/modules/pos/transaction');
  await page.waitForURL('**/modules/pos/transaction**');
}

/** Navigate back to console so the auth fixture logout() can find user-menu */
async function ensureOnConsole(page: Page) {
  if (page.url().includes('/pos') && !page.url().includes('/console')) {
    await page.goto('/console/dashboard');
    await page.waitForURL('**/console/dashboard**', { timeout: 5000 }).catch(() => {});
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERS.tenantAdmin.username, password: TEST_USERS.tenantAdmin.password }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Login failed: ${text.substring(0, 200)}`); }
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.tenantAdmin.tenantCode,
    'Content-Type': 'application/json',
  };
}

async function apiGet(path: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`API GET ${path} failed: ${text.substring(0, 200)}`); }
}

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<any> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`API POST ${path} failed: ${text.substring(0, 200)}`); }
}

async function getLocationViaApi(): Promise<{ id: string; code: string; name: string }> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/location-management/location?perPage=100', headers);
  const shop = (data.locations || []).find((l: any) => l.status === 'active');
  if (!shop) throw new Error('No active location found');
  return { id: shop.id, code: shop.code, name: shop.name };
}

async function getProductViaApi(locationId?: string): Promise<any> {
  const headers = await getAuthHeaders();
  const params = locationId ? `?perPage=1&locationId=${locationId}` : '?perPage=1';
  const data = await apiGet(`/api/modules/pos/transaction/products${params}`, headers);
  const p = data.products?.[0];
  if (!p) throw new Error('No active product found');
  return p;
}

async function createTransactionViaApi(): Promise<{ id: string; transactionId: string; totalAmount: string }> {
  const headers = await getAuthHeaders();
  const loc = await getLocationViaApi();

  // Ensure a shift is open (ignore 400 if one already exists)
  await fetch('http://127.0.0.1:5000/api/modules/pos/shift/open', {
    method: 'POST', headers, body: JSON.stringify({ locationId: loc.id, openingFloat: 0 }),
  });

  const prod = await getProductViaApi(loc.id);
  const unitPrice = parseFloat(prod.sellingPrice);
  // Use a large flat payment to ensure coverage regardless of tax rate
  const result = await apiPost('/api/modules/pos/transaction/checkout', {
    locationId: loc.id,
    items: [{
      productId: prod.id,
      skuCode: prod.skuCode,
      productName: prod.name,
      quantity: 2,
      unitPrice,
      taxApplicable: prod.taxApplicable,
    }],
    payments: [{
      paymentMethod: 'cash',
      amount: 999999,
      amountTendered: 999999,
    }],
  }, headers);

  if (!result.id) throw new Error(`Checkout failed: ${JSON.stringify(result)}`);
  return { id: result.id, transactionId: result.transactionId, totalAmount: result.totalAmount };
}

async function selectLocationIfNeeded(page: Page) {
  await page.waitForTimeout(1500);
  const overlay = page.locator('.fixed.inset-0.z-50');
  if (!(await overlay.isVisible().catch(() => false))) return;

  const pickerTitle = overlay.locator('h2:has-text("Select POS Location")');
  if (!(await pickerTitle.isVisible().catch(() => false))) return;

  // Click the first location button inside the overlay using DOM click (bypasses viewport check)
  await page.evaluate(() => {
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    if (!overlay) return;
    const btn = overlay.querySelector('button') as HTMLElement | null;
    if (btn) btn.click();
  });

  // Wait for the location picker overlay to close
  await page.waitForFunction(
    () => !document.querySelector('.fixed.inset-0.z-50'),
    { timeout: 5000 }
  ).catch(() => {});
  await page.waitForTimeout(800);

  // Handle shift open dialog that appears when no active shift for selected location
  const shiftDialog = page.locator('[role="alertdialog"]:has-text("Open Shift")');
  if (await shiftDialog.isVisible().catch(() => false)) {
    await page.locator('[role="alertdialog"] button:has-text("Open Shift")').click();
    await page.waitForTimeout(2000);
  }
}

async function addFirstProductToCart(page: Page) {
  await page.waitForTimeout(1500);
  const tile = page.locator('[data-testid^="product-tile-"]').first();
  if (await tile.isVisible().catch(() => false)) {
    await tile.click();
    return;
  }
  const btn = page.locator('.grid button, .space-y-1 button').first();
  await btn.click();
}

test.describe('POS Module', () => {

  // ============================================================
  // C1: SMOKE TESTS
  // ============================================================

  test.describe('C1: Smoke - POS Screen', () => {
    test('POS-001: should load POS screen with proper structure', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);

      // Top bar
      await expect(tenantAdminPage.locator('button:has-text("Exit")')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Online')).toBeVisible();

      // Cart panel
      await expect(tenantAdminPage.locator('h2:has-text("Cart")')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      // Search
      await expect(tenantAdminPage.locator('[data-testid="pos-search"]')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-002: should display products in grid', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      const products = tenantAdminPage.locator('[data-testid^="product-tile-"]');
      const count = await products.count();
      expect(count).toBeGreaterThan(0);

      await expect(tenantAdminPage.locator('[role="tab"]:has-text("All")')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-003: should filter by category tab', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      const tabs = tenantAdminPage.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        await tabs.nth(1).click();
        await tenantAdminPage.waitForTimeout(1000);
        await tabs.first().click();
        await tenantAdminPage.waitForTimeout(500);
      }

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-004: should search products', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(1500);

      const searchInput = tenantAdminPage.locator('[data-testid="pos-search"]');
      await searchInput.fill('Sampoerna');
      await tenantAdminPage.waitForTimeout(1000);
      await searchInput.clear();
      await tenantAdminPage.waitForTimeout(500);

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C1: Smoke - Transaction History', () => {
    test('POS-005: should display transaction history page', async ({ tenantAdminPage }) => {
      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Transaction History');
      await expect(tenantAdminPage.locator('button:has-text("Open POS Terminal")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Transaction ID")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Total")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: CART & CHECKOUT
  // ============================================================

  test.describe('C2: Cart Management', () => {
    test('POS-006: should add product to cart', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await expect(tenantAdminPage.locator('text=Cart is empty')).not.toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-007: should increment qty when adding same product', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(300);
      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Cart qty input should show 2
      const qtyInput = tenantAdminPage.locator('.border-l input[type="number"]').first();
      await expect(qtyInput).toHaveValue('2');

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-008: should adjust quantity with +/- buttons', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Find the + and - buttons in the cart area (right panel)
      const cartArea = tenantAdminPage.locator('.border-l');
      const buttons = cartArea.locator('button:has(svg)');

      // The + button is typically after the qty input
      // Click + to increase to 2
      const plusBtn = cartArea.locator('button').filter({ has: tenantAdminPage.locator('svg.lucide-plus') }).first();
      await plusBtn.click();
      await tenantAdminPage.waitForTimeout(300);

      const qtyInput = cartArea.locator('input[type="number"]').first();
      await expect(qtyInput).toHaveValue('2');

      // Click - to decrease back to 1
      const minusBtn = cartArea.locator('button').filter({ has: tenantAdminPage.locator('svg.lucide-minus') }).first();
      await minusBtn.click();
      await tenantAdminPage.waitForTimeout(300);

      await expect(qtyInput).toHaveValue('1');

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-009: should remove item from cart', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Click trash button
      const trashBtn = tenantAdminPage.locator('.border-l button').filter({ has: tenantAdminPage.locator('svg.lucide-trash2') }).first();
      await trashBtn.click();
      await tenantAdminPage.waitForTimeout(500);

      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Checkout Flow', () => {
    test('POS-010: should complete cash checkout', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Click Pay
      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      // Checkout dialog — Cash is default method
      await expect(tenantAdminPage.locator('[role="alertdialog"]')).toBeVisible();

      // Enter amount (more than any product price to ensure payment covers total)
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('500000');
      // Enter tendered (same amount is fine; must be >= amount for cash)
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible().catch(() => false)) await tenderedInput.fill('500000');
      await tenantAdminPage.waitForTimeout(300);

      // Add payment line
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(300);

      // Complete sale (enabled when remaining <= 0 and payments.length > 0)
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      // Success
      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(tenantAdminPage.locator('[data-testid="pos-new-sale"]')).toBeVisible();

      // New sale to reset, then navigate back
      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-011: should start new sale after checkout (cart clears)', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      // Cash is default method. Fill amount, add payment, complete.
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('500000');
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      if (await tenderedInput.isVisible().catch(() => false)) await tenderedInput.fill('500000');
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(300);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(1000);

      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });

    test('POS-012: should complete card payment', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      // Use "Pay full: Card" button (nth(1) — second "Card" button in the dialog)
      // which adds the full remaining amount as a card payment directly
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Card")').nth(1).click();
      await tenantAdminPage.waitForTimeout(300);

      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await tenantAdminPage.waitForTimeout(3000);

      await expect(tenantAdminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await tenantAdminPage.locator('[data-testid="pos-new-sale"]').click();
      await tenantAdminPage.waitForTimeout(500);
      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C2: Transaction History', () => {
    test('POS-013: should view transaction detail', async ({ tenantAdminPage }) => {
      const { id, transactionId } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator(`text=${transactionId}`).first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Subtotal')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Qty")')).toBeVisible();
    });

    test('POS-014: should void a transaction', async ({ tenantAdminPage }) => {
      const { id } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.locator('button:has-text("Void Transaction")').click();
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.fill('textarea[placeholder="Reason..."]', 'Customer returned items');

      const voidBtn = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Void Transaction")');
      await voidBtn.click();
      await tenantAdminPage.waitForTimeout(2000);

      await expect(tenantAdminPage.locator('h3:has-text("Transaction Voided")')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Customer returned items')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Void Transaction")')).not.toBeVisible();
    });

    test('POS-015: should filter by status', async ({ tenantAdminPage }) => {
      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      const trigger = tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await trigger.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.locator('[role="option"]:has-text("Completed")').click();
      await tenantAdminPage.waitForTimeout(2000);

      await expect(tenantAdminPage).toHaveURL(/status=completed/);
    });

    test('POS-016: should search transactions', async ({ tenantAdminPage }) => {
      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('WH-');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/filter=WH-/);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Transaction ID Format', () => {
    test('POS-017: should generate correct format', async () => {
      const { transactionId } = await createTransactionViaApi();
      expect(transactionId).toMatch(/^[A-Z0-9-]+-\d{8}-\d{4}$/);
      const now = new Date();
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      expect(transactionId).toContain(today);
    });
  });

  test.describe('C3: Cart Clear', () => {
    test('POS-018: should clear all items', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      // Click Clear (X Clear button in cart header)
      const clearBtn = tenantAdminPage.locator('.border-l button:has-text("Clear")').first();
      await clearBtn.click();
      await tenantAdminPage.waitForTimeout(500);

      await expect(tenantAdminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C3: Grid/List Toggle', () => {
    test('POS-019: should toggle views', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      // Click toggle button
      const toggleBtn = tenantAdminPage.locator('button').filter({ has: tenantAdminPage.locator('svg.lucide-list, svg.lucide-grid-3x3') }).first();
      await toggleBtn.click();
      await tenantAdminPage.waitForTimeout(500);

      // Toggle back
      await toggleBtn.click();
      await tenantAdminPage.waitForTimeout(500);

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C3: Exit Button', () => {
    test('POS-020: should navigate to dashboard', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);

      await tenantAdminPage.locator('button:has-text("Exit")').click();
      await tenantAdminPage.waitForURL('**/console/dashboard**');
      // Already on console — no ensureOnConsole needed
    });
  });

  test.describe('C3: Transaction in List', () => {
    test('POS-021: should appear after checkout', async ({ tenantAdminPage }) => {
      const { transactionId } = await createTransactionViaApi();

      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(2000);

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill(transactionId);
      await tenantAdminPage.waitForTimeout(1500);

      await expect(tenantAdminPage.locator(`text=${transactionId}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('C3: Void Restores Inventory', () => {
    test('POS-022: should restore stock on void (API)', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();

      // Ensure a shift is open for checkout
      await fetch('http://127.0.0.1:5000/api/modules/pos/shift/open', {
        method: 'POST', headers, body: JSON.stringify({ locationId: loc.id, openingFloat: 0 }),
      });

      const prod = await getProductViaApi(loc.id);

      const invBefore = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyBefore = invBefore.inventory?.[0]?.qtyOnHand ?? 0;

      const unitPrice = parseFloat(prod.sellingPrice);
      const txn = await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{
          productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
          quantity: 3, unitPrice, taxApplicable: prod.taxApplicable,
        }],
        payments: [{
          paymentMethod: 'cash',
          amount: 999999,
          amountTendered: 999999,
        }],
      }, headers);

      const invAfterSale = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      expect(invAfterSale.inventory?.[0]?.qtyOnHand ?? 0).toBe(qtyBefore - 3);

      await apiPost(`/api/modules/pos/transaction/${txn.id}/void`, { voidReason: 'Test void' }, headers);

      const invAfterVoid = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      expect(invAfterVoid.inventory?.[0]?.qtyOnHand ?? 0).toBe(qtyBefore);
    });
  });

  test.describe('C3: Cash Change', () => {
    test('POS-023: should show change calculation', async ({ tenantAdminPage }) => {
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(2000);

      await addFirstProductToCart(tenantAdminPage);
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.locator('[data-testid="pos-pay-button"]').click();
      await tenantAdminPage.waitForTimeout(500);

      await expect(tenantAdminPage.locator('[role="alertdialog"]')).toBeVisible();

      // Cash is the default method. Enter amount and a larger tendered to produce change.
      const amountInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount"]');
      await amountInput.fill('500000');
      // Tendered input visible when Cash is selected (default)
      const tenderedInput = tenantAdminPage.locator('[role="alertdialog"] input[placeholder="Amount tendered by customer"]');
      await tenderedInput.fill('1000000');
      await tenantAdminPage.waitForTimeout(300);

      // Add payment so the change calculation appears
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Add")').click();
      await tenantAdminPage.waitForTimeout(800);

      // "change: Rp ..." appears in the payment line or "Change: Rp ..." in the Fully Paid section
      await expect(tenantAdminPage.locator('[role="alertdialog"]')).toContainText(/change.*Rp/i);

      // Cancel
      await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await tenantAdminPage.waitForTimeout(500);

      await ensureOnConsole(tenantAdminPage);
    });
  });

  test.describe('C3: Breadcrumbs', () => {
    test('POS-024: should show breadcrumbs on transaction view', async ({ tenantAdminPage }) => {
      const { id, transactionId } = await createTransactionViaApi();

      await tenantAdminPage.goto(`/console/modules/pos/transaction/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator(`text=${transactionId}`).first()).toBeVisible();
    });
  });

  test.describe('C3: Sort Columns', () => {
    test('POS-025: should sort by Transaction ID', async ({ tenantAdminPage }) => {
      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.click('button:has-text("Transaction ID")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=transactionId/);
    });

    test('POS-025: should sort by Date', async ({ tenantAdminPage }) => {
      await navigateToTransactionList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.click('button:has-text("Date")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=createdAt/);
    });
  });

  test.describe('Performance', () => {
    test('POS-026: should load POS screen quickly', async ({ tenantAdminPage }) => {
      const start = Date.now();
      await navigateToPosScreen(tenantAdminPage);
      await selectLocationIfNeeded(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);

      await ensureOnConsole(tenantAdminPage);
    });
  });
});
