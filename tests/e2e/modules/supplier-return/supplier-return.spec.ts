import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Supplier Return & Credit Note E2E Tests
 *
 * Comprehensive test suite for the Supplier Return module lifecycle:
 * Create Return against GRN → Approval → Dispatch → Acknowledge → Credit Note → Close
 * Tests rejection, credit notes, replacement receipts, and cross-module navigation.
 */

// Helper functions
async function navigateToReturnList(page: Page) {
  await page.goto('/console/modules/supplier-return/return');
  await page.waitForURL('**/modules/supplier-return/return**');
}

async function navigateToReturnAdd(page: Page) {
  await page.goto('/console/modules/supplier-return/return/add');
  await page.waitForURL('**/modules/supplier-return/return/add**');
}

async function navigateToCreditNoteList(page: Page) {
  await page.goto('/console/modules/supplier-return/credit-note');
  await page.waitForURL('**/modules/supplier-return/credit-note**');
}

// Get auth headers for API calls
async function getAuthHeaders(): Promise<Record<string, string>> {
  const baseUrl = 'http://127.0.0.1:5000';
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: TEST_USERS.tenantAdmin.username, password: TEST_USERS.tenantAdmin.password }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`Login failed, got: ${text.substring(0, 200)}`); }
  return {
    'Authorization': `Bearer ${data.accessToken}`,
    'X-Tenant-Code': TEST_USERS.tenantAdmin.tenantCode,
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

// Create a PO → send → GRN → accept → stock_updated via API, then return IDs
async function createStockUpdatedGrnViaApi(): Promise<{
  poId: string; poNumber: string; grnId: string; grnNumber: string; supplierId: string;
}> {
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
    notes: `Test PO for SR ${Date.now()}`,
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
  if (appData.purchaseOrder?.status === 'pending_approval' || appData.status === 'pending_approval') {
    await apiPut(`/api/modules/purchase-order/po/${po.id}/status`, { status: 'approved' }, headers);
  }

  // Send PO
  await apiPut(`/api/modules/purchase-order/po/${po.id}/status`, { status: 'sent' }, headers);

  // Create GRN
  const recData = await apiGet(`/api/modules/grn/grn/po/${po.id}/receivable`, headers);
  const grnItems = recData.items.map((item: any) => ({
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
    purchaseOrderId: po.id,
    receivedDate: new Date().toISOString().split('T')[0],
    deliveryNoteRef: `DN-SR-TEST-${Date.now()}`,
    notes: 'Test GRN for supplier return',
    items: grnItems,
  }, headers);

  // Accept GRN (skip QI)
  await apiPut(`/api/modules/grn/grn/${grn.id}/status`, { status: 'accepted' }, headers);

  // Stock update
  await apiPut(`/api/modules/grn/grn/${grn.id}/status`, { status: 'stock_updated' }, headers);

  return {
    poId: po.id,
    poNumber: po.poNumber,
    grnId: grn.id,
    grnNumber: grn.grnNumber,
    supplierId,
  };
}

// Create a supplier return via API
async function createReturnViaApi(grnId: string): Promise<{ returnId: string; returnNumber: string }> {
  const headers = await getAuthHeaders();

  // Get returnable items
  const retData = await apiGet(`/api/modules/supplier-return/return/grn/${grnId}/returnable`, headers);
  if (!retData.items?.length) throw new Error('No returnable items found');

  const items = retData.items.map((item: any) => ({
    grnItemId: item.grnItemId,
    productId: item.productId,
    skuCode: item.skuCode,
    productName: item.productName,
    returnQuantity: Math.min(10, item.returnableQuantity),
    reasonCode: 'defective',
    reasonNotes: 'Test return item',
    uom: item.uom,
  }));

  const sr = await apiPost('/api/modules/supplier-return/return', {
    grnId,
    returnDate: new Date().toISOString().split('T')[0],
    notes: `Test supplier return ${Date.now()}`,
    items,
  }, headers);

  return { returnId: sr.id, returnNumber: sr.returnNumber };
}

// Transition a return through the full lifecycle up to a target status
async function transitionReturnTo(
  returnId: string,
  targetStatus: 'pending_approval' | 'approved' | 'dispatched' | 'acknowledged' | 'credit_note_received' | 'closed'
) {
  const headers = await getAuthHeaders();
  const transitions: string[] = [];

  switch (targetStatus) {
    case 'closed':
      transitions.push('approved', 'dispatched', 'acknowledged', 'closed');
      break;
    case 'credit_note_received':
      transitions.push('approved', 'dispatched', 'acknowledged');
      break;
    case 'acknowledged':
      transitions.push('approved', 'dispatched', 'acknowledged');
      break;
    case 'dispatched':
      transitions.push('approved', 'dispatched');
      break;
    case 'approved':
      transitions.push('approved');
      break;
    case 'pending_approval':
      transitions.push('pending_approval');
      break;
  }

  for (const status of transitions) {
    await apiPut(`/api/modules/supplier-return/return/${returnId}/status`, { status }, headers);
  }

  // For credit_note_received, we also need to record a credit note
  if (targetStatus === 'credit_note_received') {
    await apiPost('/api/modules/supplier-return/credit-note', {
      supplierReturnId: returnId,
      creditNoteNumber: `CN-TEST-${Date.now()}`,
      amount: 100000,
      creditDate: new Date().toISOString().split('T')[0],
      notes: 'Test credit note',
    }, headers);
  }
}

test.describe('Supplier Return Module', () => {

  // ============================================================
  // C1: SMOKE TESTS
  // ============================================================

  test.describe('C1: Smoke - Returns List Page', () => {
    test('SR-001: should display returns list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);

      await expect(tenantAdminPage.locator('h1')).toContainText('Supplier Returns');
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      await expect(tenantAdminPage.locator('th:has-text("Return Number")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("GRN Number")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Supplier")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Return Date")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('SR-001: should display New Return button', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('button:has-text("New Return")')).toBeVisible();
    });

    test('SR-001: should display status filter dropdown', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")')).toBeVisible();
    });

    test('SR-001: should display search input', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('input[placeholder*="Search"]')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - New Return Page', () => {
    test('SR-002: should navigate to new return page', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("New Return")');
      await tenantAdminPage.waitForURL('**/modules/supplier-return/return/add**');
      await expect(tenantAdminPage.locator('h1')).toContainText('New Supplier Return');
    });

    test('SR-002: should display GRN selection dropdown', async ({ tenantAdminPage }) => {
      await navigateToReturnAdd(tenantAdminPage);
      await expect(tenantAdminPage.locator('label:has-text("Goods Received Note")')).toBeVisible();
      await expect(tenantAdminPage.locator('button[role="combobox"]:has-text("Select GRN")')).toBeVisible();
    });

    test('SR-002: should display return date pre-filled with today', async ({ tenantAdminPage }) => {
      await navigateToReturnAdd(tenantAdminPage);
      const today = new Date().toISOString().split('T')[0];
      const dateInput = tenantAdminPage.locator('input[type="date"]').first();
      await expect(dateInput).toHaveValue(today);
    });

    test('SR-002: should show message before GRN selection', async ({ tenantAdminPage }) => {
      await navigateToReturnAdd(tenantAdminPage);
      await expect(tenantAdminPage.locator('text=Select a GRN to see returnable items')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - Create Return and View Detail', () => {
    test('SR-003/004: should create return and view detail page', async ({ tenantAdminPage }) => {
      const { grnId, grnNumber, poNumber } = await createStockUpdatedGrnViaApi();
      const { returnId, returnNumber } = await createReturnViaApi(grnId);

      // Navigate to return detail
      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForURL(`**/modules/supplier-return/return/${returnId}**`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Verify status timeline (7 stages) - use .first() to avoid strict mode with status badge
      await expect(tenantAdminPage.locator('text=Requested').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Pending Approval').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Approved').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Dispatched').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Acknowledged').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Credit Note Received').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Closed').first()).toBeVisible();

      // Verify header info (use .first() since return number appears in breadcrumb + header)
      await expect(tenantAdminPage.locator(`text=${returnNumber}`).first()).toBeVisible();
      await expect(tenantAdminPage.locator(`text=${grnNumber}`).first()).toBeVisible();

      // Verify action buttons for requested status
      await expect(tenantAdminPage.locator('button:has-text("Submit for Approval")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Approve (Skip)")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Reject")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Verify line items table
      await expect(tenantAdminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Qty")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Reason")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE TESTS
  // ============================================================

  test.describe('C2: Full Lifecycle - Requested → Approval → Dispatch → Acknowledge → Credit Note → Close', () => {
    test('SR-005/006/007/008/009/010: should complete full return lifecycle', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId, returnNumber } = await createReturnViaApi(grnId);

      // Navigate to return detail
      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // SR-005: Requested → Pending Approval
      await tenantAdminPage.click('button:has-text("Submit for Approval")');
      await tenantAdminPage.waitForTimeout(2000);
      await expect(tenantAdminPage.locator('button:has-text("Approve")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Reject")')).toBeVisible();

      // SR-006: Pending Approval → Approved
      await tenantAdminPage.click('button:has-text("Approve")');
      await tenantAdminPage.waitForTimeout(2000);
      await expect(tenantAdminPage.locator('button:has-text("Mark Dispatched")')).toBeVisible();

      // SR-007: Approved → Dispatched
      await tenantAdminPage.click('button:has-text("Mark Dispatched")');
      await tenantAdminPage.waitForTimeout(2000);
      await expect(tenantAdminPage.locator('button:has-text("Mark Acknowledged")')).toBeVisible();

      // SR-008: Dispatched → Acknowledged
      await tenantAdminPage.click('button:has-text("Mark Acknowledged")');
      await tenantAdminPage.waitForTimeout(2000);
      await expect(tenantAdminPage.locator('button:has-text("Record Credit Note")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Close (No Credit)")')).toBeVisible();

      // SR-009: Record credit note
      await tenantAdminPage.click('button:has-text("Record Credit Note")');
      await tenantAdminPage.waitForTimeout(500);

      // Fill credit note dialog
      await expect(tenantAdminPage.locator('text=Record Credit Note').nth(1)).toBeVisible();
      await tenantAdminPage.fill('input[placeholder="Supplier\'s credit note number"]', 'CN-2026-TEST-001');
      await tenantAdminPage.fill('input[type="number"][placeholder="0.00"]', '500000');
      await tenantAdminPage.fill('textarea[placeholder="Additional details..."]', 'Credit for defective items');

      // Click Record Credit Note button in dialog
      const dialogActions = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Record Credit Note")');
      await dialogActions.click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify credit note section appears
      await expect(tenantAdminPage.locator('h3:has-text("Credit Notes")')).toBeVisible();
      await expect(tenantAdminPage.locator('text=CN-2026-TEST-001')).toBeVisible();

      // SR-010: Close return
      await tenantAdminPage.click('button:has-text("Close Return")');
      await tenantAdminPage.waitForTimeout(2000);

      // Verify terminal state
      await expect(tenantAdminPage.locator('button:has-text("Close Return")')).not.toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Record Credit Note")')).not.toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();
    });
  });

  test.describe('C2: Skip Approval', () => {
    test('SR-011: should transition requested → approved directly', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click Approve (Skip)
      await tenantAdminPage.click('button:has-text("Approve (Skip)")');
      await tenantAdminPage.waitForTimeout(2000);

      // Should go directly to approved
      await expect(tenantAdminPage.locator('button:has-text("Mark Dispatched")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Submit for Approval")')).not.toBeVisible();
    });
  });

  test.describe('C2: Reject Return', () => {
    test('SR-012: should reject return with reason', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click Reject
      await tenantAdminPage.click('button:has-text("Reject")');
      await tenantAdminPage.waitForTimeout(500);

      // Fill rejection dialog
      await expect(tenantAdminPage.locator('text=Reject Supplier Return')).toBeVisible();
      await tenantAdminPage.fill('textarea[placeholder="Reason for rejection..."]', 'Items not eligible for return');

      // Click Reject in dialog
      const rejectButton = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Reject")');
      await rejectButton.click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify rejected state
      await expect(tenantAdminPage.locator('text=Return Rejected')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Items not eligible for return')).toBeVisible();
      // No more action buttons
      await expect(tenantAdminPage.locator('button:has-text("Submit for Approval")')).not.toBeVisible();
    });
  });

  test.describe('C2: Status Filter', () => {
    test('SR-013: should filter returns by status', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Click status filter
      const statusTrigger = tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await statusTrigger.click();
      await tenantAdminPage.waitForTimeout(300);

      // Select Requested
      await tenantAdminPage.locator('[role="option"]:has-text("Requested")').click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify URL updated
      await expect(tenantAdminPage).toHaveURL(/status=requested/);
    });
  });

  test.describe('C2: Search', () => {
    test('SR-014: should search returns by number', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('SR-');
      await tenantAdminPage.waitForTimeout(1000);

      // Verify URL has filter
      await expect(tenantAdminPage).toHaveURL(/filter=SR-/);
    });
  });

  test.describe('C2: Download PDF', () => {
    test('SR-015: should download return PDF without error', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click download PDF
      const downloadPromise = tenantAdminPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await tenantAdminPage.click('button:has-text("Download PDF")');
      await tenantAdminPage.waitForTimeout(2000);

      // Verify no error toast
      const errorToast = tenantAdminPage.locator('text=Failed to generate PDF');
      await expect(errorToast).not.toBeVisible();
    });
  });

  test.describe('C2: Credit Notes List', () => {
    test('SR-016: should display credit notes list page', async ({ tenantAdminPage }) => {
      await navigateToCreditNoteList(tenantAdminPage);

      await expect(tenantAdminPage.locator('h1')).toContainText('Credit Notes');
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      await expect(tenantAdminPage.locator('th:has-text("Credit Note #")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Return #")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Supplier")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Amount")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Date")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Type")')).toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Return Number Format', () => {
    test('SR-017: should generate return number in SR-YYYYMM-NNNN format', async () => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnNumber } = await createReturnViaApi(grnId);

      const now = new Date();
      const expectedPrefix = `SR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      expect(returnNumber).toMatch(new RegExp(`^SR-\\d{6}-\\d{4}$`));
      expect(returnNumber.startsWith(expectedPrefix)).toBeTruthy();
    });
  });

  test.describe('C3: GRN Link from Return Detail', () => {
    test('SR-020: should navigate to GRN detail from return view', async ({ tenantAdminPage }) => {
      const { grnId, grnNumber } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click GRN link
      const grnLink = tenantAdminPage.locator(`a:has-text("${grnNumber}")`);
      await expect(grnLink).toBeVisible();
      await grnLink.click();
      await tenantAdminPage.waitForURL(`**/modules/grn/grn/${grnId}**`);

      // Should be on GRN detail page
      await expect(tenantAdminPage.locator(`text=${grnNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: PO Link from Return Detail', () => {
    test('SR-021: should navigate to PO detail from return view', async ({ tenantAdminPage }) => {
      const { poId, poNumber, grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click PO link
      const poLink = tenantAdminPage.locator(`a:has-text("${poNumber}")`);
      await expect(poLink).toBeVisible();
      await poLink.click();
      await tenantAdminPage.waitForURL(`**/modules/purchase-order/po/${poId}**`);

      await expect(tenantAdminPage.locator(`text=${poNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: Replacement Receipt', () => {
    test('SR-022: should record replacement receipt credit note', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      // Transition to acknowledged via API
      await transitionReturnTo(returnId, 'acknowledged');

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Record credit note with replacement checked
      await tenantAdminPage.click('button:has-text("Record Credit Note")');
      await tenantAdminPage.waitForTimeout(500);

      await tenantAdminPage.fill('input[placeholder="Supplier\'s credit note number"]', 'REPL-2026-001');
      await tenantAdminPage.fill('input[type="number"][placeholder="0.00"]', '250000');

      // Check replacement checkbox
      await tenantAdminPage.check('#isReplacement');

      // Click Record Credit Note in dialog
      const dialogAction = tenantAdminPage.locator('[role="alertdialog"] button:has-text("Record Credit Note")');
      await dialogAction.click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify replacement badge
      await expect(tenantAdminPage.locator('text=Replacement')).toBeVisible();
    });
  });

  test.describe('C3: Close Without Credit Note', () => {
    test('SR-023: should close return without credit note from acknowledged', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      // Transition to acknowledged via API
      await transitionReturnTo(returnId, 'acknowledged');

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click Close (No Credit)
      await tenantAdminPage.click('button:has-text("Close (No Credit)")');
      await tenantAdminPage.waitForTimeout(2000);

      // Verify closed - no action buttons
      await expect(tenantAdminPage.locator('button:has-text("Close")')).not.toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();
    });
  });

  test.describe('C3: Breadcrumbs and Cancel Navigation', () => {
    test('SR-024: should navigate back via Cancel on add page', async ({ tenantAdminPage }) => {
      await navigateToReturnAdd(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Cancel")');
      await tenantAdminPage.waitForURL('**/modules/supplier-return/return**');
    });

    test('SR-024: should display breadcrumbs on view page', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId, returnNumber } = await createReturnViaApi(grnId);

      await tenantAdminPage.goto(`/console/modules/supplier-return/return/${returnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('[data-slot="breadcrumb-page"], nav[aria-label="breadcrumb"]').locator(`text=${returnNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: Sort Columns', () => {
    test('SR-025: should sort by Return Number', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.click('button:has-text("Return Number")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=returnNumber/);
    });

    test('SR-025: should sort by Return Date', async ({ tenantAdminPage }) => {
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.click('button:has-text("Return Date")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=returnDate/);
    });
  });

  test.describe('C3: Credit Note in List', () => {
    test('SR-026: should show credit note in credit notes list after recording', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnId } = await createReturnViaApi(grnId);

      // Transition to acknowledged and record credit note via API
      await transitionReturnTo(returnId, 'acknowledged');
      const headers = await getAuthHeaders();
      const cnNumber = `CN-LIST-TEST-${Date.now()}`;
      await apiPost('/api/modules/supplier-return/credit-note', {
        supplierReturnId: returnId,
        creditNoteNumber: cnNumber,
        amount: 750000,
        creditDate: new Date().toISOString().split('T')[0],
        notes: 'Test for list verification',
      }, headers);

      // Navigate to credit notes list
      await navigateToCreditNoteList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Verify credit note appears
      await expect(tenantAdminPage.locator(`text=${cnNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: Return Appears in List', () => {
    test('should show newly created return in list', async ({ tenantAdminPage }) => {
      const { grnId } = await createStockUpdatedGrnViaApi();
      const { returnNumber } = await createReturnViaApi(grnId);

      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(2000);

      // Verify return appears (use longer timeout since list may still be loading)
      await expect(tenantAdminPage.locator(`td:has-text("${returnNumber}")`)).toBeVisible({ timeout: 10000 });

      // Verify Requested status badge
      const row = tenantAdminPage.locator(`tr:has-text("${returnNumber}")`);
      await expect(row.locator('text=Requested')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load returns list within acceptable time', async ({ tenantAdminPage }) => {
      const start = Date.now();
      await navigateToReturnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
    });
  });
});
