import {
  inventory,
  product,
  productVariant,
  location,
} from "@server/lib/db/schema/tenantSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { inventoryAdjustSchema } from "../schemas/posSchema";

const inventoryRoutes = Router();
inventoryRoutes.use(resolveTenantContext());
inventoryRoutes.use(authenticated());
inventoryRoutes.use(checkModuleAuthorization('pos'));

// ============================================================
// LIST INVENTORY
// ============================================================

/**
 * @swagger
 * /api/modules/pos/inventory:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: List inventory by location
 *     security:
 *       - bearerAuth: []
 */
inventoryRoutes.get("/", authorized('ADMIN', "pos.inventory.view"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const locationIdParam = req.query.locationId as string | undefined;
  const filterParam = (req.query.filter as string) || '';
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 20;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (locationIdParam) {
      conditions.push(eq(inventory.locationId, locationIdParam));
    }

    if (filterParam) {
      conditions.push(ilike(product.name, `%${filterParam}%`));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(inventory)
      .leftJoin(product, eq(inventory.productId, product.id))
      .where(whereCondition);

    const items = await req.tenantDb
      .select({
        id: inventory.id,
        locationId: inventory.locationId,
        locationName: location.name,
        productId: inventory.productId,
        productName: product.name,
        skuCode: product.skuCode,
        qtyOnHand: inventory.qtyOnHand,
        updatedAt: inventory.updatedAt,
      })
      .from(inventory)
      .leftJoin(product, eq(inventory.productId, product.id))
      .leftJoin(location, eq(inventory.locationId, location.id))
      .where(whereCondition)
      .orderBy(asc(product.name))
      .limit(perPage)
      .offset(offset);

    res.json({ inventory: items, count: total, page, perPage });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// MANUAL STOCK ADJUSTMENT
// ============================================================

/**
 * @swagger
 * /api/modules/pos/inventory/adjust:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Adjust inventory stock manually
 *     security:
 *       - bearerAuth: []
 */
inventoryRoutes.post("/adjust", authorized('ADMIN', "pos.inventory.adjust"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = inventoryAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const [result] = await req.tenantDb.execute(sql`
      INSERT INTO inventory (location_id, product_id, variant_id, qty_on_hand)
      VALUES (${parsed.data.locationId}, ${parsed.data.productId}, ${parsed.data.variantId || null}, ${parsed.data.quantity})
      ON CONFLICT (location_id, product_id) DO UPDATE
      SET qty_on_hand = ${parsed.data.quantity},
          updated_at = NOW()
      RETURNING *
    `);

    res.json({ inventory: result, message: `Stock adjusted. Reason: ${parsed.data.reason}` });
  } catch (error) {
    console.error("Error adjusting inventory:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default inventoryRoutes;
