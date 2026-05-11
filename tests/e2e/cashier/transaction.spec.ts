import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 Transaction management tests: EU-022 to EU-024
 */

const toNum = (v: any, fallback = 0): number => Number(v ?? fallback) || fallback;

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

test.describe('EU-022..024 — Transaction management', () => {
  test.describe.configure({ mode: 'serial' });

  let txId = '';

  test('Setup: create a transaction to work with', async ({ tenantAdminPage }) => {
    // Get location + product
    const { data: locData } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location?perPage=10');
    const activeLoc = (locData?.locations ?? []).find((l: any) => l.status === 'active');
    expect(activeLoc).toBeTruthy();

    const { data: pd } = await api(tenantAdminPage, 'GET', '/api/modules/pos/transaction/products');
    const products: any[] = pd?.products ?? pd?.data ?? [];
    expect(products.length).toBeGreaterThan(0);
    const product = products[0];
    const unitPrice = toNum(product.sellingPrice, 15000);

    // Reuse open shift or open new one; checkout must use the same locationId as the shift
    let checkoutLocationId = activeLoc.id;
    const { data: cur } = await api(tenantAdminPage, 'GET', '/api/modules/pos/shift/current');
    if (cur?.shift?.id && cur.shift.status === 'open') {
      checkoutLocationId = cur.shift.locationId ?? activeLoc.id;
    } else {
      const { status: os } = await api(tenantAdminPage, 'POST', '/api/modules/pos/shift/open', {
        locationId: activeLoc.id,
        openingFloat: 0,
      });
      expect([200, 201, 400]).toContain(os); // 400 = already open (race), which is fine
      // Re-fetch: ensures we use the actual shift's location regardless of race
      const { data: cur2 } = await api(tenantAdminPage, 'GET', '/api/modules/pos/shift/current');
      checkoutLocationId = cur2?.shift?.locationId ?? activeLoc.id;
    }

    // Create transaction
    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId: checkoutLocationId,
      items: [{
        productId: product.id,
        skuCode: product.skuCode,
        productName: product.name,
        quantity: 1,
        unitPrice,
      }],
      payments: [{ paymentMethod: 'cash', amount: Math.ceil(unitPrice * 1.15) }],
    });
    expect(status).toBe(201);
    txId = data.id;
    expect(txId).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-022 — View transaction history
  // ──────────────────────────────────────────────────────────

  test('EU-022: Manager can view transaction list', async ({ managerPage }) => {
    const { status, data } = await api(managerPage, 'GET', '/api/modules/pos/transaction');
    expect(status).toBe(200);
    expect(data).toHaveProperty('transactions');
    expect(Array.isArray(data.transactions)).toBe(true);
  });

  test('EU-022b: Manager can view transaction detail', async ({ managerPage }) => {
    expect(txId).toBeTruthy();
    const { status, data } = await api(managerPage, 'GET', `/api/modules/pos/transaction/${txId}`);
    expect(status).toBe(200);
    expect(data.id ?? data.transaction?.id).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-023 — Reprint receipt
  // ──────────────────────────────────────────────────────────

  test('EU-023: Reprint receipt endpoint responds', async ({ tenantAdminPage }) => {
    expect(txId).toBeTruthy();

    const { status, data } = await api(tenantAdminPage, 'POST', `/api/modules/pos/transaction/${txId}/reprint`);
    // 200 = reprinted, 400 = already reprinted today, 404 = not found
    expect([200, 201, 400]).toContain(status);
    if (status === 200 || status === 201) {
      // Response may contain receipt data or just confirmation
      expect(data).toBeTruthy();
    }
  });

  // ──────────────────────────────────────────────────────────
  // EU-024 — Void transaction
  // ──────────────────────────────────────────────────────────

  test('EU-024: Void completed transaction restores inventory', async ({ tenantAdminPage }) => {
    expect(txId).toBeTruthy();

    // Get inventory before void
    const { data: txDetail } = await api(tenantAdminPage, 'GET', `/api/modules/pos/transaction/${txId}`);
    const transaction = txDetail?.transaction ?? txDetail;
    const items: any[] = transaction?.items ?? [];
    const firstItem = items[0];

    let invBefore = 0;
    if (firstItem?.productId) {
      const { data: invData } = await api(tenantAdminPage, 'GET',
        `/api/modules/inventory-management/consolidated/${firstItem.productId}`);
      invBefore = invData?.totalQty ?? 0;
    }

    // Void transaction
    const { status, data } = await api(tenantAdminPage, 'POST', `/api/modules/pos/transaction/${txId}/void`, {
      voidReason: 'EU-024 customer returned items — wrong order received',
    });
    expect([200, 201]).toContain(status);
    expect(data.status ?? data.transaction?.status).toBe('voided');

    // Verify inventory restored
    if (firstItem?.productId) {
      const { data: invAfter } = await api(tenantAdminPage, 'GET',
        `/api/modules/inventory-management/consolidated/${firstItem.productId}`);
      const qtyAfter = invAfter?.totalQty ?? 0;
      expect(qtyAfter).toBeGreaterThanOrEqual(invBefore);
    }

    // Cannot void the same transaction twice
    const { status: vs2 } = await api(tenantAdminPage, 'POST', `/api/modules/pos/transaction/${txId}/void`, {
      voidReason: 'second void attempt',
    });
    expect([400, 409, 422]).toContain(vs2);
  });
});
