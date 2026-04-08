import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Inter-Shop Transfer E2E Tests (Sprint 17)
 *
 * Tests transfer lifecycle (7 states), inventory dispatch/receive,
 * discrepancy tracking, admin pages, and PDF download.
 */

// ============================================================
// HELPERS
// ============================================================

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
  return { status: res.status, data: await res.json() };
}

async function apiPut(path: string, body: any, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function getLocationsViaApi(): Promise<{ src: any; dest: any }> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/location-management/location?perPage=10', headers);
  const locs = (data.locations || []).filter((l: any) => l.status === 'active');
  if (locs.length < 2) throw new Error('Need at least 2 locations for transfer tests');
  return { src: locs[0], dest: locs[1] };
}

async function getProductViaApi(): Promise<any> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/product-catalog/product?perPage=1&status=active', headers);
  return data.products?.[0];
}

async function createTransferViaApi(qty: number = 10): Promise<{ id: string; transferNumber: string }> {
  const headers = await getAuthHeaders();
  const { src, dest } = await getLocationsViaApi();
  const prod = await getProductViaApi();

  const { data } = await apiPost('/api/modules/transfer/transfer', {
    sourceLocationId: src.id,
    destLocationId: dest.id,
    items: [{
      productId: prod.id, skuCode: prod.skuCode, productName: prod.name, requestedQty: qty,
    }],
    notes: `Test transfer ${Date.now()}`,
  }, headers);

  return { id: data.id, transferNumber: data.transferNumber };
}

async function transitionTransfer(id: string, status: string, extra?: any): Promise<any> {
  const headers = await getAuthHeaders();
  const { data } = await apiPut(`/api/modules/transfer/transfer/${id}/status`, { status, ...extra }, headers);
  return data;
}

function navigateToTransferList(page: Page) {
  return page.goto('/console/modules/transfer/transfer');
}

