import { test, expect, TEST_USERS } from '../../../fixtures/auth';

/**
 * Reports & Analytics E2E Tests (Sprint 20)
 *
 * Tests dashboard KPIs, revenue chart, activity feed,
 * revenue reports (by-shop, by-product, trends),
 * inventory reports (by-location, slow-moving), and UI pages.
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

async function apiGet(path: string, headers: Record<string, string>): Promise<{ status: number; data: any }> {
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

test.describe('Reports & Analytics (Sprint 20)', () => {

  // ============================================================
  // C1: SMOKE
  // ============================================================

  test.describe('C1: Smoke - Pages', () => {
    test('RPT-001: dashboard page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/report/dashboard');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Dashboard');

      // KPI cards
      await expect(tenantAdminPage.locator('text=Revenue Today')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Revenue MTD')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Inventory Value').first()).toBeVisible();
      await expect(tenantAdminPage.locator('text=Pending Approvals')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Active Transfers')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Low-Stock Alerts')).toBeVisible();

      // Quick Actions
      await expect(tenantAdminPage.locator('text=Quick Actions')).toBeVisible();
    });

    test('RPT-002: revenue report page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/report/revenue');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Revenue Report');
      // Period selector
      await expect(tenantAdminPage.locator('button[role="combobox"]').first()).toBeVisible();
      // Tables
      await expect(tenantAdminPage.locator('text=Revenue by Shop')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Top Selling Products')).toBeVisible();
    });

    test('RPT-003: inventory report page loads', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/report/inventory');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('h1')).toContainText('Inventory Report');
      await expect(tenantAdminPage.locator('text=Stock by Location')).toBeVisible();
      await expect(tenantAdminPage.locator('text=Slow-Moving Stock')).toBeVisible();
    });
  });

  test.describe('C1: Smoke - API', () => {
    test('RPT-004: dashboard KPIs API', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/dashboard/kpis', headers);

      expect(status).toBe(200);
      expect(typeof data.totalRevenueToday).toBe('number');
      expect(typeof data.totalRevenueMTD).toBe('number');
      expect(typeof data.totalInventoryValue).toBe('number');
      expect(typeof data.pendingApprovals).toBe('number');
      expect(typeof data.activeTransfers).toBe('number');
      expect(typeof data.lowStockAlerts).toBe('number');
    });
  });

  // ============================================================
  // C2: FULL LIFECYCLE
  // ============================================================

  test.describe('C2: Dashboard APIs', () => {
    test('RPT-005: revenue chart data', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/dashboard/revenue-chart', headers);

      expect(status).toBe(200);
      expect(data.chartData).toBeDefined();
      expect(Array.isArray(data.chartData)).toBe(true);
      // If there's data, check structure
      if (data.chartData.length > 0) {
        expect(data.chartData[0].date).toBeDefined();
        expect(data.chartData[0].revenue).toBeDefined();
      }
    });

    test('RPT-006: activity feed', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/dashboard/activity', headers);

      expect(status).toBe(200);
      expect(data.activity).toBeDefined();
      expect(Array.isArray(data.activity)).toBe(true);

      if (data.activity.length > 0) {
        const item = data.activity[0];
        expect(item.type).toBeTruthy();
        expect(item.ref).toBeTruthy();
        expect(item.status).toBeTruthy();
      }
    });
  });

  test.describe('C2: Revenue Reports', () => {
    test('RPT-007: revenue by shop', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/revenue/by-shop', headers);

      expect(status).toBe(200);
      expect(data.byShop).toBeDefined();
      expect(data.period).toBeTruthy();

      if (data.byShop.length > 0) {
        const shop = data.byShop[0];
        expect(shop.location_name).toBeTruthy();
        expect(shop.revenue).toBeDefined();
        expect(shop.transaction_count).toBeDefined();
        expect(shop.avg_basket).toBeDefined();
      }
    });

    test('RPT-008: revenue by product (top 5)', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/revenue/by-product?limit=5', headers);

      expect(status).toBe(200);
      expect(data.byProduct).toBeDefined();
      expect(data.byProduct.length).toBeLessThanOrEqual(5);

      if (data.byProduct.length > 0) {
        const prod = data.byProduct[0];
        expect(prod.product_name).toBeTruthy();
        expect(prod.sku_code).toBeTruthy();
        expect(prod.total_qty).toBeDefined();
        expect(prod.total_revenue).toBeDefined();
      }
    });

    test('RPT-009: revenue trends', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/revenue/trends', headers);

      expect(status).toBe(200);
      expect(data.trends).toBeDefined();
      expect(Array.isArray(data.trends)).toBe(true);

      if (data.trends.length > 0) {
        expect(data.trends[0].date).toBeDefined();
        expect(data.trends[0].revenue).toBeDefined();
        expect(data.trends[0].transactions).toBeDefined();
      }
    });
  });

  test.describe('C2: Inventory Reports', () => {
    test('RPT-010: inventory by location', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/inventory/by-location', headers);

      expect(status).toBe(200);
      expect(data.byLocation).toBeDefined();
      expect(data.byLocation.length).toBeGreaterThan(0);

      const loc = data.byLocation[0];
      expect(loc.location_name).toBeTruthy();
      expect(loc.total_on_hand).toBeDefined();
      expect(loc.total_in_transit).toBeDefined();
      expect(loc.product_count).toBeDefined();
      expect(loc.total_value).toBeDefined();
    });

    test('RPT-011: slow-moving stock', async () => {
      const headers = await getAuthHeaders();
      const { status, data } = await apiGet('/api/modules/report/inventory/slow-moving', headers);

      expect(status).toBe(200);
      expect(data.slowMoving).toBeDefined();
      expect(Array.isArray(data.slowMoving)).toBe(true);
      expect(data.period).toBeTruthy();
    });

    test('RPT-012: revenue by shop with different periods', async () => {
      const headers = await getAuthHeaders();

      const { data: d7 } = await apiGet('/api/modules/report/revenue/by-shop?days=7', headers);
      const { data: d90 } = await apiGet('/api/modules/report/revenue/by-shop?days=90', headers);

      expect(d7.period).toContain('7');
      expect(d90.period).toContain('90');
      expect(d7.byShop).toBeDefined();
      expect(d90.byShop).toBeDefined();
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('RPT-013: KPIs have correct types', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/report/dashboard/kpis', headers);

      // All must be numbers, not null or undefined
      for (const key of ['totalRevenueToday', 'totalRevenueMTD', 'totalInventoryValue', 'pendingApprovals', 'activeTransfers', 'lowStockAlerts']) {
        expect(typeof data[key]).toBe('number');
        expect(data[key]).not.toBeNaN();
      }
    });

    test('RPT-014: revenue trends with 7-day period', async () => {
      const headers = await getAuthHeaders();
      const { data } = await apiGet('/api/modules/report/revenue/trends?days=7', headers);

      expect(data.trends).toBeDefined();
      expect(data.period).toContain('7');
      // All trend dates should be within last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      for (const t of data.trends) {
        expect(new Date(t.date).getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime() - 86400000); // 1 day tolerance
      }
    });

    test('RPT-015: dashboard quick actions visible', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/report/dashboard');
      await tenantAdminPage.waitForLoadState('networkidle');

      await expect(tenantAdminPage.locator('button:has-text("New Purchase Order")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("New Transfer")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Stock Count")')).toBeVisible();
      await expect(tenantAdminPage.locator('button:has-text("Open POS")')).toBeVisible();
    });

    test('RPT-016: revenue report period selector', async ({ tenantAdminPage }) => {
      await tenantAdminPage.goto('/console/modules/report/revenue');
      await tenantAdminPage.waitForLoadState('networkidle');
      await tenantAdminPage.waitForTimeout(1000);

      // Default is 30 days
      const selector = tenantAdminPage.locator('button[role="combobox"]').first();
      await selector.click();
      await tenantAdminPage.waitForTimeout(300);

      // Select 7 days
      await tenantAdminPage.locator('[role="option"]:has-text("Last 7 days")').click();
      await tenantAdminPage.waitForTimeout(1500);

      // Data should have refreshed (no errors)
      await expect(tenantAdminPage.locator('text=Revenue by Shop')).toBeVisible();
    });
  });
});
