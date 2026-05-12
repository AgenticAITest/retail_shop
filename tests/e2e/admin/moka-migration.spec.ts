import { test, expect } from '../../fixtures/auth';

/**
 * Phase 3 Moka migration tests: TA-041, TA-042
 */

async function api(page: any, method: string, url: string, body?: object) {
  return page.evaluate(async ({ m, u, b }: any) => {
    const token = localStorage.getItem('token');
    const tenant = JSON.parse(localStorage.getItem('currentTenant') || '{}');
    const r = await fetch(u, {
      method: m,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Code': tenant.code || 'tmj',
        'Content-Type': 'application/json',
      },
      body: b ? JSON.stringify(b) : undefined,
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }, { m: method, u: url, b: body });
}

// Minimal valid MokaPOS CSV with 3 regular products and 1 modifier (skipped)
const MOKA_CSV = `Name,Category,Type,SKU,Barcode,Price,Cost,Track Inventory,Stock
Espresso,Beverages,Regular,MKA-001,8880000000001,15000,6000,true,50
Americano,Beverages,Regular,MKA-002,8880000000002,18000,7000,true,40
Latte,Beverages,Regular,MKA-003,8880000000003,22000,9000,true,30
Extra Shot,Modifiers,Modifier,,,5000,2000,false,0`;

test.describe('TA-041..042 — Moka migration', () => {
  test.describe.configure({ mode: 'serial' });

  let targetLocationId = '';
  let batchId = '';

  test('Setup: get or create target location for Moka import', async ({ tenantAdminPage }) => {
    const LOC_CODE = 'MKA-LOC';
    const locList = await api(tenantAdminPage, 'GET', `/api/modules/location-management/location?filter=${LOC_CODE}`);
    const existing = locList.data?.locations?.find((l: any) => l.code === LOC_CODE);
    if (existing) {
      targetLocationId = existing.id;
    } else {
      const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/location-management/location/add', {
        code: LOC_CODE, name: 'Moka Import Test Location', type: 'shop', status: 'active',
      });
      expect(status).toBe(201);
      targetLocationId = data.id;
    }
    expect(targetLocationId).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // TA-041 — Parse and import MokaPOS CSV
  // ──────────────────────────────────────────────────────────

  test('TA-041: Parse MokaPOS CSV preview then import', async ({ tenantAdminPage }) => {
    expect(targetLocationId).toBeTruthy();

    // Step 1: Parse (dry run — no DB write)
    const { status: ps, data: pd } = await api(tenantAdminPage, 'POST', '/api/modules/moka-migration/migration/parse', {
      csvData: MOKA_CSV,
    });
    expect(ps).toBe(200);
    // Should show 3 regular products, 1 modifier skipped
    expect(pd?.modifiersSkipped).toBeGreaterThanOrEqual(1);
    const products = pd?.products ?? [];
    expect(products.length).toBeGreaterThanOrEqual(3);

    // Step 2: Import to DB
    const { status: is, data: id } = await api(tenantAdminPage, 'POST', '/api/modules/moka-migration/migration/import', {
      csvData: MOKA_CSV,
      targetLocationId,
      fileName: 'ta-041-test-import.csv',
    });
    expect(is).toBe(200);
    expect(id?.batchId ?? id?.batch?.id).toBeTruthy();
    batchId = id?.batchId ?? id?.batch?.id ?? '';

    // Verify batch shows in history
    const { status: bs, data: bd } = await api(tenantAdminPage, 'GET', '/api/modules/moka-migration/migration/batches');
    expect(bs).toBe(200);
    const batches: any[] = Array.isArray(bd) ? bd : bd?.batches ?? [];
    const ourBatch = batches.find((b: any) => b.id === batchId || b.status === 'completed');
    expect(ourBatch).toBeTruthy();
    if (ourBatch) batchId = ourBatch.id;
  });

  // ──────────────────────────────────────────────────────────
  // TA-042 — Rollback import batch
  // ──────────────────────────────────────────────────────────

  test('TA-042: Rollback the Moka import batch', async ({ tenantAdminPage }) => {
    expect(batchId).toBeTruthy();

    // Rollback
    const { status: rs } = await api(tenantAdminPage, 'DELETE', `/api/modules/moka-migration/migration/batches/${batchId}`);
    expect(rs).toBe(200);

    // Verify batch now shows rolled_back status
    const { status: bs, data: bd } = await api(tenantAdminPage, 'GET', '/api/modules/moka-migration/migration/batches');
    expect(bs).toBe(200);
    const batches: any[] = Array.isArray(bd) ? bd : bd?.batches ?? [];
    const rolledBack = batches.find((b: any) => b.id === batchId);
    if (rolledBack) {
      expect(rolledBack.status).toBe('rolled_back');
    }

    // Verify attempting to rollback again returns 400
    const { status: rs2 } = await api(tenantAdminPage, 'DELETE', `/api/modules/moka-migration/migration/batches/${batchId}`);
    expect(rs2).toBe(400);
  });
});
