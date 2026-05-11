import { test, expect, TEST_USERS } from '../../../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Inventory Consolidation & Valuation E2E Tests (Sprint 19)
 *
 * Tests consolidated inventory view, per-product drill-down,
 * on-order quantities, inventory valuation, and UI pages.
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
  return { status: res.status, data: await res.json() };
}

test.describe('Inventory Consolidation & Valuation (Sprint 19)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke - Pages', () => {
    test('CON-001: consolidated inventory page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/consolidated');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Consolidated Inventory');
      await expect(tenantAdminPage.locator('th:has-text("Product")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("On Hand")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("In Transit")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("On Order")')).toBeVisible();
      await expect(tenantAdminPage.locator('th:has-text("Value")')).toBeVisible();
    });

    test('CON-002: valuation page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/valuation');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Inventory Valuation');
      await expect(tenantAdminPage.locator('text=Total Inventory Value')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Total Units')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Valuation Method')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Value by Location')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - API', () => {
    test('CON-003: consolidated API returns data', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/inventory-management/consolidated', headers);

      expect(status).toBe(200);
      expect(data.consolidated).toBeDefined();
      expect(data.count).toBeGreaterThan(0);

      const first = data.consolidated[0];
      expect(first.productId).toBeTruthy();
      expect(first.skuCode).toBeTruthy();
      expect(first.name).toBeTruthy();
      expect(first.totalOnHand).toBeDefined();
      expect(first.totalInTransit).toBeDefined();
      expect(first.totalOnOrder).toBeDefined();
      expect(first.totalValue).toBeDefined();
    });

    test('CON-004: valuation API returns data', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/inventory-management/valuation', headers);

      expect(status).toBe(200);
      expect(data.method).toBe('weighted_average_cost');
      expect(data.totals).toBeDefined();
      expect(data.totals.totalValue).toBeDefined();
      expect(data.totals.totalUnits).toBeDefined();
      expect(data.totals.totalProducts).toBeDefined();
      expect(data.byLocation).toBeDefined();
      expect(Array.isArray(data.byLocation)).toBe(true);
    });
  });

  // ============================================================
  // C2: FULL LIFECYCLE
  // ============================================================

  test.describe('C2: Consolidated Inventory', () => {
    test('CON-005: aggregates across locations', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/inventory-management/consolidated', headers);

      // Each product should have numeric aggregates
      for (const item of data.consolidated) {
        expect(typeof item.totalOnHand).toBe('number');
        expect(typeof item.totalInTransit).toBe('number');
        expect(typeof item.totalOnOrder).toBe('number');
        expect(typeof item.totalValue).toBe('number');
      }
    });

    test('CON-006: shows on-order from open POs', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/inventory-management/consolidated', headers);

      // At least one product should have on-order (from our test POs)
      const withOnOrder = data.consolidated.filter((c: any) => c.totalOnOrder > 0);
      expect(withOnOrder.length).toBeGreaterThan(0);
    });

    test('CON-007: per-product drill-down', async () => {
      const headers = await getAuthHeaders();

      // Get first product from consolidated
      const { data: consData } = await apiGet('/api/modules/inventory-management/consolidated?perPage=1', headers);
      const productId = consData.consolidated[0]?.productId;
      expect(productId).toBeTruthy();

      // Drill down
      const { status, data } = await apiGet(`/api/modules/inventory-management/consolidated/${productId}`, headers);

      expect(status).toBe(200);
      expect(data.product).toBeTruthy();
      expect(data.product.id).toBe(productId);
      expect(data.breakdown).toBeDefined();
      expect(data.breakdown.length).toBeGreaterThan(0);

      // Each breakdown entry has location info
      const entry = data.breakdown[0];
      expect(entry.locationId).toBeTruthy();
      expect(entry.locationName).toBeTruthy();
      expect(entry.qtyOnHand).toBeDefined();
      expect(entry.inTransit).toBeDefined();
      expect(entry.onOrder).toBeDefined();

      // Totals
      expect(data.totals).toBeDefined();
      expect(data.totals.totalOnHand).toBeDefined();
    });

    test('CON-008: drill-down totals match consolidated', async () => {
      const headers = await getAuthHeaders();

      const { data: consData } = await apiGet('/api/modules/inventory-management/consolidated?perPage=1', headers);
      const item = consData.consolidated[0];

      const { data: drillData } = await apiGet(`/api/modules/inventory-management/consolidated/${item.productId}`, headers);

      expect(drillData.totals.totalOnHand).toBe(item.totalOnHand);
      expect(drillData.totals.totalInTransit).toBe(item.totalInTransit);
    });
  });

  test.describe('C2: Valuation', () => {
    test('CON-009: valuation by location', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/inventory-management/valuation', headers);

      // byLocation should have entries (from our test data)
      expect(data.byLocation.length).toBeGreaterThan(0);

      const loc = data.byLocation[0];
      expect(loc.locationId).toBeTruthy();
      expect(loc.locationName).toBeTruthy();
      expect(typeof loc.value).toBe('number');
      expect(typeof loc.units).toBe('number');
      expect(typeof loc.products).toBe('number');
    });
  });

  test.describe('C2: Search & Pagination', () => {
    test('CON-010: search filter', async () => {
      const headers = await getAuthHeaders();

      // Get a product name to search for
      const { data: allData } = await apiGet('/api/modules/inventory-management/consolidated?perPage=1', headers);
      const name = allData.consolidated[0]?.name;
      expect(name).toBeTruthy();

      // Search by partial name
      const searchTerm = name.substring(0, 5);
      const { data } = await apiGet(`/api/modules/inventory-management/consolidated?search=${encodeURIComponent(searchTerm)}`, headers);

      expect(data.consolidated.length).toBeGreaterThan(0);
      for (const item of data.consolidated) {
        expect(item.name.toLowerCase()).toContain(searchTerm.toLowerCase());
      }
    });

    test('CON-011: pagination', async () => {
      const headers = await getAuthHeaders();

      const { data } = await apiGet('/api/modules/inventory-management/consolidated?page=1&perPage=1', headers);

      expect(data.consolidated.length).toBeLessThanOrEqual(1);
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.page).toBe(1);
      expect(data.perPage).toBe(1);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('CON-012: drill-down non-existent product', async () => {
      const headers = await getAuthHeaders();
      const { status } = await apiGet('/api/modules/inventory-management/consolidated/00000000-0000-0000-0000-000000000000', headers);
      expect(status).toBe(404);
    });

    test('CON-013: search no results', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/inventory-management/consolidated?search=ZZZZNONEXISTENT999', headers);
      expect(data.consolidated).toHaveLength(0);
      expect(data.count).toBe(0);
    });

    test('CON-014: valuation method', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/inventory-management/valuation', headers);
      expect(data.method).toBe('weighted_average_cost');
    });

    test('CON-015: consolidated page drill-down dialog', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/inventory-management/consolidated');
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(2000);

      // Click first product row
      const firstRow = tenantAdminPage.locator('tbody tr').first();
      if (await firstRow.isVisible()) {
        await firstRow.click();
        await tenantAdminPage.waitForTimeout(1000);

        // Drill-down dialog should open
        await expect(tenantAdminPage.locator('[role="alertdialog"]')).toBeVisible();
        await expect(tenantAdminPage.locator('text=Per-location inventory breakdown')).toBeVisible();

        // Should show location breakdown table
        await expect(tenantAdminPage.locator('[role="alertdialog"] th:has-text("Location")')).toBeVisible();
        await expect(tenantAdminPage.locator('[role="alertdialog"] th:has-text("On Hand")')).toBeVisible();

        // Close
        await tenantAdminPage.locator('[role="alertdialog"] button:has-text("Close")').click();
      }
    });
  });
});
