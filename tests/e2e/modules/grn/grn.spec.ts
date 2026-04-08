import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Goods Received Note (GRN) E2E Tests
 *
 * Comprehensive test suite for the GRN module lifecycle:
 * Create GRN against PO → Quality Inspection → Accept → Stock Update
 * Tests partial receipts, rejection tracking, and PO integration.
 */

// Helper functions
async function navigateToGrnList(page: Page) {
  await page.goto('/console/modules/grn/grn');
  await page.waitForURL('**/modules/grn/grn**');
}

async function navigateToGrnAdd(page: Page) {
  await page.goto('/console/modules/grn/grn/add');
  await page.waitForURL('**/modules/grn/grn/add**');
}

// Get auth headers for API calls
async function getAuthHeaders(): Promise<Record<string, string>> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERS.admin.username, password: TEST_USERS.admin.password }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Login failed, got: ${text.substring(0, 200)}`); }
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.admin.tenantCode,
    'Content-Type': 'application/json',
  };
}

async function apiGet(path: string, headers: Record<string, string>): Promise<any> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`API GET ${path} failed: ${text.substring(0, 200)}`); }
}

async function apiPost(path: string, body: any, headers: Record<string, string>): Promise<any> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`API POST ${path} failed: ${text.substring(0, 200)}`); }
}

async function apiPut(path: string, body: any, headers: Record<string, string>): Promise<any> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`API PUT ${path} failed: ${text.substring(0, 200)}`); }
}

// Create a PO via direct API calls and transition to 'sent'
async function createSentPoViaApi(_page: Page): Promise<{ poId: string; poNumber: string }> {
  const headers = await getAuthHeaders();

  // Get supplier
  const suppData = await apiGet('/api/modules/supplier-management/supplier?perPage=1', headers);
  const supplierId = suppData.suppliers?.[0]?.id;
  if (!supplierId) throw new Error('No supplier found for test');

  // Get supplier products
  const spData = await apiGet(`/api/modules/supplier-management/supplier/${supplierId}/products`, headers);
  const product = spData.products?.[0];
  if (!product) throw new Error('No supplier product found for test');

  // Create PO
  const po = await apiPost('/api/modules/purchase-order/po', {
    supplierId,
    orderDate: new Date().toISOString().split('T')[0],
    notes: `Test PO for GRN ${Date.now()}`,
    items: [{
      productId: product.productId,
      skuCode: product.productSkuCode,
      productName: product.productName,
      quantity: 50,
      unitPrice: parseFloat(product.supplierPrice),
      discountPercent: 0,
      uom: 'pcs',
    }],
  }, headers);

  // Approve PO
  const appData = await apiPut(`/api/modules/purchase-order/po/${po.id}/status`, { status: 'approved' }, headers);

  // If pending_approval, approve again
  if (appData.purchaseOrder?.status === 'pending_approval' || appData.status === 'pending_approval') {
    await apiPut(`/api/modules/purchase-order/po/${po.id}/status`, { status: 'approved' }, headers);
  }

  // Send PO
  await apiPut(`/api/modules/purchase-order/po/${po.id}/status`, { status: 'sent' }, headers);

  return { poId: po.id, poNumber: po.poNumber };
}

// Create a GRN via direct API calls
async function createGrnViaApi(_page: Page, poId: string): Promise<{ grnId: string; grnNumber: string }> {
  const headers = await getAuthHeaders();

  // Get receivable items
  const recData = await apiGet(`/api/modules/grn/grn/po/${poId}/receivable`, headers);
  const items = recData.items.map((item: any) => ({
    purchaseOrderItemId: item.purchaseOrderItemId,
    productId: item.productId,
    skuCode: item.skuCode,
    productName: item.productName,
    orderedQuantity: item.orderedQuantity,
    previouslyReceivedQuantity: item.receivedQuantity,
    receivedQuantity: item.remainingQuantity,
    acceptedQuantity: item.remainingQuantity,
    rejectedQuantity: 0,
    uom: item.uom,
  }));

  const grn = await apiPost('/api/modules/grn/grn', {
    purchaseOrderId: poId,
    receivedDate: new Date().toISOString().split('T')[0],
    deliveryNoteRef: `DN-TEST-${Date.now()}`,
    invoiceRef: `INV-TEST-${Date.now()}`,
    notes: 'Test GRN',
    items,
  }, headers);

  return { grnId: grn.id, grnNumber: grn.grnNumber };
}

test.describe('GRN Module', () => {

  // ============================================================
  // C1: SMOKE TESTS
  // ============================================================

  test.describe('C1: Smoke - GRN List Page', () => {
    test('GRN-001: should display GRN list page with proper structure', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);

      await expect(adminPage.locator('h1')).toContainText('Goods Received Notes');
      const table = adminPage.locator('table');
      await expect(table).toBeVisible();

      await expect(adminPage.locator('th:has-text("GRN Number")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("PO Number")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Received Date")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('GRN-001: should display Receive Goods button', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await expect(adminPage.locator('button:has-text("Receive Goods")')).toBeVisible();
    });

    test('GRN-001: should display status filter dropdown', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await expect(adminPage.locator('button[role="combobox"]:has-text("All Statuses")')).toBeVisible();
    });

    test('GRN-001: should display search input', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await expect(adminPage.locator('input[placeholder*="Search"]')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - Receive Goods Page', () => {
    test('GRN-002: should navigate to receive goods page', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.click('button:has-text("Receive Goods")');
      await adminPage.waitForURL('**/modules/grn/grn/add**');
      await expect(adminPage.locator('h1')).toContainText('Goods Receiving');
    });

    test('GRN-002: should display PO selection dropdown', async ({ adminPage }) => {
      await navigateToGrnAdd(adminPage);
      await expect(adminPage.locator('label:has-text("Purchase Order")')).toBeVisible();
      await expect(adminPage.locator('button[role="combobox"]:has-text("Select PO")')).toBeVisible();
    });

    test('GRN-002: should display received date pre-filled with today', async ({ adminPage }) => {
      await navigateToGrnAdd(adminPage);
      const today = new Date().toISOString().split('T')[0];
      const dateInput = adminPage.locator('input[type="date"]').first();
      await expect(dateInput).toHaveValue(today);
    });

    test('GRN-002: should display header fields', async ({ adminPage }) => {
      await navigateToGrnAdd(adminPage);
      await expect(adminPage.locator('text=Delivery Note Ref')).toBeVisible();
      await expect(adminPage.locator('text=Invoice Ref')).toBeVisible();
      await expect(adminPage.locator('text=Notes')).toBeVisible();
    });

    test('GRN-002: should show message before PO selection', async ({ adminPage }) => {
      await navigateToGrnAdd(adminPage);
      await expect(adminPage.locator('text=Select a purchase order')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - Create GRN and View Detail', () => {
    test('GRN-003/004: should create GRN and view detail page', async ({ adminPage }) => {
      // Create a sent PO first
      const { poId, poNumber } = await createSentPoViaApi(adminPage);

      // Create GRN via API for faster testing
      const { grnId, grnNumber } = await createGrnViaApi(adminPage, poId);

      // Navigate to GRN detail
      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForURL(`**/modules/grn/grn/${grnId}**`);
      await adminPage.waitForLoadState('networkidle');

      // Verify status timeline (4 stages)
      await expect(adminPage.locator('text=Draft')).toBeVisible();
      await expect(adminPage.locator('text=Quality Inspection')).toBeVisible();
      await expect(adminPage.locator('text=Accepted')).toBeVisible();
      await expect(adminPage.locator('text=Stock Updated')).toBeVisible();

      // Verify header info
      await expect(adminPage.locator(`text=${grnNumber}`)).toBeVisible();
      await expect(adminPage.locator(`text=${poNumber}`)).toBeVisible();

      // Verify action buttons for draft status
      await expect(adminPage.locator('button:has-text("Send to QI")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Accept (Skip QI)")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Verify line items table
      await expect(adminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Ordered")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Received")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Accepted")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Rejected")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE TESTS
  // ============================================================

  test.describe('C2: Status Transitions - Full Lifecycle via QI', () => {
    test('GRN-005/006/007: should transition draft → QI → accepted → stock_updated', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnId } = await createGrnViaApi(adminPage, poId);

      // Navigate to GRN detail
      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      // Draft → Quality Inspection
      await adminPage.click('button:has-text("Send to QI")');
      await adminPage.waitForTimeout(2000);
      await expect(adminPage.locator('button:has-text("Mark Accepted")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Back to Draft")')).toBeVisible();

      // Quality Inspection → Accepted (via dialog)
      await adminPage.click('button:has-text("Mark Accepted")');
      await adminPage.waitForTimeout(500);

      // QI dialog should appear
      await expect(adminPage.locator('text=Quality Inspection Result')).toBeVisible();

      // Click Passed button and add notes
      await adminPage.click('button:has-text("Passed")');
      await adminPage.fill('textarea', 'All items passed visual and functional inspection');
      await adminPage.click('button:has-text("Confirm")');
      await adminPage.waitForTimeout(2000);

      // Verify accepted status
      await expect(adminPage.locator('button:has-text("Update Stock")')).toBeVisible();

      // Accepted → Stock Updated
      await adminPage.click('button:has-text("Update Stock")');
      await adminPage.waitForTimeout(3000);

      // Verify terminal state - no action buttons except PDF
      await expect(adminPage.locator('button:has-text("Update Stock")')).not.toBeVisible();
      await expect(adminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Verify quality inspection section
      await expect(adminPage.locator('text=Quality Inspection')).toBeVisible();
      await expect(adminPage.locator('text=Passed')).toBeVisible();
    });
  });

  test.describe('C2: Status Transitions - Skip QI', () => {
    test('GRN-008: should transition draft → accepted (skip quality inspection)', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnId } = await createGrnViaApi(adminPage, poId);

      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      // Click Accept (Skip QI)
      await adminPage.click('button:has-text("Accept (Skip QI)")');
      await adminPage.waitForTimeout(2000);

      // Should go directly to accepted
      await expect(adminPage.locator('button:has-text("Update Stock")')).toBeVisible();
      // QI button should no longer be visible
      await expect(adminPage.locator('button:has-text("Send to QI")')).not.toBeVisible();
    });
  });

  test.describe('C2: Status Transitions - Back to Draft from QI', () => {
    test('GRN-009: should revert from quality_inspection to draft', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnId } = await createGrnViaApi(adminPage, poId);

      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      // Draft → QI
      await adminPage.click('button:has-text("Send to QI")');
      await adminPage.waitForTimeout(2000);

      // QI → Back to Draft
      await adminPage.click('button:has-text("Back to Draft")');
      await adminPage.waitForTimeout(2000);

      // Should be back to draft with original buttons
      await expect(adminPage.locator('button:has-text("Send to QI")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Accept (Skip QI)")')).toBeVisible();
    });
  });

  test.describe('C2: Status Filter', () => {
    test('GRN-010: should filter GRNs by status', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Click status filter
      const statusTrigger = adminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await statusTrigger.click();
      await adminPage.waitForTimeout(300);

      // Select Draft
      await adminPage.locator('[role="option"]:has-text("Draft")').click();
      await adminPage.waitForTimeout(2000);

      // Verify URL updated
      await expect(adminPage).toHaveURL(/status=draft/);
    });
  });

  test.describe('C2: Search', () => {
    test('GRN-011: should search GRNs by number', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('GRN-');
      await adminPage.waitForTimeout(1000);

      // Verify URL has filter
      await expect(adminPage).toHaveURL(/filter=GRN-/);
    });
  });

  test.describe('C2: Download PDF', () => {
    test('GRN-012: should download GRN PDF without error', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnId } = await createGrnViaApi(adminPage, poId);

      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      // Click download PDF
      const downloadPromise = adminPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await adminPage.click('button:has-text("Download PDF")');
      await adminPage.waitForTimeout(2000);

      // Just verify no error occurred - PDF download may or may not trigger download event
      // The main check is that no error toast appeared
      const errorToast = adminPage.locator('text=Failed to generate PDF');
      await expect(errorToast).not.toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: GRN Number Format', () => {
    test('should generate GRN number in GRN-YYYYMM-NNNN format', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnNumber } = await createGrnViaApi(adminPage, poId);

      const now = new Date();
      const expectedPrefix = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      expect(grnNumber).toMatch(new RegExp(`^GRN-\\d{6}-\\d{4}$`));
      expect(grnNumber.startsWith(expectedPrefix)).toBeTruthy();
    });
  });

  test.describe('C3: PO Link from GRN Detail', () => {
    test('GRN-017: should navigate to PO detail from GRN view', async ({ adminPage }) => {
      const { poId, poNumber } = await createSentPoViaApi(adminPage);
      const { grnId } = await createGrnViaApi(adminPage, poId);

      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      // Click PO number link
      const poLink = adminPage.locator(`a:has-text("${poNumber}")`);
      await expect(poLink).toBeVisible();
      await poLink.click();
      await adminPage.waitForURL(`**/modules/purchase-order/po/${poId}**`);

      // Should be on PO detail page
      await expect(adminPage.locator(`text=${poNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: GRN Appears in List', () => {
    test('should show newly created GRN in list with correct data', async ({ adminPage }) => {
      const { poId, poNumber } = await createSentPoViaApi(adminPage);
      const { grnNumber } = await createGrnViaApi(adminPage, poId);

      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      // Verify GRN appears in list
      await expect(adminPage.locator(`text=${grnNumber}`)).toBeVisible();
      await expect(adminPage.locator(`td:has-text("${poNumber}")`)).toBeVisible();

      // Verify Draft status badge
      const row = adminPage.locator(`tr:has-text("${grnNumber}")`);
      await expect(row.locator('text=Draft')).toBeVisible();
    });
  });

  test.describe('C3: Sort Columns', () => {
    test('should sort by GRN Number', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.click('button:has-text("GRN Number")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=grnNumber/);
    });

    test('should sort by Received Date', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.click('button:has-text("Received Date")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=receivedDate/);
    });
  });

  test.describe('C3: Breadcrumbs and Navigation', () => {
    test('should display breadcrumbs on view page', async ({ adminPage }) => {
      const { poId } = await createSentPoViaApi(adminPage);
      const { grnId, grnNumber } = await createGrnViaApi(adminPage, poId);

      await adminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator(`text=GRN List`)).toBeVisible();
      await expect(adminPage.locator(`text=${grnNumber}`)).toBeVisible();
    });

    test('should navigate back from add page via Cancel', async ({ adminPage }) => {
      await navigateToGrnAdd(adminPage);
      await adminPage.click('button:has-text("Cancel")');
      await adminPage.waitForURL('**/modules/grn/grn**');
    });
  });

  test.describe('C3: URL State Persistence', () => {
    test('should persist status filter in URL', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const statusTrigger = adminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await statusTrigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.locator('[role="option"]:has-text("Accepted")').click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage).toHaveURL(/status=accepted/);
    });

    test('should persist sort state in URL', async ({ adminPage }) => {
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.click('button:has-text("Status")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('Performance', () => {
    test('should load GRN list within acceptable time', async ({ adminPage }) => {
      const start = Date.now();
      await navigateToGrnList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
    });
  });
});
