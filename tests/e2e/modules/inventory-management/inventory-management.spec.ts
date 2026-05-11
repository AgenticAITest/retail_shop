import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Inventory Management E2E Tests (Sprint 18)
 *
 * Tests stock counts, manual adjustments, movement ledger,
 * and low-stock alert configuration.
 */

// ============================================================
// HELPERS
// ============================================================

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
  return { status: res.status, data: await res.json() };
}

async function apiPut(path: string, body: any, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function getLocationId(): Promise<string> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/location-management/location?perPage=1', headers);
  return data.locations[0].id;
}

async function getProduct(): Promise<any> {
  const headers = await getAuthHeaders();
  const data = await apiGet('/api/modules/product-catalog/product?perPage=1&status=active', headers);
  return data.products[0];
}

async function createStockCount(): Promise<{ id: string; lines: any[] }> {
  const headers = await getAuthHeaders();
  const locId = await getLocationId();
  const { data } = await apiPost('/api/modules/inventory-management/stock-count', { locationId: locId }, headers);
  return { id: data.id, lines: data.lines || [] };
}

test.describe('Inventory Management (Sprint 18)', () => {

  // ============================================================
  // C1: SMOKE - UI PAGES
  // ============================================================

  test.describe('C1: Smoke - Pages', () => {
    test('INV-001: stock count list page', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/stock-count');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Stock Counts');
      await expect(tenantAdminPage.locator('button:has-text("New Count")')).toBeVisible();
    });

    test('INV-002: adjustment list page', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/adjustment');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Stock Adjustments');
      await expect(tenantAdminPage.locator('button:has-text("New Adjustment")')).toBeVisible();
    });

    test('INV-003: movement ledger page', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/movement');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Movement Ledger');
      // Type filter
      await expect(tenantAdminPage.locator('button[role="combobox"]').first()).toBeVisible();
    });

    test('INV-004: alert config page', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/alerts');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Low-Stock Alerts');
      await expect(tenantAdminPage.locator('button:has-text("Add Alert Rule")')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL LIFECYCLE
  // ============================================================

  test.describe('C2: Stock Counts', () => {
    test('INV-005: create stock count', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();

      const { status, data } = await apiPost('/api/modules/inventory-management/stock-count', {
        locationId: locId,
      }, headers);

      expect(status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('in_progress');
      expect(data.lines.length).toBeGreaterThan(0);
      // Lines should have systemQty
      expect(data.lines[0].skuCode).toBeTruthy();
      expect(data.lines[0].systemQty).toBeDefined();
    });

    test('INV-006: record count lines', async () => {
      const headers = await getAuthHeaders();
      const { id, lines } = await createStockCount();
      expect(lines.length).toBeGreaterThan(0);

      const line = lines[0];
      const countedQty = (parseInt(String(line.systemQty)) || 0) + 3;

      const { status, data } = await apiPut(`/api/modules/inventory-management/stock-count/${id}/lines`, {
        lines: [{ productId: line.productId, skuCode: line.skuCode, productName: line.productName, countedQty }],
      }, headers);

      expect(status).toBe(200);

      // Verify
      const detail = await apiGet(`/api/modules/inventory-management/stock-count/${id}`, headers);
      const updated = detail.lines.find((l: any) => l.productId === line.productId);
      expect(updated.countedQty).toBe(countedQty);
    });

    test('INV-007: finalize stock count', async () => {
      const headers = await getAuthHeaders();
      const { id, lines } = await createStockCount();

      // Record counts with variance
      const linesToUpdate = lines.slice(0, 1).map((l: any) => ({
        productId: l.productId, skuCode: l.skuCode, productName: l.productName,
        countedQty: l.systemQty + 7,
      }));
      await apiPut(`/api/modules/inventory-management/stock-count/${id}/lines`, { lines: linesToUpdate }, headers);

      // Finalize
      const { status, data } = await apiPost(`/api/modules/inventory-management/stock-count/${id}/finalize`, {}, headers);
      expect(status).toBe(200);
      expect(data.message).toContain('finalized');

      // Verify status
      const detail = await apiGet(`/api/modules/inventory-management/stock-count/${id}`, headers);
      expect(detail.status).toBe('finalized');
    });

    test('INV-008: stock count detail', async () => {
      const headers = await getAuthHeaders();
      const { id } = await createStockCount();

      const detail = await apiGet(`/api/modules/inventory-management/stock-count/${id}`, headers);

      expect(detail.id).toBe(id);
      expect(detail.location).toBeTruthy();
      expect(detail.startedByUser).toBeTruthy();
      expect(detail.lines).toBeDefined();
      expect(detail.lines.length).toBeGreaterThan(0);
    });
  });

  test.describe('C2: Adjustments', () => {
    test('INV-009: create manual adjustment', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      // Get inventory before
      const invBefore = await apiGet(`/api/modules/pos/inventory?locationId=${locId}`, headers);
      const qtyBefore = invBefore.inventory?.find((i: any) => i.productId === prod.id)?.qtyOnHand ?? 0;

      const { status, data } = await apiPost('/api/modules/inventory-management/adjustment', {
        locationId: locId, productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
        qty: -5, reasonCode: 'damage', notes: 'Test damage adjustment',
      }, headers);

      expect(status).toBe(201);
      expect(data.qty).toBe(-5);
      expect(data.reasonCode).toBe('damage');

      // Verify inventory changed
      const invAfter = await apiGet(`/api/modules/pos/inventory?locationId=${locId}`, headers);
      const qtyAfter = invAfter.inventory?.find((i: any) => i.productId === prod.id)?.qtyOnHand ?? 0;
      expect(qtyAfter).toBe(qtyBefore - 5);
    });

    test('INV-010: list adjustments', async () => {
      const headers = await getAuthHeaders();

      const result = await apiGet('/api/modules/inventory-management/adjustment', headers);

      expect(result.adjustments).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.adjustments[0].reasonCode).toBeTruthy();
      expect(result.adjustments[0].adjustedByName).toBeTruthy();
    });
  });

  test.describe('C2: Movement Ledger', () => {
    test('INV-011: movement created from adjustment', async () => {
      const headers = await getAuthHeaders();

      const result = await apiGet('/api/modules/inventory-management/movement', headers);

      expect(result.movements).toBeDefined();
      expect(result.count).toBeGreaterThan(0);

      const adjMovement = result.movements.find((m: any) => m.movementType === 'adjustment');
      expect(adjMovement).toBeTruthy();
      expect(adjMovement.qty).toBeDefined();
      expect(adjMovement.balanceAfter).toBeDefined();
    });

    test('INV-012: filter movements by type', async () => {
      const headers = await getAuthHeaders();

      const result = await apiGet('/api/modules/inventory-management/movement?movementType=adjustment', headers);

      expect(result.movements).toBeDefined();
      for (const m of result.movements) {
        expect(m.movementType).toBe('adjustment');
      }
    });
  });

  test.describe('C2: Alert Config', () => {
    test('INV-013: save alert config', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      const { status, data } = await apiPost('/api/modules/inventory-management/alert-config', {
        locationId: locId, productId: prod.id, minQty: 10, maxQty: 100,
      }, headers);

      expect([200, 201]).toContain(status);
      expect(data.minQty).toBe(10);
    });

    test('INV-014: get low-stock alerts', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      // Set threshold very high so product is definitely below it
      await apiPost('/api/modules/inventory-management/alert-config', {
        locationId: locId, productId: prod.id, minQty: 999999,
      }, headers);

      const result = await apiGet('/api/modules/inventory-management/alerts', headers);

      expect(result.alerts).toBeDefined();
      expect(result.count).toBeGreaterThan(0);

      const alert = result.alerts.find((a: any) => a.product_name === prod.name);
      expect(alert).toBeTruthy();
      expect(Number(alert.qty_on_hand)).toBeLessThanOrEqual(999999);

      // Reset threshold to reasonable
      await apiPost('/api/modules/inventory-management/alert-config', {
        locationId: locId, productId: prod.id, minQty: 5,
      }, headers);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('INV-015: cannot finalize already finalized count', async () => {
      const headers = await getAuthHeaders();
      const { id, lines } = await createStockCount();

      // Record + finalize
      if (lines.length > 0) {
        await apiPut(`/api/modules/inventory-management/stock-count/${id}/lines`, {
          lines: [{ productId: lines[0].productId, skuCode: lines[0].skuCode, productName: lines[0].productName, countedQty: lines[0].systemQty }],
        }, headers);
      }
      await apiPost(`/api/modules/inventory-management/stock-count/${id}/finalize`, {}, headers);

      // Try again
      const { status, data } = await apiPost(`/api/modules/inventory-management/stock-count/${id}/finalize`, {}, headers);
      expect(status).toBe(400);
      expect(data.error).toContain('Already finalized');
    });

    test('INV-016: adjustment with zero qty rejected', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      const { status } = await apiPost('/api/modules/inventory-management/adjustment', {
        locationId: locId, productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
        qty: 0, reasonCode: 'correction',
      }, headers);

      expect(status).toBe(400);
    });

    test('INV-017: positive adjustment increases inventory', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      const invBefore = await apiGet(`/api/modules/pos/inventory?locationId=${locId}`, headers);
      const qtyBefore = invBefore.inventory?.find((i: any) => i.productId === prod.id)?.qtyOnHand ?? 0;

      await apiPost('/api/modules/inventory-management/adjustment', {
        locationId: locId, productId: prod.id, skuCode: prod.skuCode, productName: prod.name,
        qty: 10, reasonCode: 'correction', notes: 'Positive correction',
      }, headers);

      const invAfter = await apiGet(`/api/modules/pos/inventory?locationId=${locId}`, headers);
      const qtyAfter = invAfter.inventory?.find((i: any) => i.productId === prod.id)?.qtyOnHand ?? 0;
      expect(qtyAfter).toBe(qtyBefore + 10);
    });

    test('INV-018: stock count session page loads', async ({ tenantAdminPage }) => {
      const { id } = await createStockCount();

      await tenantAdminPage.goto(`/console/modules/inventory-management/stock-count/${id}`);
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Stock Count');
      await expect(tenantAdminPage.locator('text=System Qty')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Counted Qty')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Variance')).toBeVisible();
    });

    test('INV-019: alert config upsert', async () => {
      const headers = await getAuthHeaders();
      const locId = await getLocationId();
      const prod = await getProduct();

      // Create
      await apiPost('/api/modules/inventory-management/alert-config', {
        locationId: locId, productId: prod.id, minQty: 20,
      }, headers);

      // Update same combo
      const { data } = await apiPost('/api/modules/inventory-management/alert-config', {
        locationId: locId, productId: prod.id, minQty: 30,
      }, headers);

      expect(data.minQty).toBe(30);

      // Verify no duplicates
      const configs = await apiGet(`/api/modules/inventory-management/alert-config?locationId=${locId}`, headers);
      const matching = configs.configs.filter((c: any) => c.productId === prod.id);
      expect(matching.length).toBe(1);
    });
  });
});
