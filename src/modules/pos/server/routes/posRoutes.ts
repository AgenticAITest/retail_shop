import {
  posTransaction,
  posTransactionItem,
  posTransactionPayment,
  product,
  productVariant,
  productLocationPrice,
  productImage,
  category,
  barcode,
  inventory,
  location,
  taxConfig,
  auditLog,
  posShift,
  posHeldTransaction,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { resolveLocationScope } from "@server/middleware/locationScopeMiddleware";
import { checkoutSchema, voidTransactionSchema, holdTransactionSchema } from "../schemas/posSchema";
import { generateTransactionId } from "../lib/transactionIdGenerator";
import { calculatePosTransaction } from "../lib/taxCalculator";

const posRoutes = Router();
posRoutes.use(resolveTenantContext());
posRoutes.use(authenticated());
posRoutes.use(resolveLocationScope());
posRoutes.use(checkModuleAuthorization('pos'));

// ============================================================
// HELPER: Get current user ID from username
// ============================================================

async function getCurrentUserId(tenantDb: any, username: string): Promise<string | null> {
  const result = await tenantDb
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1)
    .then((rows: any[]) => rows[0]);
  return result?.id || null;
}

// ============================================================
// GET PRODUCTS FOR POS (search/browse)
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/products:
 *   get:
 *     tags:
 *       - POS
 *     summary: Get products for POS grid
 *     description: Search and browse products for the POS interface with location-specific pricing and inventory
 *     security:
 *       - bearerAuth: []
 */