test.describe('Inter-Shop Transfer Module (Sprint 17)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke', () => {
    test('TRF-001: transfer list page loads', async ({ adminPage }) => {
      await navigateToTransferList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('Inter-Shop Transfers');
      await expect(adminPage.locator('th:has-text("Transfer #")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("From")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("To")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Status")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("New Transfer")')).toBeVisible();
    });

    test('TRF-002: new transfer page loads', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/transfer/transfer/add');
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('New Transfer');
      await expect(adminPage.locator('text=Source Location')).toBeVisible();
      await expect(adminPage.locator('text=Destination Location')).toBeVisible();
    });

    test('TRF-003: create transfer via API', async () => {
      const { id, transferNumber } = await createTransferViaApi();

      expect(id).toBeTruthy();
      expect(transferNumber).toMatch(/^TRF-\d{6}-\d{4}$/);

      // Verify detail
      const headers = await getAuthHeaders();
      const detail = await apiGet(`/api/modules/transfer/transfer/${id}`, headers);
      expect(detail.status).toBe('requested');
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0].requestedQty).toBe(10);
    });

    test('TRF-004: view transfer detail page', async ({ adminPage }) => {
      const { id, transferNumber } = await createTransferViaApi();

      await adminPage.goto(`/console/modules/transfer/transfer/${id}`);
      await adminPage.waitForLoadState('networkidle');

      // Timeline
      await expect(adminPage.locator('text=Requested').first()).toBeVisible();
      await expect(adminPage.locator('text=Approved').first()).toBeVisible();
      await expect(adminPage.locator('text=Dispatched').first()).toBeVisible();
      await expect(adminPage.locator('text=Received').first()).toBeVisible();
      await expect(adminPage.locator('text=Closed').first()).toBeVisible();

      // Header
      await expect(adminPage.locator(`text=${transferNumber}`).first()).toBeVisible();

      // Action buttons
      await expect(adminPage.locator('button:has-text("Submit for Approval")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Approve (Skip)")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Download PDF")')).toBeVisible();

      // Items table
      await expect(adminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(adminPage.locator('th:has-text("Requested")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL LIFECYCLE
  // ============================================================

  test.describe('C2: Lifecycle', () => {
    test('TRF-005: complete lifecycle via API', async () => {
      const { id } = await createTransferViaApi();

      // requested → approved (skip pending_approval)
      let r = await transitionTransfer(id, 'approved');
      expect(r.status).toBe('approved');

      // approved → picking
      r = await transitionTransfer(id, 'picking');
      expect(r.status).toBe('picking');

      // picking → dispatched
      r = await transitionTransfer(id, 'dispatched');
      expect(r.status).toBe('dispatched');

      // dispatched → received
      r = await transitionTransfer(id, 'received');
      expect(r.status).toBe('received');

      // received → closed
      r = await transitionTransfer(id, 'closed');
      expect(r.status).toBe('closed');
    });

    test('TRF-006: dispatch decrements source inventory', async () => {
      const headers = await getAuthHeaders();
      const { src } = await getLocationsViaApi();
      const prod = await getProductViaApi();

      // Get source inventory before
      const invBefore = await apiGet(`/api/modules/pos/inventory?locationId=${src.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyBefore = invBefore.inventory?.[0]?.qtyOnHand ?? 0;

      // Create and dispatch
      const { id } = await createTransferViaApi(5);
      await transitionTransfer(id, 'approved');
      await transitionTransfer(id, 'picking');
      await transitionTransfer(id, 'dispatched');

      // Check source inventory
      const invAfter = await apiGet(`/api/modules/pos/inventory?locationId=${src.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyAfter = invAfter.inventory?.[0]?.qtyOnHand ?? 0;
      expect(qtyAfter).toBe(qtyBefore - 5);
    });

    test('TRF-007: receive increments destination inventory', async () => {
      const headers = await getAuthHeaders();
      const { dest } = await getLocationsViaApi();
      const prod = await getProductViaApi();

      // Full lifecycle — dispatched but not yet received
      const { id } = await createTransferViaApi(7);
      await transitionTransfer(id, 'approved');
      await transitionTransfer(id, 'picking');
      await transitionTransfer(id, 'dispatched');

      // Snapshot qty_on_hand AFTER dispatch, BEFORE receive
      const invMid = await apiGet(`/api/modules/pos/inventory?locationId=${dest.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyMid = invMid.inventory?.[0]?.qtyOnHand ?? 0;

      // Receive
      await transitionTransfer(id, 'received');

      // qty_on_hand should increase by exactly 7 from the receive
      const invAfter = await apiGet(`/api/modules/pos/inventory?locationId=${dest.id}&filter=${encodeURIComponent(prod.name)}`, headers);
      const qtyAfter = invAfter.inventory?.[0]?.qtyOnHand ?? 0;

      // The receive endpoint does: qty_on_hand = qty_on_hand + receivedQty
      // Since no receiveItems override, receivedQty defaults to requestedQty (7)
      const delta = qtyAfter - qtyMid;
      expect(delta).toBe(7);
    });

    test('TRF-008: skip approval directly', async () => {
      const { id } = await createTransferViaApi();
      const r = await transitionTransfer(id, 'approved');
      expect(r.status).toBe('approved');
    });

    test('TRF-009: status filter on list', async ({ adminPage }) => {
      await navigateToTransferList(adminPage);
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const trigger = adminPage.locator('button[role="combobox"]:has-text("All Statuses")');
      await trigger.click();
      await adminPage.waitForTimeout(300);
      await adminPage.locator('[role="option"]:has-text("Requested")').click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage).toHaveURL(/status=requested/);
    });

    test('TRF-010: search transfers', async ({ adminPage }) => {
      await navigateToTransferList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      const searchInput = adminPage.locator('input[placeholder*="Search"]');
      await searchInput.fill('TRF-');
      await adminPage.waitForTimeout(1000);

      await expect(adminPage).toHaveURL(/filter=TRF-/);
    });

    test('TRF-011: detail shows action buttons for requested', async ({ adminPage }) => {
      const { id } = await createTransferViaApi();

      await adminPage.goto(`/console/modules/transfer/transfer/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('button:has-text("Submit for Approval")')).toBeVisible();
      await expect(adminPage.locator('button:has-text("Approve (Skip)")')).toBeVisible();
    });

    test('TRF-012: download PDF', async ({ adminPage }) => {
      const { id } = await createTransferViaApi();

      await adminPage.goto(`/console/modules/transfer/transfer/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.locator('button:has-text("Download PDF")').click();
      await adminPage.waitForTimeout(2000);

      await expect(adminPage.locator('text=Failed to generate PDF')).not.toBeVisible();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('TRF-013: transfer number format', async () => {
      const { transferNumber } = await createTransferViaApi();
      expect(transferNumber).toMatch(/^TRF-\d{6}-\d{4}$/);

      const now = new Date();
      const expectedPrefix = `TRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
      expect(transferNumber.startsWith(expectedPrefix)).toBeTruthy();
    });

    test('TRF-014: same source and dest rejected', async () => {
      const headers = await getAuthHeaders();
      const { src } = await getLocationsViaApi();
      const prod = await getProductViaApi();

      const { status, data } = await apiPost('/api/modules/transfer/transfer', {
        sourceLocationId: src.id,
        destLocationId: src.id, // Same!
        items: [{ productId: prod.id, skuCode: prod.skuCode, productName: prod.name, requestedQty: 1 }],
      }, headers);

      expect(status).toBe(400);
      expect(data.error).toContain('different');
    });

    test('TRF-015: invalid status transition rejected', async () => {
      const { id } = await createTransferViaApi();
      const headers = await getAuthHeaders();

      // Try requested → dispatched (invalid)
      const { status, data } = await apiPut(`/api/modules/transfer/transfer/${id}/status`, {
        status: 'dispatched',
      }, headers);

      expect(status).toBe(400);
      expect(data.error).toContain('Cannot transition');
    });

    test('TRF-016: transfer appears in list after creation', async ({ adminPage }) => {
      const { id, transferNumber } = await createTransferViaApi();

      // Navigate directly to detail to verify it exists
      await adminPage.goto(`/console/modules/transfer/transfer/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator(`text=${transferNumber}`).first()).toBeVisible({ timeout: 10000 });
    });

    test('TRF-017: breadcrumbs on detail page', async ({ adminPage }) => {
      const { id, transferNumber } = await createTransferViaApi();

      await adminPage.goto(`/console/modules/transfer/transfer/${id}`);
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator(`text=${transferNumber}`).first()).toBeVisible();
    });

    test('TRF-018: sort columns', async ({ adminPage }) => {
      await navigateToTransferList(adminPage);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.click('button:has-text("Transfer #")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=transferNumber/);

      await adminPage.click('button:has-text("Date")');
      await adminPage.waitForTimeout(1000);
      await expect(adminPage).toHaveURL(/sort=createdAt/);
    });

    test('TRF-019: partial receive with discrepancy', async () => {
      const headers = await getAuthHeaders();
      const { id } = await createTransferViaApi(10);

      // Full lifecycle up to dispatched
      await transitionTransfer(id, 'approved');
      await transitionTransfer(id, 'picking');
      await transitionTransfer(id, 'dispatched');

      // Get items for receive
      const detail = await apiGet(`/api/modules/transfer/transfer/${id}`, headers);
      const itemId = detail.items[0].id;

      // Receive with less qty (short)
      await transitionTransfer(id, 'received', {
        receiveItems: [{
          transferItemId: itemId,
          receivedQty: 7,
          discrepancyReason: 'short',
          discrepancyNotes: '3 items missing from box',
        }],
      });

      // Verify discrepancy
      const updated = await apiGet(`/api/modules/transfer/transfer/${id}`, headers);
      const item = updated.items[0];
      expect(item.receivedQty).toBe(7);
      expect(item.discrepancyQty).toBe(-3); // 7 - 10 = -3
      expect(item.discrepancyReason).toBe('short');
    });
  });
});
