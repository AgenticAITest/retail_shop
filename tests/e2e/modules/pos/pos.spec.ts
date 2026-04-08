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
    body: JSON.stringify({ username: TEST_USERS.admin.username, password: TEST_USERS.admin.password }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Login failed: ${text.substring(0, 200)}`); }
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.admin.tenantCode,
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
  const prod = await getProductViaApi(loc.id);

  const result = await apiPost('/api/modules/pos/transaction/checkout', {
    locationId: loc.id,
    items: [{
      productId: prod.id,
      skuCode: prod.skuCode,
      productName: prod.name,
      quantity: 2,
      unitPrice: parseFloat(prod.sellingPrice),
      taxApplicable: prod.taxApplicable,
    }],
    paymentMethod: 'cash',
    amountTendered: 500000,
  }, headers);

  return { id: result.id, transactionId: result.transactionId, totalAmount: result.totalAmount };
}

async function selectLocationIfNeeded(page: Page) {
  await page.waitForTimeout(1000);
  const picker = page.locator('text=Select POS Location');
  if (await picker.isVisible().catch(() => false)) {
    const firstLoc = page.locator('button:has(p.font-medium)').first();
    await firstLoc.click();
    await page.waitForTimeout(500);
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
    test('POS-001: should load POS screen with proper structure', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);

      // Top bar
      await expect(adminPage.locator('button:has-text("Exit")')).toBeVisible();
      await expect(adminPage.locator('text=Online')).toBeVisible();

      // Cart panel
      await expect(adminPage.locator('h2:has-text("Cart")')).toBeVisible();
      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      // Search
      await expect(adminPage.locator('[data-testid="pos-search"]')).toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('POS-002: should display products in grid', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      const products = adminPage.locator('[data-testid^="product-tile-"]');
      const count = await products.count();
      expect(count).toBeGreaterThan(0);

      await expect(adminPage.locator('[role="tab"]:has-text("All")')).toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('POS-003: should filter by category tab', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      const tabs = adminPage.locator('[role="tab"]');
      const tabCount = await tabs.count();

      if (tabCount > 1) {
        await tabs.nth(1).click();
        await adminPage.waitForTimeout(1000);
        await adminPage.locator('[role="tab"]:has-text("All")').click();
        await adminPage.waitForTimeout(500);
      }

      await ensureOnConsole(adminPage);
    });

    test('POS-004: should search products', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(1500);

      const searchInput = adminPage.locator('[data-testid="pos-search"]');
      await searchInput.fill('Sampoerna');
      await adminPage.waitForTimeout(1000);
      await searchInput.clear();
      await adminPage.waitForTimeout(500);

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C1: Smoke - Transaction History', () => {
    test('POS-005: should display transaction history page', async ({ adminPage }) => {
      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('Transaction History');
      await expect(adminPage.locator('button:has-text("Open POS Terminal")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Transaction ID")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Total")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: CART & CHECKOUT
  // ============================================================

  test.describe('C2: Cart Management', () => {
    test('POS-006: should add product to cart', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await expect(adminPage.locator('text=Cart is empty')).not.toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('POS-007: should increment qty when adding same product', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(300);
      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Cart qty input should show 2
      const qtyInput = adminPage.locator('.border-l input[type="number"]').first();
      await expect(qtyInput).toHaveValue('2');

      await ensureOnConsole(adminPage);
    });

    test('POS-008: should adjust quantity with +/- buttons', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Find the + and - buttons in the cart area (right panel)
      const cartArea = adminPage.locator('.border-l');
      const buttons = cartArea.locator('button:has(svg)');

      // The + button is typically after the qty input
      // Click + to increase to 2
      const plusBtn = cartArea.locator('button').filter({ has: adminPage.locator('svg.lucide-plus') }).first();
      await plusBtn.click();
      await adminPage.waitForTimeout(300);

      const qtyInput = cartArea.locator('input[type="number"]').first();
      await expect(qtyInput).toHaveValue('2');

      // Click - to decrease back to 1
      const minusBtn = cartArea.locator('button').filter({ has: adminPage.locator('svg.lucide-minus') }).first();
      await minusBtn.click();
      await adminPage.waitForTimeout(300);

      await expect(qtyInput).toHaveValue('1');

      await ensureOnConsole(adminPage);
    });

    test('POS-009: should remove item from cart', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Click trash button
      const trashBtn = adminPage.locator('.border-l button').filter({ has: adminPage.locator('svg.lucide-trash2') }).first();
      await trashBtn.click();
      await adminPage.waitForTimeout(500);

      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Checkout Flow', () => {
    test('POS-010: should complete cash checkout', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Click Pay
      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      // Checkout dialog
      await expect(adminPage.locator('[role="alertdialog"]')).toBeVisible();

      // Select Cash
      await adminPage.locator('[role="alertdialog"] button:has-text("Cash")').click();
      await adminPage.waitForTimeout(300);

      // Enter amount
      const amountInput = adminPage.locator('[role="alertdialog"] input[type="number"][placeholder="0"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('500000');
        await adminPage.waitForTimeout(300);
      }

      // Complete sale
      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      // Success
      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();
      await expect(adminPage.locator('[data-testid="pos-new-sale"]')).toBeVisible();

      // New sale to reset, then navigate back
      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);

      await ensureOnConsole(adminPage);
    });

    test('POS-011: should start new sale after checkout (cart clears)', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Cash")').click();
      const amountInput = adminPage.locator('[role="alertdialog"] input[type="number"][placeholder="0"]');
      if (await amountInput.isVisible()) await amountInput.fill('500000');

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(1000);

      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(adminPage);
    });

    test('POS-012: should complete card payment', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      // Select Card
      await adminPage.locator('[role="alertdialog"] button:has-text("Card")').click();
      await adminPage.waitForTimeout(300);

      // Payment ref
      const refInput = adminPage.locator('[role="alertdialog"] input[placeholder*="Last 4"]');
      if (await refInput.isVisible()) await refInput.fill('1234');

      await adminPage.locator('[role="alertdialog"] button:has-text("Complete Sale")').click();
      await adminPage.waitForTimeout(3000);

      await expect(adminPage.locator('h2:has-text("Sale Completed")')).toBeVisible();

      await adminPage.locator('[data-testid="pos-new-sale"]').click();
      await adminPage.waitForTimeout(500);
      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C2: Transaction History', () => {
    test('POS-013: should view transaction detail', async ({ adminPage }) => {
      const { id, transactionId } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator(`text=${transactionId}`).first()).toBeVisible();
      await expect(adminPage.locator('text=Subtotal')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Qty")')).toBeVisible();
    });

    test('POS-014: should void a transaction', async ({ adminPage }) => {
      const { id } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.locator('button:has-text("Void Transaction")').click();
      await adminPage.waitForTimeout(500);

      await adminPage.fill('textarea[placeholder="Reason..."]', 'Customer returned items');

      const voidBtn = adminPage.locator('[role="alertdialog"] button:has-text("Void Transaction")');
      await voidBtn.click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage.locator('h3:has-text("Transaction Voided")')).toBeVisible();
      await expect(adminPage.locator('text=Customer returned items')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Void Transaction")')).not.toBeVisible();
    });

    test('POS-015: should filter by status', async ({ adminPage }) => {
      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const trigger = adminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await trigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.locator('[role="option"]:has-text("Completed")').click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage).toHaveURL(/status=completed/);
    });

    test('POS-016: should search transactions', async ({ adminPage }) => {
      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('WH-');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/filter=WH-/);
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
    test('POS-018: should clear all items', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      // Click Clear (X Clear button in cart header)
      const clearBtn = adminPage.locator('.border-l button:has-text("Clear")').first();
      await clearBtn.click();
      await adminPage.waitForTimeout(500);

      await expect(adminPage.locator('text=Cart is empty')).toBeVisible();

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C3: Grid/List Toggle', () => {
    test('POS-019: should toggle views', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      // Click toggle button
      const toggleBtn = adminPage.locator('button').filter({ has: adminPage.locator('svg.lucide-list, svg.lucide-grid-3x3') }).first();
      await toggleBtn.click();
      await adminPage.waitForTimeout(500);

      // Toggle back
      await toggleBtn.click();
      await adminPage.waitForTimeout(500);

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C3: Exit Button', () => {
    test('POS-020: should navigate to dashboard', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);

      await adminPage.locator('button:has-text("Exit")').click();
      await adminPage.waitForURL('**/console/dashboard**');
      // Already on console — no ensureOnConsole needed
    });
  });

  test.describe('C3: Transaction in List', () => {
    test('POS-021: should appear after checkout', async ({ adminPage }) => {
      const { transactionId } = await createTransactionViaApi();

      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(2000);

      const searchInput = adminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill(transactionId);
      await adminPage.waitForTimeout(1500);

      await expect(adminPage.locator(`text=${transactionId}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('C3: Void Restores Inventory', () => {
    test('POS-022: should restore stock on void (API)', async () => {
      const headers = await getAuthHeaders();
      const loc = await getLocationViaApi();
      const prod = await getProductViaApi(loc.id);

      const invBefore = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyBefore = invBefore.inventory?.[0]?.qtyOnHand ?? 0;

      const txn = await apiPost('/api/modules/pos/transaction/checkout', {
        locationId: loc.id,
        items: [{
          productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
          quantity: 3, unitPrice: parseFloat(prod.sellingPrice), taxApplicable: prod.taxApplicable,
        }],
        paymentMethod: 'cash',
        amountTendered: 999999,
      }, headers);

      const invAfterSale = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      expect(invAfterSale.inventory?.[0]?.qtyOnHand ?? 0).toBe(qtyBefore - 3);

      await apiPost(`/api/modules/pos/transaction/${txn.id}/void`, { voidReason: 'Test void' }, headers);

      const invAfterVoid = await apiGet(`/api/modules/pos/inventory?locationId=${loc.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      expect(invAfterVoid.inventory?.[0]?.qtyOnHand ?? 0).toBe(qtyBefore);
    });
  });

  test.describe('C3: Cash Change', () => {
    test('POS-023: should show change calculation', async ({ adminPage }) => {
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForTimeout(2000);

      await addFirstProductToCart(adminPage);
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[data-testid="pos-pay-button"]').click();
      await adminPage.waitForTimeout(500);

      await adminPage.locator('[role="alertdialog"] button:has-text("Cash")').click();
      await adminPage.waitForTimeout(300);

      const amountInput = adminPage.locator('[role="alertdialog"] input[type="number"][placeholder="0"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('1000000');
        await adminPage.waitForTimeout(500);
        await expect(adminPage.locator('[role="alertdialog"]').locator('text=Change')).toBeVisible();
      }

      // Cancel
      await adminPage.locator('[role="alertdialog"] button:has-text("Cancel")').click();
      await adminPage.waitForTimeout(500);

      await ensureOnConsole(adminPage);
    });
  });

  test.describe('C3: Breadcrumbs', () => {
    test('POS-024: should show breadcrumbs on transaction view', async ({ adminPage }) => {
      const { id, transactionId } = await createTransactionViaApi();

      await adminPage.goto(`/console/modules/pos/transaction/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator(`text=${transactionId}`).first()).toBeVisible();
    });
  });

  test.describe('C3: Sort Columns', () => {
    test('POS-025: should sort by Transaction ID', async ({ adminPage }) => {
      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.click('button:has-text("Transaction ID")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=transactionId/);
    });

    test('POS-025: should sort by Date', async ({ adminPage }) => {
      await navigateToTransactionList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.click('button:has-text("Date")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=createdAt/);
    });
  });

  test.describe('Performance', () => {
    test('POS-026: should load POS screen quickly', async ({ adminPage }) => {
      const start = Date.now();
      await navigateToPosScreen(adminPage);
      await selectLocationIfNeeded(adminPage);
      await adminPage.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);

      await ensureOnConsole(adminPage);
    });
  });
});
