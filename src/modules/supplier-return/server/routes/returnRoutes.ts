import {
  supplierReturn,
  supplierReturnItem,
  goodsReceivedNote,
  grnItem,
  purchaseOrder,
  supplier,
  location,
  creditNote,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { createReturnSchema, returnStatusTransitionSchema, createCreditNoteSchema } from "../schemas/returnSchema";
import { generateReturnNumber } from "../lib/returnNumberGenerator";
import { validateTransition, getAvailableTransitions, type ReturnStatus } from "../lib/returnStateMachine";

const returnRoutes = Router();
returnRoutes.use(resolveTenantContext());
returnRoutes.use(authenticated());
returnRoutes.use(checkModuleAuthorization('supplier-return'));

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
// GET RETURNABLE ITEMS FOR A GRN
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/return/grn/{grnId}/returnable:
 *   get:
 *     tags:
 *       - Supplier Returns
 *     summary: Get returnable items for a GRN
 *     description: Returns GRN line items with accepted quantities available for returning
 *     parameters:
 *       - in: path
 *         name: grnId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returnable items with available quantities
 */
returnRoutes.get("/grn/:grnId/returnable", authorized("ADMIN", "retail.supplier-return.view"), async (req, res) => {
  const grnId = req.params.grnId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    // Validate GRN exists and is in a returnable state (accepted or stock_updated)
    const grn = await req.tenantDb
      .select()
      .from(goodsReceivedNote)
      .where(eq(goodsReceivedNote.id, grnId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!grn) {
      return res.status(404).json({ error: "Goods received note not found" });
    }

    if (grn.status !== 'accepted' && grn.status !== 'stock_updated') {
      return res.status(400).json({
        error: `GRN is in '${grn.status}' status. Only 'accepted' or 'stock_updated' GRNs can have returns.`,
      });
    }

    // Get GRN items
    const items = await req.tenantDb
      .select()
      .from(grnItem)
      .where(eq(grnItem.grnId, grnId));

    // Get already returned quantities for this GRN's items
    const existingReturns = await req.tenantDb
      .select({
        grnItemId: supplierReturnItem.grnItemId,
        totalReturned: sql<number>`COALESCE(SUM(${supplierReturnItem.returnQuantity}), 0)`,
      })
      .from(supplierReturnItem)
      .innerJoin(supplierReturn, eq(supplierReturnItem.supplierReturnId, supplierReturn.id))
      .where(
        and(
          eq(supplierReturn.grnId, grnId),
          // Exclude rejected returns
          sql`${supplierReturn.status} != 'rejected'`,
        )
      )
      .groupBy(supplierReturnItem.grnItemId);

    const returnedMap = new Map(existingReturns.map((r: any) => [r.grnItemId, Number(r.totalReturned)]));

    // Get PO info
    const po = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, grn.purchaseOrderId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    const sup = await req.tenantDb
      .select()
      .from(supplier)
      .where(eq(supplier.id, po.supplierId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    const returnableItems = items
      .map((item: any) => {
        const alreadyReturned = returnedMap.get(item.id) || 0;
        return {
          grnItemId: item.id,
          productId: item.productId,
          skuCode: item.skuCode,
          productName: item.productName,
          acceptedQuantity: item.acceptedQuantity,
          alreadyReturned,
          returnableQuantity: item.acceptedQuantity - alreadyReturned,
          uom: item.uom,
        };
      })
      .filter((item: any) => item.returnableQuantity > 0);

    res.json({
      grn: {
        id: grn.id,
        grnNumber: grn.grnNumber,
        purchaseOrderId: grn.purchaseOrderId,
        poNumber: po?.poNumber,
        supplierId: po?.supplierId,
        supplierName: sup?.name,
        locationId: grn.locationId,
        status: grn.status,
      },
      items: returnableItems,
    });
  } catch (error) {
    console.error("Error fetching returnable items:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// LIST SUPPLIER RETURNS
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/return:
 *   get:
 *     tags:
 *       - Supplier Returns
 *     summary: List supplier returns
 *     description: Retrieve a paginated list of supplier returns with filtering
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A paginated list of supplier returns
 */
returnRoutes.get("/", authorized("ADMIN", "retail.supplier-return.view"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = (req.query.sort as string) || 'returnDate';
  const orderParam = (req.query.order as string) || 'desc';
  const filterParam = (req.query.filter as string) || '';
  const statusParam = req.query.status as string | undefined;

  const sortColumns = {
    id: supplierReturn.id,
    returnNumber: supplierReturn.returnNumber,
    returnDate: supplierReturn.returnDate,
    status: supplierReturn.status,
    createdAt: supplierReturn.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || supplierReturn.returnDate;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (filterParam) {
      conditions.push(
        or(
          ilike(supplierReturn.returnNumber, `%${filterParam}%`),
          ilike(supplier.name, `%${filterParam}%`),
        )
      );
    }

    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(supplierReturn.status, statusParam as any));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(supplierReturn)
      .leftJoin(supplier, eq(supplierReturn.supplierId, supplier.id))
      .where(whereCondition);

    const returns = await req.tenantDb
      .select({
        id: supplierReturn.id,
        returnNumber: supplierReturn.returnNumber,
        grnId: supplierReturn.grnId,
        grnNumber: goodsReceivedNote.grnNumber,
        supplierId: supplierReturn.supplierId,
        supplierName: supplier.name,
        status: supplierReturn.status,
        returnDate: supplierReturn.returnDate,
        createdAt: supplierReturn.createdAt,
      })
      .from(supplierReturn)
      .leftJoin(supplier, eq(supplierReturn.supplierId, supplier.id))
      .leftJoin(goodsReceivedNote, eq(supplierReturn.grnId, goodsReceivedNote.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(perPage)
      .offset(offset);

    res.json({
      returns,
      count: total,
      page,
      perPage,
      sort: sortParam,
      order: orderParam,
      filter: filterParam,
      status: statusParam,
    });
  } catch (error) {
    console.error("Error fetching supplier returns:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET SUPPLIER RETURN DETAIL
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/return/{id}:
 *   get:
 *     tags:
 *       - Supplier Returns
 *     summary: Get supplier return detail
 *     description: Retrieve a specific supplier return with items, GRN/PO info, credit notes, and available transitions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supplier return detail
 *       404:
 *         description: Supplier return not found
 */
returnRoutes.get("/:id", authorized("ADMIN", "retail.supplier-return.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const sr = await req.tenantDb.query.supplierReturn.findFirst({
      where: eq(supplierReturn.id, idParam),
      with: {
        grn: true,
        purchaseOrder: true,
        supplier: true,
        location: true,
        createdByUser: {
          columns: { id: true, username: true, fullname: true },
        },
        items: true,
        creditNotes: {
          with: {
            createdByUser: {
              columns: { id: true, username: true, fullname: true },
            },
          },
        },
      },
    });

    if (!sr) {
      return res.status(404).json({ error: "Supplier return not found" });
    }

    const availableTransitions = getAvailableTransitions(sr.status as ReturnStatus);

    res.json({ ...sr, availableTransitions });
  } catch (error) {
    console.error("Error fetching supplier return:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CREATE SUPPLIER RETURN
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/return:
 *   post:
 *     tags:
 *       - Supplier Returns
 *     summary: Create a new supplier return
 *     description: Create a supplier return against an accepted/stock_updated GRN
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Supplier return created successfully
 *       400:
 *         description: Validation error
 */
returnRoutes.post("/", authorized("ADMIN", "retail.supplier-return.create"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = createReturnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Validate GRN exists and is returnable
    const grn = await req.tenantDb
      .select()
      .from(goodsReceivedNote)
      .where(eq(goodsReceivedNote.id, parsed.data.grnId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!grn) {
      return res.status(404).json({ error: "Goods received note not found" });
    }

    if (grn.status !== 'accepted' && grn.status !== 'stock_updated') {
      return res.status(400).json({
        error: `GRN is in '${grn.status}' status. Only 'accepted' or 'stock_updated' GRNs can have returns.`,
      });
    }

    // Get GRN items for validation
    const grnItems = await req.tenantDb
      .select()
      .from(grnItem)
      .where(eq(grnItem.grnId, parsed.data.grnId));

    const grnItemMap = new Map(grnItems.map((item: any) => [item.id, item]));

    // Get already returned quantities
    const existingReturns = await req.tenantDb
      .select({
        grnItemId: supplierReturnItem.grnItemId,
        totalReturned: sql<number>`COALESCE(SUM(${supplierReturnItem.returnQuantity}), 0)`,
      })
      .from(supplierReturnItem)
      .innerJoin(supplierReturn, eq(supplierReturnItem.supplierReturnId, supplierReturn.id))
      .where(
        and(
          eq(supplierReturn.grnId, parsed.data.grnId),
          sql`${supplierReturn.status} != 'rejected'`,
        )
      )
      .groupBy(supplierReturnItem.grnItemId);

    const returnedMap = new Map(existingReturns.map((r: any) => [r.grnItemId, Number(r.totalReturned)]));

    // Validate each return item
    for (const item of parsed.data.items) {
      const grnItemRef = grnItemMap.get(item.grnItemId);
      if (!grnItemRef) {
        return res.status(400).json({
          error: `GRN item ${item.grnItemId} not found in this GRN.`,
        });
      }

      const alreadyReturned = returnedMap.get(item.grnItemId) || 0;
      const returnable = grnItemRef.acceptedQuantity - alreadyReturned;
      if (item.returnQuantity > returnable) {
        return res.status(400).json({
          error: `Return quantity (${item.returnQuantity}) for ${item.productName} exceeds returnable quantity (${returnable}).`,
        });
      }
    }

    // Get PO info from GRN
    const po = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, grn.purchaseOrderId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    // Generate return number
    const returnNumber = await generateReturnNumber(req.tenantDb);

    // Insert supplier return and items in transaction
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newReturn] = await tx.insert(supplierReturn).values({
        returnNumber,
        grnId: parsed.data.grnId,
        purchaseOrderId: grn.purchaseOrderId,
        supplierId: po.supplierId,
        locationId: grn.locationId,
        status: 'requested',
        returnDate: new Date(parsed.data.returnDate),
        notes: parsed.data.notes || null,
        createdBy: currentUserId,
      }).returning();

      const itemValues = parsed.data.items.map((item) => ({
        supplierReturnId: newReturn.id,
        grnItemId: item.grnItemId,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        returnQuantity: item.returnQuantity,
        reasonCode: item.reasonCode,
        reasonNotes: item.reasonNotes || null,
        uom: item.uom || 'pcs',
      }));

      const items = await tx.insert(supplierReturnItem).values(itemValues).returning();

      return { ...newReturn, items };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating supplier return:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// STATUS TRANSITION
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/return/{id}/status:
 *   put:
 *     tags:
 *       - Supplier Returns
 *     summary: Transition supplier return status
 *     description: Change supplier return status through its lifecycle
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid transition
 */
returnRoutes.put("/:id/status", authorized("ADMIN", "retail.supplier-return.transition"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = returnStatusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const existingReturn = await req.tenantDb
      .select()
      .from(supplierReturn)
      .where(eq(supplierReturn.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existingReturn) {
      return res.status(404).json({ error: "Supplier return not found" });
    }

    const currentStatus = existingReturn.status as ReturnStatus;
    const targetStatus = parsed.data.status as ReturnStatus;

    // Validate transition
    const transition = validateTransition(currentStatus, targetStatus);
    if (!transition.valid) {
      return res.status(400).json({ error: transition.error });
    }

    const updateFields: any = { status: targetStatus };

    // Handle specific transitions
    if (targetStatus === 'rejected') {
      updateFields.rejectionReason = parsed.data.rejectionReason || null;
    }

    if (targetStatus === 'dispatched') {
      updateFields.dispatchedAt = new Date();
      // Stub: inventory decrement deferred to Phase 4
      console.log(`[STUB] Inventory decrement deferred to Phase 4. Supplier return ${existingReturn.returnNumber} dispatched from location ${existingReturn.locationId}.`);
    }

    if (targetStatus === 'acknowledged') {
      updateFields.acknowledgedAt = new Date();
    }

    if (targetStatus === 'closed') {
      updateFields.closedAt = new Date();
    }

    const [updatedReturn] = await req.tenantDb
      .update(supplierReturn)
      .set(updateFields)
      .where(eq(supplierReturn.id, idParam))
      .returning();

    res.status(200).json(updatedReturn);
  } catch (error) {
    console.error("Error transitioning supplier return status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default returnRoutes;
