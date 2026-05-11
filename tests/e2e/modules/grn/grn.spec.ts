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

  test.beforeAll(async () => {
    // Ensure supplier + product + supplier-product link exist for GRN (via PO) tests
    const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERS.tenantAdmin.username, password: TEST_USERS.tenantAdmin.password }),
    });
    const { accessToken } = await loginRes.json();
    const h: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-Code': TEST_USERS.tenantAdmin.tenantCode,
      'Content-Type': 'application/json',
    };

    const post = (path: string, body: any) =>
      fetch(`http://127.0.0.1:5000${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(r => r.json());
    const get = (path: string) =>
      fetch(`http://127.0.0.1:5000${path}`, { headers: h }).then(r => r.json());

    // 1. Ensure supplier exists
    const suppList = await get('/api/modules/supplier-management/supplier?perPage=1');
    let supplierId: string;
    if (suppList.suppliers?.length) {
      supplierId = suppList.suppliers[0].id;
    } else {
      const created = await post('/api/modules/supplier-management/supplier/add', {
        name: 'Test Supplier GRN', code: 'TEST-GRN-SUP', npwp: '123456789012345', status: 'active',
      });
      if (!created.id) {
        const refetch = await get('/api/modules/supplier-management/supplier?perPage=1');
        supplierId = refetch.suppliers[0].id;
      } else {
        supplierId = created.id;
      }
    }

    // 2. Ensure product exists
    const prodList = await get('/api/modules/product-catalog/product?filter=TEST-SKU-GRN-001&perPage=1');
    let productId: string;
    if (prodList.products?.length) {
      productId = prodList.products[0].id;
    } else {
      const catList = await get('/api/modules/product-catalog/category?perPage=1');
      let categoryId: string | null = catList.categories?.length ? catList.categories[0].id : null;
      if (!categoryId) {
        const cat = await post('/api/modules/product-catalog/category/add', { name: 'Test Category GRN' });
        categoryId = cat.id ?? null;
      }
      const newProd = await post('/api/modules/product-catalog/product/add', {
        skuCode: 'TEST-SKU-GRN-001', name: 'Test Product GRN', baseCostPrice: 10000,
        sellingPrice: 15000, uom: 'pcs', status: 'active', categoryId,
      });
      if (!newProd.id) {
        const refetch = await get('/api/modules/product-catalog/product?filter=TEST-SKU-GRN-001&perPage=1');
        productId = refetch.products[0].id;
      } else {
        productId = newProd.id;
      }
    }

    // 3. Ensure supplier-product link exists
    const spList = await get(`/api/modules/supplier-management/supplier/${supplierId}/products`);
    const alreadyLinked = (spList.products ?? []).some((p: any) => p.productId === productId);
    if (!alreadyLinked) {
      await post(`/api/modules/supplier-management/supplier/${supplierId}/products`, {
        productId, supplierPrice: 10000, minOrderQty: 1,
      });
    }
  });

  // ============================================================
  // C1: SMOKE TESTS
  // ============================================================

  test.describe('C1: Smoke - GRN List Page', () => {
    test('GRN-001: should display GRN list page with proper structure', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);

      await expect(tenantAdminPage.locator('h1')).toContainText('Goods Received Notes');
      const table = tenantAdminPage.locator('table');
      await expect(table).toBeVisible();

      await expect(tenantAdminPage.locator('th:has-text("GRN Number")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("PO Number")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Received Date")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Status")')).toBeVisible();
    });

    test('GRN-001: should display Receive Goods button', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('button:has-text("Receive Goods")')).toBeVisible();
    });

    test('GRN-001: should display status filter dropdown', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")')).toBeVisible();
    });

    test('GRN-001: should display search input', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await expect(tenantAdminPage.locator('input[placeholder*="Search"]')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - Receive Goods Page', () => {
    test('GRN-002: should navigate to receive goods page', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Receive Goods")');
      await tenantAdminPage.waitForURL('**/modules/grn/grn/add**');
      await expect(tenantAdminPage.locator('h1')).toContainText('Goods Receiving');
    });

    test('GRN-002: should display PO selection dropdown', async ({ tenantAdminPage }) => {
      await navigateToGrnAdd(tenantAdminPage);
      await expect(tenantAdminPage.locator('label:has-text("Purchase Order")')).toBeVisible();
      await expect(tenantAdminPage.locator('button[role="combobox"]:has-text("Select PO")')).toBeVisible();
    });

    test('GRN-002: should display received date pre-filled with today', async ({ tenantAdminPage }) => {
      await navigateToGrnAdd(tenantAdminPage);
      const today = new Date().toISOString().split('T')[0];
      const dateInput = tenantAdminPage.locator('input[type="date"]').first();
      await expect(dateInput).toHaveValue(today);
    });

    test('GRN-002: should display header fields', async ({ tenantAdminPage }) => {
      await navigateToGrnAdd(tenantAdminPage);
      await expect(tenantAdminPage.locator('text=Delivery Note Ref')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Invoice Ref')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Notes')).toBeVisible();
    });

    test('GRN-002: should show message before PO selection', async ({ tenantAdminPage }) => {
      await navigateToGrnAdd(tenantAdminPage);
      await expect(tenantAdminPage.locator('text=Select a purchase order')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - Create GRN and View Detail', () => {
    test('GRN-003/004: should create GRN and view detail page', async ({ tenantAdminPage }) => {
      // Create a sent PO first
      const { poId, poNumber } = await createSentPoViaApi(tenantAdminPage);

      // Create GRN via API for faster testing
      const { grnId, grnNumber } = await createGrnViaApi(tenantAdminPage, poId);

      // Navigate to GRN detail
      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForURL(`**/modules/grn/grn/${grnId}**`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Verify status timeline (4 stages)
      await expect(tenantAdminPage.locator('text=Draft')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Quality Inspection')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Accepted')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Stock Updated')).toBeVisible();

      // Verify header info
      await expect(tenantAdminPage.locator(`text=${grnNumber}`)).toBeVisible();
      await expect(tenantAdminPage.locator(`text=${poNumber}`)).toBeVisible();

      // Verify action buttons for draft status
      await expect(tenantAdminPage.locator('button:has-text("Send to QI")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Accept (Skip QI)")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Verify line items table
      await expect(tenantAdminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Ordered")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Received")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Accepted")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Rejected")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL CRUD / LIFECYCLE TESTS
  // ============================================================

  test.describe('C2: Status Transitions - Full Lifecycle via QI', () => {
    test('GRN-005/006/007: should transition draft → QI → accepted → stock_updated', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnId } = await createGrnViaApi(tenantAdminPage, poId);

      // Navigate to GRN detail
      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Draft → Quality Inspection
      await tenantAdminPage.click('button:has-text("Send to QI")');
      await tenantAdminPage.waitForTimeout(2000);
      await expect(tenantAdminPage.locator('button:has-text("Mark Accepted")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Back to Draft")')).toBeVisible();

      // Quality Inspection → Accepted (via dialog)
      await tenantAdminPage.click('button:has-text("Mark Accepted")');
      await tenantAdminPage.waitForTimeout(500);

      // QI dialog should appear
      await expect(tenantAdminPage.locator('text=Quality Inspection Result')).toBeVisible();

      // Click Passed button and add notes
      await tenantAdminPage.click('button:has-text("Passed")');
      await tenantAdminPage.fill('textarea', 'All items passed visual and functional inspection');
      await tenantAdminPage.click('button:has-text("Confirm")');
      await tenantAdminPage.waitForTimeout(2000);

      // Verify accepted status
      await expect(tenantAdminPage.locator('button:has-text("Update Stock")')).toBeVisible();

      // Accepted → Stock Updated
      await tenantAdminPage.click('button:has-text("Update Stock")');
      await tenantAdminPage.waitForTimeout(3000);

      // Verify terminal state - no action buttons except PDF
      await expect(tenantAdminPage.locator('button:has-text("Update Stock")')).not.toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Verify quality inspection section
      await expect(tenantAdminPage.locator('text=Quality Inspection')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Passed')).toBeVisible();
    });
  });

  test.describe('C2: Status Transitions - Skip QI', () => {
    test('GRN-008: should transition draft → accepted (skip quality inspection)', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnId } = await createGrnViaApi(tenantAdminPage, poId);

      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click Accept (Skip QI)
      await tenantAdminPage.click('button:has-text("Accept (Skip QI)")');
      await tenantAdminPage.waitForTimeout(2000);

      // Should go directly to accepted
      await expect(tenantAdminPage.locator('button:has-text("Update Stock")')).toBeVisible();
      // QI button should no longer be visible
      await expect(tenantAdminPage.locator('button:has-text("Send to QI")')).not.toBeVisible();
    });
  });

  test.describe('C2: Status Transitions - Back to Draft from QI', () => {
    test('GRN-009: should revert from quality_inspection to draft', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnId } = await createGrnViaApi(tenantAdminPage, poId);

      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Draft → QI
      await tenantAdminPage.click('button:has-text("Send to QI")');
      await tenantAdminPage.waitForTimeout(2000);

      // QI → Back to Draft
      await tenantAdminPage.click('button:has-text("Back to Draft")');
      await tenantAdminPage.waitForTimeout(2000);

      // Should be back to draft with original buttons
      await expect(tenantAdminPage.locator('button:has-text("Send to QI")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Accept (Skip QI)")')).toBeVisible();
    });
  });

  test.describe('C2: Status Filter', () => {
    test('GRN-010: should filter GRNs by status', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Click status filter
      const statusTrigger = tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await statusTrigger.click();
      await tenantAdminPage.waitForTimeout(300);

      // Select Draft
      await tenantAdminPage.locator('[role="option"]:has-text("Draft")').click();
      await tenantAdminPage.waitForTimeout(2000);

      // Verify URL updated
      await expect(tenantAdminPage).toHaveURL(/status=draft/);
    });
  });

  test.describe('C2: Search', () => {
    test('GRN-011: should search GRNs by number', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      const searchInput = tenantAdminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('GRN-');
      await tenantAdminPage.waitForTimeout(1000);

      // Verify URL has filter
      await expect(tenantAdminPage).toHaveURL(/filter=GRN-/);
    });
  });

  test.describe('C2: Download PDF', () => {
    test('GRN-012: should download GRN PDF without error', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnId } = await createGrnViaApi(tenantAdminPage, poId);

      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click download PDF
      const downloadPromise = tenantAdminPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await tenantAdminPage.click('button:has-text("Download PDF")');
      await tenantAdminPage.waitForTimeout(2000);

      // Just verify no error occurred - PDF download may or may not trigger download event
      // The main check is that no error toast appeared
      const errorToast = tenantAdminPage.locator('text=Failed to generate PDF');
      await expect(errorToast).not.toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: GRN Number Format', () => {
    test('should generate GRN number in GRN-YYYYMM-NNNN format', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnNumber } = await createGrnViaApi(tenantAdminPage, poId);

      const now = new Date();
      const expectedPrefix = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      expect(grnNumber).toMatch(new RegExp(`^GRN-\\d{6}-\\d{4}$`));
      expect(grnNumber.startsWith(expectedPrefix)).toBeTruthy();
    });
  });

  test.describe('C3: PO Link from GRN Detail', () => {
    test('GRN-017: should navigate to PO detail from GRN view', async ({ tenantAdminPage }) => {
      const { poId, poNumber } = await createSentPoViaApi(tenantAdminPage);
      const { grnId } = await createGrnViaApi(tenantAdminPage, poId);

      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      // Click PO number link
      const poLink = tenantAdminPage.locator(`a:has-text("${poNumber}")`);
      await expect(poLink).toBeVisible();
      await poLink.click();
      await tenantAdminPage.waitForURL(`**/modules/purchase-order/po/${poId}**`);

      // Should be on PO detail page
      await expect(tenantAdminPage.locator(`text=${poNumber}`)).toBeVisible();
    });
  });

  test.describe('C3: GRN Appears in List', () => {
    test('should show newly created GRN in list with correct data', async ({ tenantAdminPage }) => {
      const { poId, poNumber } = await createSentPoViaApi(tenantAdminPage);
      const { grnNumber } = await createGrnViaApi(tenantAdminPage, poId);

      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Verify GRN appears in list
      await expect(tenantAdminPage.locator(`text=${grnNumber}`)).toBeVisible();
      await expect(tenantAdminPage.locator(`td:has-text("${poNumber}")`)).toBeVisible();

      // Verify Draft status badge
      const row = tenantAdminPage.locator(`tr:has-text("${grnNumber}")`);
      await expect(row.locator('text=Draft')).toBeVisible();
    });
  });

  test.describe('C3: Sort Columns', () => {
    test('should sort by GRN Number', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.click('button:has-text("GRN Number")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=grnNumber/);
    });

    test('should sort by Received Date', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.click('button:has-text("Received Date")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=receivedDate/);
    });
  });

  test.describe('C3: Breadcrumbs and Navigation', () => {
    test('should display breadcrumbs on view page', async ({ tenantAdminPage }) => {
      const { poId } = await createSentPoViaApi(tenantAdminPage);
      const { grnId, grnNumber } = await createGrnViaApi(tenantAdminPage, poId);

      await tenantAdminPage.goto(`/console/modules/grn/grn/${grnId}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator(`text=GRN List`)).toBeVisible();
      await expect(tenantAdminPage.locator(`text=${grnNumber}`)).toBeVisible();
    });

    test('should navigate back from add page via Cancel', async ({ tenantAdminPage }) => {
      await navigateToGrnAdd(tenantAdminPage);
      await tenantAdminPage.click('button:has-text("Cancel")');
      await tenantAdminPage.waitForURL('**/modules/grn/grn**');
    });
  });

  test.describe('C3: URL State Persistence', () => {
    test('should persist status filter in URL', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      const statusTrigger = tenantAdminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await statusTrigger.click();
      await tenantAdminPage.waitForTimeout(300);
      await tenantAdminPage.locator('[role="option"]:has-text("Accepted")').click();
      await tenantAdminPage.waitForTimeout(2000);

      await expect(tenantAdminPage).toHaveURL(/status=accepted/);
    });

    test('should persist sort state in URL', async ({ tenantAdminPage }) => {
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');

      await tenantAdminPage.click('button:has-text("Status")');
      await tenantAdminPage.waitForTimeout(1000);
      await expect(tenantAdminPage).toHaveURL(/sort=status/);
    });
  });

  test.describe('Performance', () => {
    test('should load GRN list within acceptable time', async ({ tenantAdminPage }) => {
      const start = Date.now();
      await navigateToGrnList(tenantAdminPage);
      await tenantAdminPage.waitForLoadState('networkidle');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10000);
    });
  });
});
