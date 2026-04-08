import { test, expect, TEST_USERS } from '../../../fixtures/auth';

/**
 * Extended Reports E2E Tests (Sprint 21)
 *
 * Tests POS, Tax, Procurement, and Transfer report APIs and pages.
 */

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

async function apiGet(path: string): Promise<{ status: number; data: any }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`http://127.0.0.1:5000${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

test.describe('Extended Reports (Sprint 21)', () => {

  // ============================================================
  // C1: SMOKE - PAGES
  // ============================================================

  test.describe('C1: Smoke - Pages', () => {
    test('EXT-001: POS report page loads', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/report/pos');
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('POS Report');
      await expect(adminPage.locator('text=Hourly Sales Distribution')).toBeVisible();
      await expect(adminPage.locator('text=Payment Method Breakdown')).toBeVisible();
      await expect(adminPage.locator('text=Cashier Performance')).toBeVisible();
      await expect(adminPage.locator('text=Voided Transactions')).toBeVisible();
    });

    test('EXT-002: Tax report page loads', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/report/tax');
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('Tax (PPN) Report');
      await expect(adminPage.locator('text=Total PPN Collected')).toBeVisible();
      await expect(adminPage.locator('text=PPN by Location')).toBeVisible();
      await expect(adminPage.locator('text=PPN by Category')).toBeVisible();
    });

    test('EXT-003: Procurement report page loads', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/report/procurement');
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('Procurement Report');
      await expect(adminPage.locator('text=PO Status Summary')).toBeVisible();
      await expect(adminPage.locator('text=Supplier Scorecard')).toBeVisible();
      await expect(adminPage.locator('text=GRN Timeliness')).toBeVisible();
    });

    test('EXT-004: Transfer report page loads', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/report/transfer');
      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.locator('h1')).toContainText('Transfer Report');
      await expect(adminPage.locator('text=Transfer Volume Between Locations')).toBeVisible();
      await expect(adminPage.locator('text=Transfer Discrepancy Summary')).toBeVisible();
    });
  });

  // ============================================================
  // C2: FULL - API ENDPOINTS
  // ============================================================

  test.describe('C2: POS Report APIs', () => {
    test('EXT-005: shift summary', async () => {
      const { status, data } = await apiGet('/api/modules/report/pos/shift-summary');
      expect(status).toBe(200);
      expect(data.shifts).toBeDefined();
      expect(Array.isArray(data.shifts)).toBe(true);
      expect(data.period).toBeTruthy();
    });

    test('EXT-006: payment breakdown', async () => {
      const { status, data } = await apiGet('/api/modules/report/pos/payment-breakdown');
      expect(status).toBe(200);
      expect(data.breakdown).toBeDefined();
      expect(Array.isArray(data.breakdown)).toBe(true);
      if (data.breakdown.length > 0) {
        expect(data.breakdown[0].payment_method).toBeTruthy();
        expect(data.breakdown[0].count).toBeDefined();
        expect(data.breakdown[0].total).toBeDefined();
      }
    });

    test('EXT-007: hourly distribution', async () => {
      const { status, data } = await apiGet('/api/modules/report/pos/hourly');
      expect(status).toBe(200);
      expect(data.hourly).toBeDefined();
      expect(Array.isArray(data.hourly)).toBe(true);
      if (data.hourly.length > 0) {
        expect(data.hourly[0].hour).toBeDefined();
        expect(data.hourly[0].transactions).toBeDefined();
        expect(data.hourly[0].revenue).toBeDefined();
      }
    });

    test('EXT-008: cashier performance', async () => {
      const { status, data } = await apiGet('/api/modules/report/pos/cashier-performance');
      expect(status).toBe(200);
      expect(data.cashiers).toBeDefined();
      if (data.cashiers.length > 0) {
        expect(data.cashiers[0].cashier_name).toBeTruthy();
        expect(data.cashiers[0].transactions).toBeDefined();
        expect(data.cashiers[0].revenue).toBeDefined();
      }
    });

    test('EXT-009: voids', async () => {
      const { status, data } = await apiGet('/api/modules/report/pos/voids');
      expect(status).toBe(200);
      expect(data.voids).toBeDefined();
      expect(Array.isArray(data.voids)).toBe(true);
    });
  });

  test.describe('C2: Tax Report APIs', () => {
    test('EXT-010: tax summary', async () => {
      const { status, data } = await apiGet('/api/modules/report/tax/summary');
      expect(status).toBe(200);
      expect(typeof data.totalPPN).toBe('number');
      expect(typeof data.totalRevenue).toBe('number');
      expect(typeof data.transactionCount).toBe('number');
      expect(data.period).toBeTruthy();
    });

    test('EXT-011: tax by location', async () => {
      const { status, data } = await apiGet('/api/modules/report/tax/by-location');
      expect(status).toBe(200);
      expect(data.byLocation).toBeDefined();
      expect(Array.isArray(data.byLocation)).toBe(true);
      if (data.byLocation.length > 0) {
        expect(data.byLocation[0].location_name).toBeTruthy();
        expect(data.byLocation[0].ppn).toBeDefined();
      }
    });

    test('EXT-012: tax by category', async () => {
      const { status, data } = await apiGet('/api/modules/report/tax/by-category');
      expect(status).toBe(200);
      expect(data.byCategory).toBeDefined();
      expect(Array.isArray(data.byCategory)).toBe(true);
    });
  });

  test.describe('C2: Procurement Report APIs', () => {
    test('EXT-013: PO summary', async () => {
      const { status, data } = await apiGet('/api/modules/report/procurement/po-summary');
      expect(status).toBe(200);
      expect(data.poSummary).toBeDefined();
      expect(data.poSummary.length).toBeGreaterThan(0);
      expect(data.poSummary[0].status).toBeTruthy();
      expect(data.poSummary[0].count).toBeDefined();
      expect(data.poSummary[0].total_value).toBeDefined();
    });

    test('EXT-014: supplier scorecard', async () => {
      const { status, data } = await apiGet('/api/modules/report/procurement/supplier-scorecard');
      expect(status).toBe(200);
      expect(data.scorecard).toBeDefined();
      if (data.scorecard.length > 0) {
        expect(data.scorecard[0].supplier_name).toBeTruthy();
        expect(data.scorecard[0].total_pos).toBeDefined();
        expect(data.scorecard[0].completed_pos).toBeDefined();
        expect(data.scorecard[0].total_returns).toBeDefined();
      }
    });

    test('EXT-015: GRN timeliness', async () => {
      const { status, data } = await apiGet('/api/modules/report/procurement/grn-timeliness');
      expect(status).toBe(200);
      expect(data.timeliness).toBeDefined();
      expect(Array.isArray(data.timeliness)).toBe(true);
    });
  });

  test.describe('C2: Transfer Report APIs', () => {
    test('EXT-016: transfer volume', async () => {
      const { status, data } = await apiGet('/api/modules/report/transfer/volume');
      expect(status).toBe(200);
      expect(data.volume).toBeDefined();
      expect(Array.isArray(data.volume)).toBe(true);
      if (data.volume.length > 0) {
        expect(data.volume[0].source_name).toBeTruthy();
        expect(data.volume[0].dest_name).toBeTruthy();
        expect(data.volume[0].transfer_count).toBeDefined();
        expect(data.volume[0].total_qty).toBeDefined();
      }
    });

    test('EXT-017: transfer discrepancy', async () => {
      const { status, data } = await apiGet('/api/modules/report/transfer/discrepancy');
      expect(status).toBe(200);
      expect(data.discrepancies).toBeDefined();
      expect(Array.isArray(data.discrepancies)).toBe(true);
    });
  });

  // ============================================================
  // C3: EDGE CASES
  // ============================================================

  test.describe('C3: Edge Cases', () => {
    test('EXT-018: POS reports with period filter', async () => {
      const { data } = await apiGet('/api/modules/report/pos/shift-summary?days=7');
      expect(data.period).toContain('7');

      const { data: d90 } = await apiGet('/api/modules/report/pos/payment-breakdown?days=90');
      expect(d90.period).toContain('90');
    });

    test('EXT-019: tax summary types correct', async () => {
      const { data } = await apiGet('/api/modules/report/tax/summary');
      expect(typeof data.totalPPN).toBe('number');
      expect(typeof data.totalRevenue).toBe('number');
      expect(typeof data.transactionCount).toBe('number');
      expect(data.totalPPN).not.toBeNaN();
      expect(data.totalRevenue).not.toBeNaN();
      expect(data.transactionCount).not.toBeNaN();
    });

    test('EXT-020: POS report period selector', async ({ adminPage }) => {
      await adminPage.goto('/console/modules/report/pos');
      await adminPage.waitForLoadState('networkidle');
      await adminPage.waitForTimeout(1000);

      const selector = adminPage.locator('button[role="combobox"]').first();
      await selector.click();
      await adminPage.waitForTimeout(300);

      await adminPage.locator('[role="option"]:has-text("Last 7 days")').click();
      await adminPage.waitForTimeout(1500);

      // No errors — page still shows sections
      await expect(adminPage.locator('text=Payment Method Breakdown')).toBeVisible();
    });
  });
});