posRoutes.get("/products", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const searchParam = (req.query.search as string) || '';
  const categoryIdParam = req.query.categoryId as string | undefined;
  const locationIdParam = req.query.locationId as string | undefined;
  const perPage = parseInt(req.query.perPage as string) || 50;
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * perPage;

  try {
    const conditions: any[] = [eq(product.status, 'active' as any)];

    if (searchParam) {
      conditions.push(
        or(
          ilike(product.name, `%${searchParam}%`),
          ilike(product.skuCode, `%${searchParam}%`),
        )
      );
    }

    if (categoryIdParam) {
      conditions.push(eq(product.categoryId, categoryIdParam));
    }

    const whereCondition = and(...conditions);

    const products = await req.tenantDb
      .select({
        id: product.id,
        skuCode: product.skuCode,
        name: product.name,
        categoryId: product.categoryId,
        categoryName: category.name,
        brand: product.brand,
        uom: product.uom,
        sellingPrice: product.sellingPrice,
        taxApplicable: product.taxApplicable,
      })
      .from(product)
      .leftJoin(category, eq(product.categoryId, category.id))
      .where(whereCondition)
      .orderBy(asc(product.name))
      .limit(perPage)
      .offset(offset);

    // Get primary images for these products
    const productIds = products.map((p: any) => p.id);
    let imageMap = new Map<string, string>();
    if (productIds.length > 0) {
      const images = await req.tenantDb
        .select({ productId: productImage.productId, imageUrl: productImage.imageUrl })
        .from(productImage)
        .where(and(
          eq(productImage.isPrimary, true),
          inArray(productImage.productId, productIds),
        ));
      for (const img of images) {
        imageMap.set(img.productId, img.imageUrl);
      }
    }

    // Get location-specific prices if locationId provided
    let priceMap = new Map<string, string>();
    if (locationIdParam && productIds.length > 0) {
      const prices = await req.tenantDb
        .select({ productId: productLocationPrice.productId, sellingPrice: productLocationPrice.sellingPrice })
        .from(productLocationPrice)
        .where(and(
          eq(productLocationPrice.locationId, locationIdParam),
          inArray(productLocationPrice.productId, productIds),
        ));
      for (const p of prices) {
        if (p.sellingPrice) priceMap.set(p.productId, p.sellingPrice);
      }
    }

    // Get inventory quantities if locationId provided
    let inventoryMap = new Map<string, number>();
    if (locationIdParam && productIds.length > 0) {
      const inv = await req.tenantDb
        .select({ productId: inventory.productId, qtyOnHand: inventory.qtyOnHand })
        .from(inventory)
        .where(and(
          eq(inventory.locationId, locationIdParam),
          inArray(inventory.productId, productIds),
        ));
      for (const i of inv) {
        inventoryMap.set(i.productId, i.qtyOnHand);
      }
    }

    const enriched = products.map((p: any) => ({
      ...p,
      sellingPrice: priceMap.get(p.id) || p.sellingPrice,
      imageUrl: imageMap.get(p.id) || null,
      qtyOnHand: inventoryMap.get(p.id) ?? null,
    }));

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(product)
      .leftJoin(category, eq(product.categoryId, category.id))
      .where(whereCondition);

    res.json({ products: enriched, count: total, page, perPage });
  } catch (error) {
    console.error("Error fetching POS products:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET CATEGORIES FOR POS
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/categories:
 *   get:
 *     tags:
 *       - POS
 *     summary: Get active categories for POS tab grid
 *     security:
 *       - bearerAuth: []
 */
posRoutes.get("/categories", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const categories = await req.tenantDb
      .select({
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        level: category.level,
        sortOrder: category.sortOrder,
      })
      .from(category)
      .where(eq(category.status, 'active' as any))
      .orderBy(asc(category.sortOrder), asc(category.name));

    res.json({ categories });
  } catch (error) {
    console.error("Error fetching POS categories:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CHECKOUT (Create completed transaction)
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/checkout:
 *   post:
 *     tags:
 *       - POS
 *     summary: Process a POS sale
 *     description: Create a completed transaction with line items and decrement inventory
 *     security:
 *       - bearerAuth: []
 */
posRoutes.post("/checkout", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Validate open shift
    const openShift = await req.tenantDb
      .select({ id: posShift.id })
      .from(posShift)
      .where(and(
        eq(posShift.cashierId, currentUserId),
        eq(posShift.locationId, parsed.data.locationId),
        eq(posShift.status, 'open' as any),
      ))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (!openShift) {
      return res.status(400).json({ error: "No open shift. Please open a shift before processing sales." });
    }

    // Get location code for transaction ID
    const loc = await req.tenantDb
      .select({ code: location.code })
      .from(location)
      .where(eq(location.id, parsed.data.locationId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!loc) {
      return res.status(404).json({ error: "Location not found." });
    }

    // Get active tax config
    const activeTaxConfig = await req.tenantDb
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.status, 'active' as any))
      .limit(1)
      .then((rows: any[]) => rows[0] || null);

    // Calculate totals
    const calcResult = calculatePosTransaction(
      parsed.data.items.map(item => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxApplicable: item.taxApplicable,
        discountType: item.discountType || null,
        discountValue: item.discountValue || 0,
      })),
      activeTaxConfig ? { ratePercent: activeTaxConfig.ratePercent, calcMode: activeTaxConfig.calcMode } : null,
      parsed.data.transactionDiscount,
    );

    // Validate total payments >= totalAmount
    const totalPayments = parsed.data.payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.round(totalPayments * 100) < Math.round(calcResult.totalAmount * 100)) {
      return res.status(400).json({
        error: `Insufficient payment. Total: ${calcResult.totalAmount}, Paid: ${totalPayments}`,
      });
    }

    // Calculate change for cash payments
    const processedPayments = parsed.data.payments.map((p, idx) => {
      let changeAmt: number | null = null;
      if (p.paymentMethod === 'cash' && p.amountTendered) {
        changeAmt = Math.round((p.amountTendered - p.amount) * 100) / 100;
        if (changeAmt < 0) changeAmt = 0;
      }
      return { ...p, changeAmount: changeAmt, sequence: idx + 1 };
    });

    const totalChange = processedPayments.reduce((sum, p) => sum + (p.changeAmount || 0), 0);
    const primaryPayment = processedPayments[0];

    // Generate transaction ID
    const transactionId = await generateTransactionId(req.tenantDb, loc.code);

    // Insert transaction + items + payments + decrement inventory atomically
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newTxn] = await tx.insert(posTransaction).values({
        transactionId,
        locationId: parsed.data.locationId,
        cashierId: currentUserId,
        shiftId: openShift.id,
        status: 'completed',
        subtotal: String(calcResult.subtotal),
        discountAmount: String(calcResult.itemDiscountTotal + calcResult.transactionDiscountAmount),
        taxAmount: String(calcResult.taxAmount),
        totalAmount: String(calcResult.totalAmount),
        // Legacy columns: store primary payment for backward compat
        paymentMethod: primaryPayment.paymentMethod,
        paymentRef: primaryPayment.paymentRef || null,
        amountTendered: primaryPayment.amountTendered ? String(primaryPayment.amountTendered) : null,
        changeAmount: totalChange > 0 ? String(totalChange) : null,
        taxConfigId: activeTaxConfig?.id || null,
        taxRatePercent: activeTaxConfig?.ratePercent || null,
        taxCalcMode: activeTaxConfig?.calcMode || null,
        notes: parsed.data.notes || null,
        completedAt: new Date(),
      }).returning();

      // Insert line items
      const itemValues = parsed.data.items.map((item, idx) => {
        const calc = calcResult.items[idx];
        return {
          posTransactionId: newTxn.id,
          productId: item.productId,
          variantId: item.variantId || null,
          skuCode: item.skuCode,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          discountType: item.discountType || null,
          discountValue: String(item.discountValue || 0),
          discountAmount: String(calc.discountAmount),
          taxAmount: String(calc.taxAmount),
          lineTotal: String(calc.lineTotal),
        };
      });

      const items = await tx.insert(posTransactionItem).values(itemValues).returning();

      // Insert payment records
      const paymentValues = processedPayments.map(p => ({
        posTransactionId: newTxn.id,
        paymentMethod: p.paymentMethod,
        amount: String(p.amount),
        paymentRef: p.paymentRef || null,
        amountTendered: p.amountTendered ? String(p.amountTendered) : null,
        changeAmount: p.changeAmount !== null ? String(p.changeAmount) : null,
        sequence: p.sequence,
      }));

      const payments = await tx.insert(posTransactionPayment).values(paymentValues).returning();

      // Decrement inventory for each item
      for (const item of parsed.data.items) {
        await tx.execute(sql`
          INSERT INTO inventory (location_id, product_id, variant_id, qty_on_hand)
          VALUES (${parsed.data.locationId}, ${item.productId}, ${item.variantId || null}, ${-item.quantity})
          ON CONFLICT (location_id, product_id) DO UPDATE
          SET qty_on_hand = inventory.qty_on_hand - ${item.quantity},
              updated_at = NOW()
        `);
      }

      return { ...newTxn, items, payments, totalChange };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error during checkout:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// LIST TRANSACTIONS
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction:
 *   get:
 *     tags:
 *       - POS
 *     summary: List POS transactions
 *     security:
 *       - bearerAuth: []
 */
posRoutes.get("/", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = (req.query.sort as string) || 'createdAt';
  const orderParam = (req.query.order as string) || 'desc';
  const filterParam = (req.query.filter as string) || '';
  const statusParam = req.query.status as string | undefined;
  const locationIdParam = req.query.locationId as string | undefined;

  const sortColumns = {
    transactionId: posTransaction.transactionId,
    status: posTransaction.status,
    totalAmount: posTransaction.totalAmount,
    createdAt: posTransaction.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || posTransaction.createdAt;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (filterParam) {
      conditions.push(
        or(
          ilike(posTransaction.transactionId, `%${filterParam}%`),
        )
      );
    }

    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(posTransaction.status, statusParam as any));
    }

    if (locationIdParam) {
      conditions.push(eq(posTransaction.locationId, locationIdParam));
    }

    if (req.locationScope) {
      conditions.push(inArray(posTransaction.locationId, req.locationScope));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(posTransaction)
      .where(whereCondition);

    const transactions = await req.tenantDb
      .select({
        id: posTransaction.id,
        transactionId: posTransaction.transactionId,
        locationId: posTransaction.locationId,
        locationName: location.name,
        status: posTransaction.status,
        subtotal: posTransaction.subtotal,
        discountAmount: posTransaction.discountAmount,
        taxAmount: posTransaction.taxAmount,
        totalAmount: posTransaction.totalAmount,
        paymentMethod: posTransaction.paymentMethod,
        cashierName: user.fullname,
        completedAt: posTransaction.completedAt,
        createdAt: posTransaction.createdAt,
      })
      .from(posTransaction)
      .leftJoin(location, eq(posTransaction.locationId, location.id))
      .leftJoin(user, eq(posTransaction.cashierId, user.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(perPage)
      .offset(offset);

    res.json({
      transactions,
      count: total,
      page,
      perPage,
      sort: sortParam,
      order: orderParam,
      filter: filterParam,
      status: statusParam,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET TRANSACTION DETAIL
// ============================================================

// ============================================================
// HOLD TRANSACTION (must be before /:id to avoid route conflict)
// ============================================================

posRoutes.post("/hold", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });
  const parsed = holdTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });
    const shiftRow = await req.tenantDb.select({ id: posShift.id }).from(posShift)
      .where(and(eq(posShift.cashierId, userId), eq(posShift.status, 'open' as any))).limit(1).then((r: any[]) => r[0]);
    const [held] = await req.tenantDb.insert(posHeldTransaction).values({
      shiftId: shiftRow?.id || null, locationId: parsed.data.locationId, cashierId: userId,
      customerNote: parsed.data.customerNote || null, cartData: parsed.data.cartData,
      totalAmount: String(parsed.data.totalAmount), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).returning();
    res.status(201).json(held);
  } catch (error) { console.error("Error holding:", error); res.status(500).json({ error: "Internal server error" }); }
});

posRoutes.get("/held", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });
    const locationId = req.query.locationId as string | undefined;
    const conditions: any[] = [eq(posHeldTransaction.cashierId, userId)];
    if (locationId) conditions.push(eq(posHeldTransaction.locationId, locationId));
    const held = await req.tenantDb.select().from(posHeldTransaction).where(and(...conditions)).orderBy(desc(posHeldTransaction.createdAt));
    res.json({ held });
  } catch (error) { console.error("Error listing held:", error); res.status(500).json({ error: "Internal server error" }); }
});

