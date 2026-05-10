import {
  stockCount, stockCountLine, stockAdjustment, inventoryMovement, stockAlertConfig,
  inventory, product, location, purchaseOrder, purchaseOrderItem,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, inArray, lte, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { resolveLocationScope } from "@server/middleware/locationScopeMiddleware";
import { createStockCountSchema, recordCountLinesSchema, createAdjustmentSchema, alertConfigSchema } from "../schemas/inventoryMgmtSchema";

const routes = Router();
routes.use(resolveTenantContext());
routes.use(authenticated());
routes.use(resolveLocationScope());
routes.use(checkModuleAuthorization('inventory-management'));

async function getUserId(db: any, username: string): Promise<string | null> {
  const r = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1).then((r: any[]) => r[0]);
  return r?.id || null;
}

// ============================================================
// STOCK COUNTS
// ============================================================

routes.post("/stock-count", authorized("ADMIN", "retail.inventory.count"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });
  const parsed = createStockCountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    // Get all products with inventory at this location
    const products = await req.tenantDb
      .select({ id: product.id, skuCode: product.skuCode, name: product.name, uom: product.uom })
      .from(product).where(eq(product.status, 'active' as any));

    const invMap = new Map<string, number>();
    const invRows = await req.tenantDb.select().from(inventory).where(eq(inventory.locationId, parsed.data.locationId));
    for (const r of invRows) invMap.set(r.productId, r.qtyOnHand);

    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [sc] = await tx.insert(stockCount).values({
        locationId: parsed.data.locationId, status: 'in_progress', startedBy: userId, notes: parsed.data.notes || null,
      }).returning();

      const lineValues = products.map((p: any) => ({
        stockCountId: sc.id, productId: p.id, skuCode: p.skuCode, productName: p.name,
        systemQty: invMap.get(p.id) || 0, uom: p.uom || 'pcs',
      }));

      let lines: any[] = [];
      if (lineValues.length > 0) {
        lines = await tx.insert(stockCountLine).values(lineValues).returning();
      }

      return { ...sc, lines };
    });

    res.status(201).json(result);
  } catch (error) { console.error("Error creating stock count:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.get("/stock-count", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const statusParam = req.query.status as string | undefined;
  const offset = (page - 1) * perPage;

  try {
    const conditions: any[] = [];
    if (statusParam && statusParam !== 'all') conditions.push(eq(stockCount.status, statusParam as any));
    if (req.locationScope) conditions.push(inArray(stockCount.locationId, req.locationScope));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb.select({ value: count() }).from(stockCount).where(where);

    const counts = await req.tenantDb
      .select({
        id: stockCount.id, locationName: location.name, status: stockCount.status,
        startedAt: stockCount.startedAt, finalizedAt: stockCount.finalizedAt,
        startedByName: user.fullname,
      })
      .from(stockCount)
      .leftJoin(location, eq(stockCount.locationId, location.id))
      .leftJoin(user, eq(stockCount.startedBy, user.id))
      .where(where)
      .orderBy(desc(stockCount.startedAt))
      .limit(perPage).offset(offset);

    res.json({ stockCounts: counts, count: total, page, perPage });
  } catch (error) { console.error("Error listing counts:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.get("/stock-count/:id", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  try {
    const sc = await req.tenantDb.query.stockCount.findFirst({
      where: eq(stockCount.id, req.params.id),
      with: { location: true, startedByUser: { columns: { id: true, fullname: true } }, finalizedByUser: { columns: { id: true, fullname: true } }, lines: true },
    });
    if (!sc) return res.status(404).json({ error: "Stock count not found" });
    res.json(sc);
  } catch (error) { console.error("Error fetching count:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.put("/stock-count/:id/lines", authorized("ADMIN", "retail.inventory.count"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const parsed = recordCountLinesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    for (const line of parsed.data.lines) {
      await req.tenantDb.update(stockCountLine).set({
        countedQty: line.countedQty,
        varianceQty: sql`${line.countedQty} - ${stockCountLine.systemQty}`,
      }).where(and(
        eq(stockCountLine.stockCountId, req.params.id),
        eq(stockCountLine.productId, line.productId),
      ));
    }
    res.json({ message: "Count lines updated" });
  } catch (error) { console.error("Error updating lines:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.post("/stock-count/:id/finalize", authorized("ADMIN", "retail.inventory.count"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userId = await getUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const sc = await req.tenantDb.select().from(stockCount).where(eq(stockCount.id, req.params.id)).limit(1).then((r: any[]) => r[0]);
    if (!sc) return res.status(404).json({ error: "Stock count not found" });
    if (sc.status === 'finalized') return res.status(400).json({ error: "Already finalized" });

    const lines = await req.tenantDb.select().from(stockCountLine).where(eq(stockCountLine.stockCountId, req.params.id));

    await req.tenantDb.transaction(async (tx: any) => {
      for (const line of lines) {
        if (line.countedQty === null) continue;
        const variance = line.countedQty - line.systemQty;
        if (variance === 0) continue;

        // Update inventory
        await tx.execute(sql`
          INSERT INTO inventory (location_id, product_id, qty_on_hand)
          VALUES (${sc.locationId}, ${line.productId}, ${line.countedQty})
          ON CONFLICT (location_id, product_id) DO UPDATE
          SET qty_on_hand = ${line.countedQty}, updated_at = NOW()
        `);

        // Record adjustment
        await tx.insert(stockAdjustment).values({
          locationId: sc.locationId, productId: line.productId, skuCode: line.skuCode,
          productName: line.productName, qty: variance, reasonCode: 'correction',
          notes: `Stock count adjustment`, adjustedBy: userId,
        });

        // Record movement
        await tx.insert(inventoryMovement).values({
          locationId: sc.locationId, productId: line.productId, movementType: 'stock_count',
          qty: variance, referenceId: sc.id, referenceType: 'stock_count', balanceAfter: line.countedQty,
        });

        // Update variance on line
        await tx.update(stockCountLine).set({ varianceQty: variance }).where(eq(stockCountLine.id, line.id));
      }

      await tx.update(stockCount).set({ status: 'finalized', finalizedBy: userId, finalizedAt: new Date() })
        .where(eq(stockCount.id, req.params.id));
    });

    res.json({ message: "Stock count finalized", id: req.params.id });
  } catch (error) { console.error("Error finalizing:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// STOCK ADJUSTMENTS
// ============================================================

routes.post("/adjustment", authorized("ADMIN", "retail.inventory.adjust"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });
  const parsed = createAdjustmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const result = await req.tenantDb.transaction(async (tx: any) => {
      // Update inventory
      await tx.execute(sql`
        INSERT INTO inventory (location_id, product_id, qty_on_hand)
        VALUES (${parsed.data.locationId}, ${parsed.data.productId}, ${parsed.data.qty})
        ON CONFLICT (location_id, product_id) DO UPDATE
        SET qty_on_hand = inventory.qty_on_hand + ${parsed.data.qty}, updated_at = NOW()
      `);

      // Get new balance
      const [inv] = await tx.select({ qty: inventory.qtyOnHand }).from(inventory)
        .where(and(eq(inventory.locationId, parsed.data.locationId), eq(inventory.productId, parsed.data.productId)));

      // Record adjustment
      const [adj] = await tx.insert(stockAdjustment).values({
        locationId: parsed.data.locationId, productId: parsed.data.productId,
        skuCode: parsed.data.skuCode, productName: parsed.data.productName,
        qty: parsed.data.qty, reasonCode: parsed.data.reasonCode,
        notes: parsed.data.notes || null, adjustedBy: userId,
      }).returning();

      // Record movement
      await tx.insert(inventoryMovement).values({
        locationId: parsed.data.locationId, productId: parsed.data.productId,
        movementType: 'adjustment', qty: parsed.data.qty,
        referenceId: adj.id, referenceType: 'stock_adjustment', balanceAfter: inv?.qty || 0,
      });

      return adj;
    });

    res.status(201).json(result);
  } catch (error) { console.error("Error creating adjustment:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.get("/adjustment", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const locationId = req.query.locationId as string | undefined;

  try {
    const conditions: any[] = [];
    if (locationId) conditions.push(eq(stockAdjustment.locationId, locationId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb.select({ value: count() }).from(stockAdjustment).where(where);
    const adjustments = await req.tenantDb.select({
      id: stockAdjustment.id, skuCode: stockAdjustment.skuCode, productName: stockAdjustment.productName,
      qty: stockAdjustment.qty, reasonCode: stockAdjustment.reasonCode, notes: stockAdjustment.notes,
      locationName: location.name, adjustedByName: user.fullname, createdAt: stockAdjustment.createdAt,
    }).from(stockAdjustment)
      .leftJoin(location, eq(stockAdjustment.locationId, location.id))
      .leftJoin(user, eq(stockAdjustment.adjustedBy, user.id))
      .where(where)
      .orderBy(desc(stockAdjustment.createdAt))
      .limit(perPage).offset((page - 1) * perPage);

    res.json({ adjustments, count: total, page, perPage });
  } catch (error) { console.error("Error listing adjustments:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// MOVEMENT LEDGER
// ============================================================

routes.get("/movement", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const locationId = req.query.locationId as string | undefined;
  const productId = req.query.productId as string | undefined;
  const movementType = req.query.movementType as string | undefined;

  try {
    const conditions: any[] = [];
    if (locationId) conditions.push(eq(inventoryMovement.locationId, locationId));
    if (productId) conditions.push(eq(inventoryMovement.productId, productId));
    if (movementType && movementType !== 'all') conditions.push(eq(inventoryMovement.movementType, movementType as any));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb.select({ value: count() }).from(inventoryMovement).where(where);

    const movements = await req.tenantDb.select({
      id: inventoryMovement.id, movementType: inventoryMovement.movementType,
      qty: inventoryMovement.qty, balanceAfter: inventoryMovement.balanceAfter,
      referenceId: inventoryMovement.referenceId, referenceType: inventoryMovement.referenceType,
      locationName: location.name, productName: product.name, skuCode: product.skuCode,
      createdAt: inventoryMovement.createdAt,
    }).from(inventoryMovement)
      .leftJoin(location, eq(inventoryMovement.locationId, location.id))
      .leftJoin(product, eq(inventoryMovement.productId, product.id))
      .where(where)
      .orderBy(desc(inventoryMovement.createdAt))
      .limit(perPage).offset((page - 1) * perPage);

    res.json({ movements, count: total, page, perPage });
  } catch (error) { console.error("Error listing movements:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// ALERT CONFIG
// ============================================================

routes.post("/alert-config", authorized("ADMIN", "retail.inventory.alerts"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const parsed = alertConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    // Upsert
    const existing = await req.tenantDb.select().from(stockAlertConfig)
      .where(and(eq(stockAlertConfig.locationId, parsed.data.locationId), eq(stockAlertConfig.productId, parsed.data.productId)))
      .limit(1).then((r: any[]) => r[0]);

    if (existing) {
      const [updated] = await req.tenantDb.update(stockAlertConfig).set({
        minQty: parsed.data.minQty, maxQty: parsed.data.maxQty ?? null, isActive: parsed.data.isActive,
      }).where(eq(stockAlertConfig.id, existing.id)).returning();
      return res.json(updated);
    }

    const [created] = await req.tenantDb.insert(stockAlertConfig).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (error) { console.error("Error saving alert config:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.get("/alert-config", authorized("ADMIN", "retail.inventory.alerts"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const locationId = req.query.locationId as string | undefined;

  try {
    const conditions: any[] = [eq(stockAlertConfig.isActive, true)];
    if (locationId) conditions.push(eq(stockAlertConfig.locationId, locationId));

    const configs = await req.tenantDb.select({
      id: stockAlertConfig.id, minQty: stockAlertConfig.minQty, maxQty: stockAlertConfig.maxQty,
      locationName: location.name, productName: product.name, skuCode: product.skuCode,
      productId: stockAlertConfig.productId, locationId: stockAlertConfig.locationId,
    }).from(stockAlertConfig)
      .leftJoin(location, eq(stockAlertConfig.locationId, location.id))
      .leftJoin(product, eq(stockAlertConfig.productId, product.id))
      .where(and(...conditions));

    res.json({ configs });
  } catch (error) { console.error("Error listing alerts:", error); res.status(500).json({ error: "Internal server error" }); }
});

routes.get("/alerts", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    // Find products below min threshold
    const alerts = await req.tenantDb.execute(sql`
      SELECT sac.id, sac.min_qty, sac.max_qty, l.name as location_name, p.name as product_name,
        p.sku_code, COALESCE(i.qty_on_hand, 0) as qty_on_hand
      FROM stock_alert_configs sac
      JOIN locations l ON sac.location_id = l.id
      JOIN products p ON sac.product_id = p.id
      LEFT JOIN inventory i ON i.location_id = sac.location_id AND i.product_id = sac.product_id
      WHERE sac.is_active = true AND COALESCE(i.qty_on_hand, 0) <= sac.min_qty
      ORDER BY COALESCE(i.qty_on_hand, 0) ASC
    `);

    res.json({ alerts, count: alerts.length });
  } catch (error) { console.error("Error checking alerts:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// CONSOLIDATED INVENTORY
// ============================================================

routes.get("/consolidated", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });
  const search = (req.query.search as string) || '';
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const offset = (page - 1) * perPage;

  try {
    // On-order quantities from open POs
    const onOrderRows = await req.tenantDb.execute(sql`
      SELECT poi.product_id, SUM(poi.quantity - poi.received_quantity) as on_order
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_order_id = po.id
      WHERE po.status IN ('sent', 'partially_received')
      GROUP BY poi.product_id
    `);
    const onOrderMap = new Map<string, number>();
    for (const r of onOrderRows) onOrderMap.set(r.product_id as string, Number(r.on_order));

    // Build query with optional search
    const searchCondition = search
      ? sql`WHERE p.status = 'active' AND (p.name ILIKE ${'%' + search + '%'} OR p.sku_code ILIKE ${'%' + search + '%'})`
      : sql`WHERE p.status = 'active'`;

    // Count total
    const [{ total: totalCount }] = await req.tenantDb.execute(sql`
      SELECT COUNT(DISTINCT p.id) as total FROM products p ${searchCondition}
    `);

    // Aggregated inventory per product
    const rows = await req.tenantDb.execute(sql`
      SELECT p.id as product_id, p.sku_code, p.name, p.base_cost_price,
        COALESCE(SUM(i.qty_on_hand), 0) as total_on_hand,
        COALESCE(SUM(i.in_transit), 0) as total_in_transit
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      ${searchCondition}
      GROUP BY p.id, p.sku_code, p.name, p.base_cost_price
      ORDER BY p.name ASC
      LIMIT ${perPage} OFFSET ${offset}
    `);

    const consolidated = rows.map((r: any) => {
      const onHand = Number(r.total_on_hand);
      const inTransit = Number(r.total_in_transit);
      const onOrder = onOrderMap.get(r.product_id) || 0;
      const costPrice = Number(r.base_cost_price) || 0;
      return {
        productId: r.product_id,
        skuCode: r.sku_code,
        name: r.name,
        totalOnHand: onHand,
        totalInTransit: inTransit,
        totalOnOrder: onOrder,
        available: onHand, // reserved not yet implemented
        totalValue: Math.round(onHand * costPrice * 100) / 100,
        costPrice,
      };
    });

    res.json({ consolidated, count: Number(totalCount), page, perPage });
  } catch (error) { console.error("Error fetching consolidated:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// CONSOLIDATED PER-PRODUCT DRILL-DOWN
// ============================================================

routes.get("/consolidated/:productId", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const productId = req.params.productId;

    // Product info
    const prod = await req.tenantDb.select().from(product).where(eq(product.id, productId)).limit(1).then((r: any[]) => r[0]);
    if (!prod) return res.status(404).json({ error: "Product not found" });

    // Per-location inventory
    const locations = await req.tenantDb.execute(sql`
      SELECT l.id as location_id, l.name as location_name, l.code as location_code,
        COALESCE(i.qty_on_hand, 0) as qty_on_hand,
        COALESCE(i.in_transit, 0) as in_transit
      FROM locations l
      LEFT JOIN inventory i ON i.location_id = l.id AND i.product_id = ${productId}
      WHERE l.status = 'active'
      ORDER BY l.name
    `);

    // On-order per location
    const onOrderRows = await req.tenantDb.execute(sql`
      SELECT po.location_id, SUM(poi.quantity - poi.received_quantity) as on_order
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_order_id = po.id
      WHERE poi.product_id = ${productId} AND po.status IN ('sent', 'partially_received')
      GROUP BY po.location_id
    `);
    const onOrderMap = new Map<string, number>();
    for (const r of onOrderRows) onOrderMap.set(r.location_id as string, Number(r.on_order));

    const breakdown = (locations as any[]).map((l: any) => ({
      locationId: l.location_id,
      locationName: l.location_name,
      locationCode: l.location_code,
      qtyOnHand: Number(l.qty_on_hand),
      inTransit: Number(l.in_transit),
      onOrder: onOrderMap.get(l.location_id) || 0,
    }));

    res.json({
      product: { id: prod.id, skuCode: prod.skuCode, name: prod.name, baseCostPrice: prod.baseCostPrice },
      breakdown,
      totals: {
        totalOnHand: breakdown.reduce((s, b) => s + b.qtyOnHand, 0),
        totalInTransit: breakdown.reduce((s, b) => s + b.inTransit, 0),
        totalOnOrder: breakdown.reduce((s, b) => s + b.onOrder, 0),
      },
    });
  } catch (error) { console.error("Error fetching breakdown:", error); res.status(500).json({ error: "Internal server error" }); }
});

// ============================================================
// INVENTORY VALUATION
// ============================================================

routes.get("/valuation", authorized("ADMIN", "retail.inventory.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    // Total valuation
    const [totals] = await req.tenantDb.execute(sql`
      SELECT
        COALESCE(SUM(i.qty_on_hand * CAST(p.base_cost_price AS NUMERIC)), 0) as total_value,
        COALESCE(SUM(i.qty_on_hand), 0) as total_units,
        COUNT(DISTINCT i.product_id) as total_products
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.qty_on_hand != 0
    `);

    // Per-location breakdown
    const byLocation = await req.tenantDb.execute(sql`
      SELECT l.id as location_id, l.name as location_name,
        COALESCE(SUM(i.qty_on_hand * CAST(p.base_cost_price AS NUMERIC)), 0) as value,
        COALESCE(SUM(i.qty_on_hand), 0) as units,
        COUNT(DISTINCT i.product_id) as products
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN locations l ON i.location_id = l.id
      WHERE i.qty_on_hand != 0
      GROUP BY l.id, l.name
      ORDER BY value DESC
    `);

    res.json({
      method: 'weighted_average_cost',
      totals: {
        totalValue: Math.round(Number(totals.total_value) * 100) / 100,
        totalUnits: Number(totals.total_units),
        totalProducts: Number(totals.total_products),
      },
      byLocation: (byLocation as any[]).map((r: any) => ({
        locationId: r.location_id,
        locationName: r.location_name,
        value: Math.round(Number(r.value) * 100) / 100,
        units: Number(r.units),
        products: Number(r.products),
      })),
    });
  } catch (error) { console.error("Error fetching valuation:", error); res.status(500).json({ error: "Internal server error" }); }
});

export default routes;
