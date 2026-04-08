import {
  posTransaction,
  posTransactionItem,
  posTransactionPayment,
  posShift,
  product,
  category,
  taxConfig,
  inventory,
  syncLog,
  location,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, eq, gt, sql, count } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { syncPushSchema, syncPullSchema } from "../schemas/posSchema";
import { generateTransactionId } from "../lib/transactionIdGenerator";
import { calculatePosTransaction } from "../lib/taxCalculator";

const syncRoutes = Router();
syncRoutes.use(resolveTenantContext());
syncRoutes.use(authenticated());
syncRoutes.use(checkModuleAuthorization('pos'));

async function getCurrentUserId(tenantDb: any, username: string): Promise<string | null> {
  const result = await tenantDb.select({ id: user.id }).from(user)
    .where(eq(user.username, username)).limit(1).then((r: any[]) => r[0]);
  return result?.id || null;
}

// ============================================================
// PUSH — Accept offline transactions from client
// ============================================================

/**
 * @swagger
 * /api/modules/pos/sync/push:
 *   post:
 *     tags: [Sync]
 *     summary: Push offline transactions to server
 *     description: Accepts batched offline transactions with UUID-based deduplication
 */
syncRoutes.post("/push", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = syncPushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const loc = await req.tenantDb.select({ code: location.code }).from(location)
      .where(eq(location.id, parsed.data.locationId)).limit(1).then((r: any[]) => r[0]);
    if (!loc) return res.status(404).json({ error: "Location not found" });

    const accepted: string[] = [];
    const rejected: { offlineId: string; reason: string }[] = [];

    for (const item of parsed.data.items) {
      try {
        if (item.type === 'transaction') {
          // Check for duplicate (idempotency)
          const existing = await req.tenantDb.select({ id: posTransaction.id }).from(posTransaction)
            .where(eq(posTransaction.notes, `offline:${item.offlineId}`)).limit(1).then((r: any[]) => r[0]);

          if (existing) {
            rejected.push({ offlineId: item.offlineId, reason: 'Duplicate: already processed' });
            continue;
          }

          const txnData = item.data;

          // Get active tax config
          const activeTax = await req.tenantDb.select().from(taxConfig)
            .where(eq(taxConfig.status, 'active' as any)).limit(1).then((r: any[]) => r[0] || null);

          // Calculate totals
          const calcResult = calculatePosTransaction(
            (txnData.items || []).map((i: any) => ({
              quantity: i.quantity, unitPrice: i.unitPrice, taxApplicable: i.taxApplicable ?? true,
              discountType: i.discountType || null, discountValue: i.discountValue || 0,
            })),
            activeTax ? { ratePercent: activeTax.ratePercent, calcMode: activeTax.calcMode } : null,
            txnData.transactionDiscount,
          );

          const transactionId = await generateTransactionId(req.tenantDb, loc.code);

          await req.tenantDb.transaction(async (tx: any) => {
            // Insert transaction
            const primaryPayment = txnData.payments?.[0];
            const [newTxn] = await tx.insert(posTransaction).values({
              transactionId,
              locationId: parsed.data.locationId,
              cashierId: userId,
              shiftId: txnData.shiftId || null,
              status: 'completed',
              subtotal: String(calcResult.subtotal),
              discountAmount: String(calcResult.itemDiscountTotal + calcResult.transactionDiscountAmount),
              taxAmount: String(calcResult.taxAmount),
              totalAmount: String(calcResult.totalAmount),
              paymentMethod: primaryPayment?.paymentMethod || 'cash',
              paymentRef: primaryPayment?.paymentRef || null,
              taxConfigId: activeTax?.id || null,
              taxRatePercent: activeTax?.ratePercent || null,
              taxCalcMode: activeTax?.calcMode || null,
              notes: `offline:${item.offlineId}`,
              completedAt: new Date(txnData.completedAt || Date.now()),
            }).returning();

            // Insert items
            for (const [idx, lineItem] of (txnData.items || []).entries()) {
              const calc = calcResult.items[idx];
              await tx.insert(posTransactionItem).values({
                posTransactionId: newTxn.id,
                productId: lineItem.productId,
                variantId: lineItem.variantId || null,
                skuCode: lineItem.skuCode,
                productName: lineItem.productName,
                quantity: lineItem.quantity,
                unitPrice: String(lineItem.unitPrice),
                discountType: lineItem.discountType || null,
                discountValue: String(lineItem.discountValue || 0),
                discountAmount: String(calc?.discountAmount || 0),
                taxAmount: String(calc?.taxAmount || 0),
                lineTotal: String(calc?.lineTotal || 0),
              });
            }

            // Insert payments
            for (const [idx, payment] of (txnData.payments || []).entries()) {
              await tx.insert(posTransactionPayment).values({
                posTransactionId: newTxn.id,
                paymentMethod: payment.paymentMethod,
                amount: String(payment.amount),
                paymentRef: payment.paymentRef || null,
                amountTendered: payment.amountTendered ? String(payment.amountTendered) : null,
                changeAmount: payment.changeAmount ? String(payment.changeAmount) : null,
                sequence: idx + 1,
              });
            }

            // Decrement inventory
            for (const lineItem of (txnData.items || [])) {
              await tx.execute(sql`
                INSERT INTO inventory (location_id, product_id, qty_on_hand)
                VALUES (${parsed.data.locationId}, ${lineItem.productId}, ${-lineItem.quantity})
                ON CONFLICT (location_id, product_id) DO UPDATE
                SET qty_on_hand = inventory.qty_on_hand - ${lineItem.quantity}, updated_at = NOW()
              `);
            }
          });

          accepted.push(item.offlineId);
        } else {
          // Unknown type
          rejected.push({ offlineId: item.offlineId, reason: `Unknown type: ${item.type}` });
        }
      } catch (err: any) {
        rejected.push({ offlineId: item.offlineId, reason: err.message || 'Processing error' });
      }
    }

    // Log sync operation
    await req.tenantDb.insert(syncLog).values({
      locationId: parsed.data.locationId,
      deviceId: parsed.data.deviceId,
      syncStart: new Date(),
      syncEnd: new Date(),
      recordsPushed: accepted.length,
      recordsPulled: 0,
      conflicts: rejected.length,
      status: 'completed',
      details: { accepted, rejected },
    });

    res.json({
      accepted,
      rejected,
      serverSyncId: crypto.randomUUID(),
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync push error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// PULL — Return server changes since last sync
// ============================================================

/**
 * @swagger
 * /api/modules/pos/sync/pull:
 *   post:
 *     tags: [Sync]
 *     summary: Pull server updates for offline cache
 *     description: Returns products, categories, tax config, and inventory updated since lastPullTimestamp
 */
syncRoutes.post("/pull", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  const parsed = syncPullSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const since = parsed.data.lastPullTimestamp ? new Date(parsed.data.lastPullTimestamp) : new Date(0);

    // Products updated since
    const products = await req.tenantDb.select({
      id: product.id, skuCode: product.skuCode, name: product.name,
      categoryId: product.categoryId, brand: product.brand, uom: product.uom,
      sellingPrice: product.sellingPrice, taxApplicable: product.taxApplicable, status: product.status,
    }).from(product).where(gt(product.updatedAt, since));

    // Categories updated since
    const categories = await req.tenantDb.select({
      id: category.id, name: category.name, parentId: category.parentId,
      level: category.level, sortOrder: category.sortOrder, status: category.status,
    }).from(category).where(gt(category.updatedAt, since));

    // Active tax config
    const activeTaxConfig = await req.tenantDb.select().from(taxConfig)
      .where(eq(taxConfig.status, 'active' as any)).limit(1).then((r: any[]) => r[0] || null);

    // Inventory for location
    let inventoryItems: any[] = [];
    if (parsed.data.locationId) {
      inventoryItems = await req.tenantDb.select({
        locationId: inventory.locationId, productId: inventory.productId, qtyOnHand: inventory.qtyOnHand,
      }).from(inventory).where(eq(inventory.locationId, parsed.data.locationId));
    }

    const timestamp = new Date().toISOString();

    res.json({
      products,
      categories,
      taxConfig: activeTaxConfig,
      inventory: inventoryItems,
      timestamp,
      counts: {
        products: products.length,
        categories: categories.length,
        inventory: inventoryItems.length,
      },
    });
  } catch (error) {
    console.error("Sync pull error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default syncRoutes;
