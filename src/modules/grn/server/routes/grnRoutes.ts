import {
  goodsReceivedNote,
  grnItem,
  purchaseOrder,
  purchaseOrderItem,
  supplier,
  location,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { createGrnSchema, grnStatusTransitionSchema } from "../schemas/grnSchema";
import { generateGrnNumber } from "../lib/grnNumberGenerator";
import { validateTransition, getAvailableTransitions, type GrnStatus } from "../lib/grnStateMachine";

const grnRoutes = Router();
grnRoutes.use(resolveTenantContext());
grnRoutes.use(authenticated());
grnRoutes.use(checkModuleAuthorization('grn'));

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
// GET RECEIVABLE ITEMS FOR A PO
// ============================================================

/**
 * @swagger
 * /api/modules/grn/grn/po/{poId}/receivable:
 *   get:
 *     tags:
 *       - Goods Received Note
 *     summary: Get receivable items for a PO
 *     description: Returns PO line items with remaining quantities available for receiving
 *     parameters:
 *       - in: path
 *         name: poId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Receivable items with remaining quantities
 */
grnRoutes.get("/po/:poId/receivable", authorized("ADMIN", "retail.grn.view"), async (req, res) => {
  const poId = req.params.poId;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    // Validate PO exists and is in receivable state
    const po = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, poId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (po.status !== 'sent' && po.status !== 'partially_received') {
      return res.status(400).json({
        error: `Purchase order is in '${po.status}' status. Only 'sent' or 'partially_received' POs can receive goods.`,
      });
    }

    // Get PO items with remaining quantities
    const items = await req.tenantDb
      .select()
      .from(purchaseOrderItem)
      .where(eq(purchaseOrderItem.purchaseOrderId, poId));

    const receivableItems = items
      .map((item: any) => ({
        purchaseOrderItemId: item.id,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        orderedQuantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        remainingQuantity: item.quantity - item.receivedQuantity,
        uom: item.uom,
      }))
      .filter((item: any) => item.remainingQuantity > 0);

    res.json({
      purchaseOrder: {
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        status: po.status,
      },
      items: receivableItems,
    });
  } catch (error) {
    console.error("Error fetching receivable items:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// LIST GRNS
// ============================================================

/**
 * @swagger
 * /api/modules/grn/grn:
 *   get:
 *     tags:
 *       - Goods Received Note
 *     summary: List goods received notes
 *     description: Retrieve a paginated list of GRNs with filtering
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A paginated list of GRNs
 */
grnRoutes.get("/", authorized("ADMIN", "retail.grn.view"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = (req.query.sort as string) || 'receivedDate';
  const orderParam = (req.query.order as string) || 'desc';
  const filterParam = (req.query.filter as string) || '';
  const statusParam = req.query.status as string | undefined;
  const poIdParam = req.query.poId as string | undefined;

  const sortColumns = {
    id: goodsReceivedNote.id,
    grnNumber: goodsReceivedNote.grnNumber,
    receivedDate: goodsReceivedNote.receivedDate,
    status: goodsReceivedNote.status,
    createdAt: goodsReceivedNote.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || goodsReceivedNote.receivedDate;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (filterParam) {
      conditions.push(
        or(
          ilike(goodsReceivedNote.grnNumber, `%${filterParam}%`),
          ilike(purchaseOrder.poNumber, `%${filterParam}%`),
        )
      );
    }

    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(goodsReceivedNote.status, statusParam));
    }

    if (poIdParam) {
      conditions.push(eq(goodsReceivedNote.purchaseOrderId, poIdParam));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(goodsReceivedNote)
      .leftJoin(purchaseOrder, eq(goodsReceivedNote.purchaseOrderId, purchaseOrder.id))
      .where(whereCondition);

    const grns = await req.tenantDb
      .select({
        id: goodsReceivedNote.id,
        grnNumber: goodsReceivedNote.grnNumber,
        purchaseOrderId: goodsReceivedNote.purchaseOrderId,
        poNumber: purchaseOrder.poNumber,
        locationId: goodsReceivedNote.locationId,
        status: goodsReceivedNote.status,
        receivedDate: goodsReceivedNote.receivedDate,
        createdAt: goodsReceivedNote.createdAt,
      })
      .from(goodsReceivedNote)
      .leftJoin(purchaseOrder, eq(goodsReceivedNote.purchaseOrderId, purchaseOrder.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(perPage)
      .offset(offset);

    res.json({
      grns,
      count: total,
      page,
      perPage,
      sort: sortParam,
      order: orderParam,
      filter: filterParam,
      status: statusParam,
    });
  } catch (error) {
    console.error("Error fetching GRNs:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET GRN DETAIL
// ============================================================

/**
 * @swagger
 * /api/modules/grn/grn/{id}:
 *   get:
 *     tags:
 *       - Goods Received Note
 *     summary: Get GRN detail
 *     description: Retrieve a specific GRN with items, PO info, and available transitions
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
 *         description: GRN detail
 *       404:
 *         description: GRN not found
 */
grnRoutes.get("/:id", authorized("ADMIN", "retail.grn.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const grn = await req.tenantDb.query.goodsReceivedNote.findFirst({
      where: eq(goodsReceivedNote.id, idParam),
      with: {
        purchaseOrder: {
          with: {
            supplier: true,
          },
        },
        location: true,
        items: true,
        createdByUser: {
          columns: { id: true, username: true, fullname: true },
        },
      },
    });

    if (!grn) {
      return res.status(404).json({ error: "Goods received note not found" });
    }

    const availableTransitions = getAvailableTransitions(grn.status as GrnStatus);

    res.json({ ...grn, availableTransitions });
  } catch (error) {
    console.error("Error fetching GRN:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CREATE GRN
// ============================================================

/**
 * @swagger
 * /api/modules/grn/grn:
 *   post:
 *     tags:
 *       - Goods Received Note
 *     summary: Create a new GRN
 *     description: Create a GRN against a purchase order in sent or partially_received status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: GRN created successfully
 *       400:
 *         description: Validation error
 */
grnRoutes.post("/", authorized("ADMIN", "retail.grn.create"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = createGrnSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Validate PO exists and is receivable
    const po = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, parsed.data.purchaseOrderId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (po.status !== 'sent' && po.status !== 'partially_received') {
      return res.status(400).json({
        error: `Purchase order is in '${po.status}' status. Only 'sent' or 'partially_received' POs can receive goods.`,
      });
    }

    // Validate each line item against PO items
    const poItems = await req.tenantDb
      .select()
      .from(purchaseOrderItem)
      .where(eq(purchaseOrderItem.purchaseOrderId, parsed.data.purchaseOrderId));

    const poItemMap = new Map(poItems.map((item: any) => [item.id, item]));

    for (const item of parsed.data.items) {
      const poItem = poItemMap.get(item.purchaseOrderItemId);
      if (!poItem) {
        return res.status(400).json({
          error: `PO item ${item.purchaseOrderItemId} not found in this purchase order.`,
        });
      }

      const remaining = poItem.quantity - poItem.receivedQuantity;
      if (item.receivedQuantity > remaining) {
        return res.status(400).json({
          error: `Received quantity (${item.receivedQuantity}) for ${item.productName} exceeds remaining quantity (${remaining}).`,
        });
      }
    }

    // Generate GRN number
    const grnNumber = await generateGrnNumber(req.tenantDb);

    // Insert GRN and items in transaction
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newGrn] = await tx.insert(goodsReceivedNote).values({
        grnNumber,
        purchaseOrderId: parsed.data.purchaseOrderId,
        locationId: parsed.data.locationId || po.locationId || null,
        status: 'draft',
        receivedDate: new Date(parsed.data.receivedDate),
        deliveryNoteRef: parsed.data.deliveryNoteRef || null,
        invoiceRef: parsed.data.invoiceRef || null,
        notes: parsed.data.notes || null,
        createdBy: currentUserId,
      }).returning();

      const itemValues = parsed.data.items.map((item) => {
        const poItem = poItemMap.get(item.purchaseOrderItemId)!;
        return {
          grnId: newGrn.id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          productId: item.productId,
          skuCode: item.skuCode,
          productName: item.productName,
          orderedQuantity: poItem.quantity,
          previouslyReceivedQuantity: poItem.receivedQuantity,
          receivedQuantity: item.receivedQuantity,
          acceptedQuantity: item.acceptedQuantity,
          rejectedQuantity: item.rejectedQuantity || 0,
          rejectionReasonCode: item.rejectionReasonCode || null,
          rejectionNotes: item.rejectionNotes || null,
          batchNumber: item.batchNumber || null,
          lotNumber: item.lotNumber || null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          uom: item.uom || 'pcs',
        };
      });

      const items = await tx.insert(grnItem).values(itemValues).returning();

      return { ...newGrn, items };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating GRN:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// STATUS TRANSITION
// ============================================================

/**
 * @swagger
 * /api/modules/grn/grn/{id}/status:
 *   put:
 *     tags:
 *       - Goods Received Note
 *     summary: Transition GRN status
 *     description: Change GRN status. The accepted->stock_updated transition updates PO received quantities.
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
grnRoutes.put("/:id/status", authorized("ADMIN", "retail.grn.transition"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = grnStatusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const existingGrn = await req.tenantDb
      .select()
      .from(goodsReceivedNote)
      .where(eq(goodsReceivedNote.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existingGrn) {
      return res.status(404).json({ error: "Goods received note not found" });
    }

    const currentStatus = existingGrn.status as GrnStatus;
    const targetStatus = parsed.data.status as GrnStatus;

    // Validate transition
    const transition = validateTransition(currentStatus, targetStatus);
    if (!transition.valid) {
      return res.status(400).json({ error: transition.error });
    }

    // Special handling: accepted -> stock_updated (update PO receivedQuantity)
    if (currentStatus === 'accepted' && targetStatus === 'stock_updated') {
      const result = await req.tenantDb.transaction(async (tx: any) => {
        // Get GRN items
        const grnItems = await tx
          .select()
          .from(grnItem)
          .where(eq(grnItem.grnId, idParam));

        // Update PO item receivedQuantity for each GRN item
        for (const item of grnItems) {
          await tx
            .update(purchaseOrderItem)
            .set({
              receivedQuantity: sql`${purchaseOrderItem.receivedQuantity} + ${item.acceptedQuantity}`,
            })
            .where(eq(purchaseOrderItem.id, item.purchaseOrderItemId));
        }

        // Check if all PO items are fully received
        const poId = existingGrn.purchaseOrderId;
        const allPoItems = await tx
          .select()
          .from(purchaseOrderItem)
          .where(eq(purchaseOrderItem.purchaseOrderId, poId));

        const allFullyReceived = allPoItems.every(
          (item: any) => item.receivedQuantity >= item.quantity
        );

        // Update PO status
        const newPoStatus = allFullyReceived ? 'fully_received' : 'partially_received';
        await tx
          .update(purchaseOrder)
          .set({ status: newPoStatus })
          .where(eq(purchaseOrder.id, poId));

        // Update GRN status
        const [updatedGrn] = await tx
          .update(goodsReceivedNote)
          .set({ status: 'stock_updated' })
          .where(eq(goodsReceivedNote.id, idParam))
          .returning();

        console.log(`[STUB] Inventory update deferred to Phase 4 Sprint 18. GRN ${existingGrn.grnNumber} accepted quantities would increment inventory at location ${existingGrn.locationId}.`);

        return { grn: updatedGrn, poStatus: newPoStatus };
      });

      return res.status(200).json({
        ...result.grn,
        message: `Stock updated. PO status changed to '${result.poStatus}'.`,
      });
    }

    // Handle quality inspection transitions
    const updateFields: any = { status: targetStatus };

    if (targetStatus === 'accepted' && parsed.data.qualityCheckPassed !== undefined) {
      updateFields.qualityCheckPassed = parsed.data.qualityCheckPassed;
      updateFields.qualityNotes = parsed.data.qualityNotes || null;
    }

    if (currentStatus === 'quality_inspection' && targetStatus === 'accepted') {
      updateFields.qualityCheckPassed = parsed.data.qualityCheckPassed ?? true;
      updateFields.qualityNotes = parsed.data.qualityNotes || null;
    }

    const [updatedGrn] = await req.tenantDb
      .update(goodsReceivedNote)
      .set(updateFields)
      .where(eq(goodsReceivedNote.id, idParam))
      .returning();

    res.status(200).json(updatedGrn);
  } catch (error) {
    console.error("Error transitioning GRN status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default grnRoutes;