posRoutes.post("/held/:id/recall", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const held = await req.tenantDb.select().from(posHeldTransaction).where(eq(posHeldTransaction.id, req.params.id)).limit(1).then((r: any[]) => r[0]);
    if (!held) return res.status(404).json({ error: "Held transaction not found" });
    await req.tenantDb.delete(posHeldTransaction).where(eq(posHeldTransaction.id, req.params.id));
    res.json({ cartData: held.cartData, customerNote: held.customerNote, totalAmount: held.totalAmount });
  } catch (error) { console.error("Error recalling:", error); res.status(500).json({ error: "Internal server error" }); }
});

posRoutes.delete("/held/:id", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    await req.tenantDb.delete(posHeldTransaction).where(eq(posHeldTransaction.id, req.params.id));
    res.json({ message: "Held transaction released" });
  } catch (error) { console.error("Error deleting held:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// GET TRANSACTION DETAIL
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/{id}:
 *   get:
 *     tags:
 *       - POS
 *     summary: Get POS transaction detail
 *     security:
 *       - bearerAuth: []
 */
posRoutes.get("/:id", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.sale"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const txn = await req.tenantDb.query.posTransaction.findFirst({
      where: eq(posTransaction.id, req.params.id),
      with: {
        location: true,
        cashier: { columns: { id: true, username: true, fullname: true } },
        voidedByUser: { columns: { id: true, username: true, fullname: true } },
        items: true,
        payments: true,
      },
    });

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(txn);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// VOID TRANSACTION
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/{id}/void:
 *   post:
 *     tags:
 *       - POS
 *     summary: Void a completed transaction
 *     security:
 *       - bearerAuth: []
 */
posRoutes.post("/:id/void", authorized(['ADMIN', 'MANAGER'], "retail.pos.void"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = voidTransactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    const existing = await req.tenantDb
      .select()
      .from(posTransaction)
      .where(eq(posTransaction.id, req.params.id))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (existing.status !== 'completed') {
      return res.status(400).json({ error: `Cannot void a transaction in '${existing.status}' status.` });
    }

    // Void transaction and restore inventory
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(posTransaction)
        .set({
          status: 'voided',
          voidReason: parsed.data.voidReason,
          voidedAt: new Date(),
          voidedBy: currentUserId,
        })
        .where(eq(posTransaction.id, req.params.id))
        .returning();

      // Get items and restore inventory
      const items = await tx
        .select()
        .from(posTransactionItem)
        .where(eq(posTransactionItem.posTransactionId, req.params.id));

      for (const item of items) {
        await tx.execute(sql`
          UPDATE inventory
          SET qty_on_hand = inventory.qty_on_hand + ${item.quantity},
              updated_at = NOW()
          WHERE location_id = ${existing.locationId}
            AND product_id = ${item.productId}
        `);
      }

      return updated;
    });

    res.json(result);
  } catch (error) {
    console.error("Error voiding transaction:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// REPRINT RECEIPT
// ============================================================

/**
 * @swagger
 * /api/modules/pos/transaction/{id}/reprint:
 *   post:
 *     tags:
 *       - POS
 *     summary: Reprint a transaction receipt
 *     description: Marks reprint in audit log and returns full transaction data for receipt printing
 *     security:
 *       - bearerAuth: []
 */
posRoutes.post("/:id/reprint", authorized(['ADMIN', 'MANAGER', 'CASHIER'], "retail.pos.reprint"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Get full transaction with items, payments, location
    const txn = await req.tenantDb.query.posTransaction.findFirst({
      where: eq(posTransaction.id, req.params.id),
      with: {
        location: true,
        cashier: { columns: { id: true, username: true, fullname: true } },
        items: true,
        payments: true,
      },
    });

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Record reprint in audit log
    await req.tenantDb.insert(auditLog).values({
      userId: currentUserId,
      action: 'reprint',
      module: 'pos',
      entityType: 'pos_transaction',
      entityId: txn.id,
      afterData: { transactionId: txn.transactionId, reprintedBy: req.user.username },
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') || null,
    });

    res.json({ ...txn, reprinted: true });
  } catch (error) {
    console.error("Error reprinting receipt:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default posRoutes;
