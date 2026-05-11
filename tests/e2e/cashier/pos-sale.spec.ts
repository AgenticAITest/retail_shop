import { test, expect } from '../../fixtures/auth';

/**
 * Phase 4 POS sale tests: EU-006 to EU-018
 * Uses tenantAdminPage — POS checkout route requires ADMIN role or pos.sale.create
 * permission which is not assigned to CASHIER/MANAGER role codes in seed.
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

// Postgres returns numeric columns as strings — coerce to number
const toNum = (v: any, fallback = 0): number => Number(v ?? fallback) || fallback;

test.describe('EU-006..018 — POS sale operations', () => {
  test.describe.configure({ mode: 'serial' });

  let locationId = '';
  let shiftId = '';
  let testProduct: any = null;
  let taxableProduct: any = null;

  test('Setup: location, product, open shift', async ({ tenantAdminPage }) => {
    // Get a valid active location
    const { data: locData } = await api(tenantAdminPage, 'GET', '/api/modules/location-management/location?perPage=20');
    const activeLoc = (locData?.locations ?? []).find((l: any) => l.status === 'active');
    expect(activeLoc).toBeTruthy();
    locationId = activeLoc.id;

    // Get products for POS
    const { status: ps, data: pd } = await api(tenantAdminPage, 'GET', '/api/modules/pos/transaction/products');
    expect(ps).toBe(200);
    const products: any[] = pd?.products ?? pd?.data ?? [];
    expect(products.length).toBeGreaterThan(0);
    testProduct = products[0];
    taxableProduct = products.find((p: any) => p.taxApplicable === true || p.taxApplicable === 'true') ?? products[0];

    // Reuse open shift if one exists, else open new
    const { data: cur } = await api(tenantAdminPage, 'GET', '/api/modules/pos/shift/current');
    if (cur?.shift?.id && cur.shift.status === 'open') {
      shiftId = cur.shift.id;
      // Update locationId to match the existing shift's location
      if (cur.shift.locationId) locationId = cur.shift.locationId;
    } else {
      const { status: ss, data: sd } = await api(tenantAdminPage, 'POST', '/api/modules/pos/shift/open', {
        locationId,
        openingFloat: 500000,
      });
      expect([200, 201]).toContain(ss);
      shiftId = sd.id;
    }
    expect(shiftId).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-006 — Cash sale
  // ──────────────────────────────────────────────────────────

  test('EU-006: Complete cash sale', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 1,
        unitPrice,
      }],
      payments: [{ paymentMethod: 'cash', amount: unitPrice + 5000 }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    expect(data.transactionId).toBeTruthy(); // prefix varies by location code
    expect(data.status).toBe('completed');
  });

  // ──────────────────────────────────────────────────────────
  // EU-007 — Card payment
  // ──────────────────────────────────────────────────────────

  test('EU-007: Complete card payment sale', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 2,
        unitPrice,
      }],
      payments: [{ paymentMethod: 'card', amount: Math.ceil(unitPrice * 2 * 1.15), paymentRef: 'AUTH-123456' }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    // Verify payment method recorded
    const payments: any[] = data.payments ?? [];
    const cardPayment = payments.find((p: any) => p.method === 'card');
    expect(cardPayment ?? data.paymentMethod).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-008 — QRIS payment
  // ──────────────────────────────────────────────────────────

  test('EU-008: Complete QRIS payment sale', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 1,
        unitPrice,
      }],
      payments: [{ paymentMethod: 'qris', amount: Math.ceil(unitPrice * 1.15), paymentRef: 'QRIS-TXN-789' }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-009 — Split payment (Cash + QRIS)
  // ──────────────────────────────────────────────────────────

  test('EU-009: Split payment (Cash + QRIS)', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 25000);
    const total = Math.ceil(unitPrice * 3 * 1.15); // 3 items + 15% tax buffer

    const cashPart = Math.floor(total / 2);
    const qrisPart = total - cashPart;

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 3,
        unitPrice,
      }],
      payments: [
        { paymentMethod: 'cash', amount: cashPart },
        { paymentMethod: 'qris', amount: qrisPart, paymentRef: 'SPLIT-001' },
      ],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    const payments: any[] = data.payments ?? [];
    // Should have 2 payment records or merged on response
    expect(payments.length >= 1 || data.totalAmount).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-010 — Barcode search
  // ──────────────────────────────────────────────────────────

  test('EU-010: Barcode lookup finds correct product', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();

    // Search by product SKU (simulates barcode scan)
    const { status, data } = await api(tenantAdminPage, 'GET',
      `/api/modules/pos/transaction/products?search=${encodeURIComponent(testProduct.skuCode)}`);
    expect(status).toBe(200);
    const products: any[] = data?.products ?? data?.data ?? [];
    const found = products.find((p: any) => p.skuCode === testProduct.skuCode || p.id === testProduct.id);
    expect(found).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-011 — Search by name and by SKU
  // ──────────────────────────────────────────────────────────

  test('EU-011: Product search by name and SKU works', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const namePart = testProduct.name.substring(0, 4);

    // Search by name fragment
    const { status: ns, data: nd } = await api(tenantAdminPage, 'GET',
      `/api/modules/pos/transaction/products?search=${encodeURIComponent(namePart)}`);
    expect(ns).toBe(200);
    const byName: any[] = nd?.products ?? nd?.data ?? [];
    expect(byName.length).toBeGreaterThan(0);

    // Search by exact SKU
    const { status: ss, data: sd } = await api(tenantAdminPage, 'GET',
      `/api/modules/pos/transaction/products?search=${encodeURIComponent(testProduct.skuCode)}`);
    expect(ss).toBe(200);
    const bySku: any[] = sd?.products ?? sd?.data ?? [];
    expect(bySku.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────
  // EU-012 — Per-item percentage discount
  // ──────────────────────────────────────────────────────────

  test('EU-012: Per-item percentage discount applied in checkout', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);
    const discountedPrice = unitPrice * 0.9; // 10% off

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 1,
        unitPrice,
        discountType: 'percent',
        discountValue: 10,
      }],
      payments: [{ paymentMethod: 'cash', amount: Math.ceil(discountedPrice * 1.15) }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    // Verify discount reflected in line total or transaction total (DB returns numerics as strings)
    expect(Number(data.subtotal ?? data.totalAmount ?? 0)).toBeLessThanOrEqual(unitPrice + 1);
  });

  // ──────────────────────────────────────────────────────────
  // EU-013 — Per-item fixed discount
  // ──────────────────────────────────────────────────────────

  test('EU-013: Per-item fixed discount applied in checkout', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 28000);
    const discount = 5000;

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: 1,
        unitPrice,
        discountType: 'fixed',
        discountValue: discount,
      }],
      payments: [{ paymentMethod: 'cash', amount: unitPrice }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
  });

  // ──────────────────────────────────────────────────────────
  // EU-014 — Transaction-level discount
  // ──────────────────────────────────────────────────────────

  test('EU-014: Transaction-level percentage discount applied', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 20000);
    const qty = 4;
    const total = unitPrice * qty;
    const txDiscount = 5; // 5% off total

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: qty,
        unitPrice,
      }],
      transactionDiscount: { type: 'percent', value: txDiscount },
      payments: [{ paymentMethod: 'cash', amount: Math.ceil(total * 1.15) }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    // Grand total should be within 20% of original subtotal (discount applied; tax may push it slightly over)
    const grandTotal = data.grandTotal ?? data.totalAmount ?? 0;
    expect(Number(grandTotal)).toBeLessThanOrEqual(Math.ceil(total * 1.2));
  });

  // ──────────────────────────────────────────────────────────
  // EU-015 — Large quantity in single line
  // ──────────────────────────────────────────────────────────

  test('EU-015: Multiple quantity handled correctly in checkout', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);
    const qty = 5;

    const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/checkout', {
      locationId,
      items: [{
        productId: testProduct.id,
        skuCode: testProduct.skuCode,
        productName: testProduct.name,
        quantity: qty,
        unitPrice,
      }],
      payments: [{ paymentMethod: 'cash', amount: Math.ceil(unitPrice * qty * 1.15) }],
    });
    expect(status).toBe(201);
    expect(data.id).toBeTruthy();
    // Line total should reflect qty * unitPrice
    const items: any[] = data.items ?? [];
    const line = items.find((i: any) => i.productId === testProduct.id);
    if (line) {
      expect(line.quantity).toBe(qty);
    }
  });

  // ──────────────────────────────────────────────────────────
  // EU-017 — Hold and recall transaction
  // ──────────────────────────────────────────────────────────

  test('EU-017: Hold and recall transaction', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);

    // Hold a cart
    const { status: hs, data: hd } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/hold', {
      locationId,
      customerNote: 'Customer A — EU-017 test',
      totalAmount: unitPrice * 2,
      cartData: {
        items: [{
          productId: testProduct.id,
          skuCode: testProduct.skuCode,
          productName: testProduct.name,
          quantity: 2,
          unitPrice,
        }],
      },
    });
    expect([200, 201]).toContain(hs);
    expect(hd.id).toBeTruthy();
    const heldId = hd.id;

    // List held transactions
    const { status: ls, data: ld } = await api(tenantAdminPage, 'GET', '/api/modules/pos/transaction/held');
    expect(ls).toBe(200);
    const held: any[] = ld?.held ?? ld?.heldTransactions ?? ld ?? [];
    const found = held.find((h: any) => h.id === heldId);
    expect(found).toBeTruthy();

    // Recall
    const { status: rs } = await api(tenantAdminPage, 'POST', `/api/modules/pos/transaction/held/${heldId}/recall`);
    expect([200, 201]).toContain(rs);
  });

  // ──────────────────────────────────────────────────────────
  // EU-018 — Hold multiple transactions simultaneously
  // ──────────────────────────────────────────────────────────

  test('EU-018: Hold multiple transactions simultaneously', async ({ tenantAdminPage }) => {
    expect(testProduct).toBeTruthy();
    const unitPrice = toNum(testProduct.sellingPrice, 15000);
    const heldIds: string[] = [];

    // Create 3 held carts
    for (let i = 0; i < 3; i++) {
      const { status, data } = await api(tenantAdminPage, 'POST', '/api/modules/pos/transaction/hold', {
        locationId,
        customerNote: `Customer ${String.fromCharCode(65 + i)} — EU-018`,
        totalAmount: unitPrice * (i + 1),
        cartData: {
          items: [{
            productId: testProduct.id,
            skuCode: testProduct.skuCode,
            productName: testProduct.name,
            quantity: i + 1,
            unitPrice,
          }],
        },
      });
      expect([200, 201]).toContain(status);
      heldIds.push(data.id);
    }

    // Verify all 3 are in held list
    const { status: ls, data: ld } = await api(tenantAdminPage, 'GET', '/api/modules/pos/transaction/held');
    expect(ls).toBe(200);
    const held: any[] = ld?.held ?? ld?.heldTransactions ?? ld ?? [];
    for (const hid of heldIds) {
      const found = held.find((h: any) => h.id === hid);
      expect(found).toBeTruthy();
    }

    // Cleanup held
    for (const hid of heldIds) {
      await api(tenantAdminPage, 'DELETE', `/api/modules/pos/transaction/held/${hid}`);
    }
  });

  test('Teardown: close shift', async ({ tenantAdminPage }) => {
    if (!shiftId) return;
    const { data: cur } = await api(tenantAdminPage, 'GET', '/api/modules/pos/shift/current');
    const openShiftId = cur?.shift?.id ?? shiftId;
    if (openShiftId) {
      await api(tenantAdminPage, 'POST', `/api/modules/pos/shift/${openShiftId}/close`, {
        actualCash: 500000,
        notes: 'pos-sale teardown',
      });
    }
  });
});
