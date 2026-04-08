import {
  purchaseOrder,
  purchaseOrderItem,
  purchaseOrderAmendment,
  supplier,
  location,
  taxConfig,
  approvalConfig,
  approvalLog,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { ZodError } from "zod";
import { createPoSchema, updatePoSchema, statusTransitionSchema, cancelPoSchema } from "../schemas/purchaseOrderSchema";
import { generatePoNumber } from "../lib/poNumberGenerator";
import { validateTransition, getAvailableTransitions, isEditable, isCancellable, type PoStatus } from "../lib/poStateMachine";
import { calculatePoTotals } from "../lib/poTaxCalculator";

const purchaseOrderRoutes = Router();
purchaseOrderRoutes.use(resolveTenantContext());
purchaseOrderRoutes.use(authenticated());
purchaseOrderRoutes.use(checkModuleAuthorization('purchase-order'));

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
// REORDER SUGGESTIONS (STUB)
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po/suggestions:
 *   get:
 *     tags:
 *       - Purchase Order
 *     summary: Get reorder suggestions
 *     description: Suggests reorders when stock is below minimum threshold. Currently stubbed until inventory module is implemented.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reorder suggestions (empty until inventory module exists)
 */
purchaseOrderRoutes.get("/suggestions", authorized("ADMIN", "retail.po.view"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  res.json({
    suggestions: [],
    message: "Reorder suggestions will be available after the Inventory Management module is implemented.",
  });
});

// ============================================================
// LIST PURCHASE ORDERS
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po:
 *   get:
 *     tags:
 *       - Purchase Order
 *     summary: List purchase orders
 *     description: Retrieve a paginated list of purchase orders with filtering and sorting
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: orderDate
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A paginated list of purchase orders
 */
purchaseOrderRoutes.get("/", authorized("ADMIN", "retail.po.view"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = (req.query.sort as string) || 'orderDate';
  const orderParam = (req.query.order as string) || 'desc';
  const filterParam = (req.query.filter as string) || '';
  const statusParam = req.query.status as string | undefined;

  const sortColumns = {
    id: purchaseOrder.id,
    poNumber: purchaseOrder.poNumber,
    orderDate: purchaseOrder.orderDate,
    totalAmount: purchaseOrder.totalAmount,
    status: purchaseOrder.status,
    createdAt: purchaseOrder.createdAt,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || purchaseOrder.orderDate;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (filterParam) {
      conditions.push(
        or(
          ilike(purchaseOrder.poNumber, `%${filterParam}%`),
          ilike(supplier.name, `%${filterParam}%`),
        )
      );
    }

    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(purchaseOrder.status, statusParam));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(purchaseOrder)
      .leftJoin(supplier, eq(purchaseOrder.supplierId, supplier.id))
      .where(whereCondition);

    const orders = await req.tenantDb
      .select({
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier.name,
        locationId: purchaseOrder.locationId,
        status: purchaseOrder.status,
        orderDate: purchaseOrder.orderDate,
        expectedDeliveryDate: purchaseOrder.expectedDeliveryDate,
        subtotal: purchaseOrder.subtotal,
        taxAmount: purchaseOrder.taxAmount,
        discountAmount: purchaseOrder.discountAmount,
        totalAmount: purchaseOrder.totalAmount,
        version: purchaseOrder.version,
        createdAt: purchaseOrder.createdAt,
        updatedAt: purchaseOrder.updatedAt,
      })
      .from(purchaseOrder)
      .leftJoin(supplier, eq(purchaseOrder.supplierId, supplier.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(perPage)
      .offset(offset);

    res.json({
      orders,
      count: total,
      page,
      perPage,
      sort: sortParam,
      order: orderParam,
      filter: filterParam,
      status: statusParam,
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET PURCHASE ORDER DETAIL
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po/{id}:
 *   get:
 *     tags:
 *       - Purchase Order
 *     summary: Get purchase order detail
 *     description: Retrieve a specific purchase order with items, supplier, location, and amendments
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
 *         description: Purchase order detail
 *       404:
 *         description: Purchase order not found
 */
purchaseOrderRoutes.get("/:id", authorized("ADMIN", "retail.po.view"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const po = await req.tenantDb.query.purchaseOrder.findFirst({
      where: eq(purchaseOrder.id, idParam),
      with: {
        supplier: true,
        location: true,
        items: true,
        amendments: {
          orderBy: [desc(purchaseOrderAmendment.version)],
        },
        createdByUser: {
          columns: { id: true, username: true, fullname: true },
        },
        cancelledByUser: {
          columns: { id: true, username: true, fullname: true },
        },
      },
    });

    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    // Also return available transitions
    const availableTransitions = getAvailableTransitions(po.status as PoStatus);

    res.json({ ...po, availableTransitions });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CREATE PURCHASE ORDER
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po:
 *   post:
 *     tags:
 *       - Purchase Order
 *     summary: Create a new purchase order
 *     description: Create a PO in draft status with auto-generated PO number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Purchase order created successfully
 *       400:
 *         description: Validation error
 */
purchaseOrderRoutes.post("/", authorized("ADMIN", "retail.po.create"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  // Validate request body
  const parsed = createPoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Generate PO number
    const poNumber = await generatePoNumber(req.tenantDb);

    // Fetch active tax config
    const activeTax = await req.tenantDb
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.status, 'active'))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    // Calculate totals
    const itemInputs = parsed.data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    }));

    const calculation = calculatePoTotals(
      itemInputs,
      activeTax ? { ratePercent: activeTax.ratePercent, calcMode: activeTax.calcMode } : null,
    );

    // Insert PO and items in a transaction
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newPo] = await tx.insert(purchaseOrder).values({
        poNumber,
        supplierId: parsed.data.supplierId,
        locationId: parsed.data.locationId || null,
        status: 'draft',
        orderDate: new Date(parsed.data.orderDate),
        expectedDeliveryDate: parsed.data.expectedDeliveryDate
          ? new Date(parsed.data.expectedDeliveryDate)
          : null,
        subtotal: String(calculation.subtotal),
        taxAmount: String(calculation.taxAmount),
        discountAmount: String(calculation.discountAmount),
        totalAmount: String(calculation.totalAmount),
        taxConfigId: activeTax?.id || null,
        taxRatePercent: activeTax ? String(activeTax.ratePercent) : null,
        taxCalcMode: activeTax?.calcMode || null,
        notes: parsed.data.notes || null,
        version: 1,
        createdBy: currentUserId,
      }).returning();

      // Insert line items
      const itemValues = parsed.data.items.map((item, idx) => ({
        purchaseOrderId: newPo.id,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        quantity: item.quantity,
        receivedQuantity: 0,
        unitPrice: String(item.unitPrice),
        discountPercent: String(item.discountPercent || 0),
        discountAmount: String(calculation.items[idx].discountAmount),
        taxAmount: String(calculation.items[idx].taxAmount),
        lineTotal: String(calculation.items[idx].lineTotal),
        uom: item.uom || 'pcs',
        supplierSku: item.supplierSku || null,
        notes: item.notes || null,
      }));

      const items = await tx.insert(purchaseOrderItem).values(itemValues).returning();

      return { ...newPo, items };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating purchase order:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// UPDATE PURCHASE ORDER (AMENDMENT)
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po/{id}:
 *   put:
 *     tags:
 *       - Purchase Order
 *     summary: Update a purchase order
 *     description: Update PO details and items. Only allowed when status is draft or approved. Creates an amendment record.
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
 *         description: Purchase order updated
 *       400:
 *         description: Validation error or PO not editable
 *       404:
 *         description: Purchase order not found
 */
purchaseOrderRoutes.put("/:id", authorized("ADMIN", "retail.po.edit"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  // Validate request body
  const parsed = updatePoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    // Fetch existing PO
    const existingPo = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existingPo) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!isEditable(existingPo.status as PoStatus)) {
      return res.status(400).json({
        error: `Cannot edit purchase order in '${existingPo.status}' status. Only draft or approved POs can be edited.`,
      });
    }

    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Fetch active tax config
    const activeTax = await req.tenantDb
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.status, 'active'))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    // Calculate new totals
    const itemInputs = parsed.data.items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
    }));

    const calculation = calculatePoTotals(
      itemInputs,
      activeTax ? { ratePercent: activeTax.ratePercent, calcMode: activeTax.calcMode } : null,
    );

    const result = await req.tenantDb.transaction(async (tx: any) => {
      // Snapshot current state for amendment history
      const currentItems = await tx
        .select()
        .from(purchaseOrderItem)
        .where(eq(purchaseOrderItem.purchaseOrderId, idParam));

      await tx.insert(purchaseOrderAmendment).values({
        purchaseOrderId: idParam,
        version: existingPo.version,
        changedBy: currentUserId,
        changeReason: parsed.data.changeReason,
        snapshot: { ...existingPo, items: currentItems },
      });

      // Delete old items
      await tx.delete(purchaseOrderItem).where(eq(purchaseOrderItem.purchaseOrderId, idParam));

      // Insert new items
      const itemValues = parsed.data.items.map((item, idx) => ({
        purchaseOrderId: idParam,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        quantity: item.quantity,
        receivedQuantity: 0,
        unitPrice: String(item.unitPrice),
        discountPercent: String(item.discountPercent || 0),
        discountAmount: String(calculation.items[idx].discountAmount),
        taxAmount: String(calculation.items[idx].taxAmount),
        lineTotal: String(calculation.items[idx].lineTotal),
        uom: item.uom || 'pcs',
        supplierSku: item.supplierSku || null,
        notes: item.notes || null,
      }));

      const newItems = await tx.insert(purchaseOrderItem).values(itemValues).returning();

      // Update PO header
      const [updatedPo] = await tx
        .update(purchaseOrder)
        .set({
          supplierId: parsed.data.supplierId || existingPo.supplierId,
          locationId: parsed.data.locationId !== undefined ? parsed.data.locationId : existingPo.locationId,
          orderDate: parsed.data.orderDate ? new Date(parsed.data.orderDate) : existingPo.orderDate,
          expectedDeliveryDate: parsed.data.expectedDeliveryDate !== undefined
            ? (parsed.data.expectedDeliveryDate ? new Date(parsed.data.expectedDeliveryDate) : null)
            : existingPo.expectedDeliveryDate,
          notes: parsed.data.notes !== undefined ? parsed.data.notes : existingPo.notes,
          subtotal: String(calculation.subtotal),
          taxAmount: String(calculation.taxAmount),
          discountAmount: String(calculation.discountAmount),
          totalAmount: String(calculation.totalAmount),
          taxConfigId: activeTax?.id || null,
          taxRatePercent: activeTax ? String(activeTax.ratePercent) : null,
          taxCalcMode: activeTax?.calcMode || null,
          version: existingPo.version + 1,
        })
        .where(eq(purchaseOrder.id, idParam))
        .returning();

      return { ...updatedPo, items: newItems };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating purchase order:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// STATUS TRANSITION
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po/{id}/status:
 *   put:
 *     tags:
 *       - Purchase Order
 *     summary: Transition PO status
 *     description: Change the status of a purchase order. Validates against the state machine. Integrates with approval engine.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               reason:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status updated
 *       202:
 *         description: Approval required
 *       400:
 *         description: Invalid transition
 */
purchaseOrderRoutes.put("/:id/status", authorized("ADMIN", "retail.po.edit"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = statusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const existingPo = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existingPo) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    const currentStatus = existingPo.status as PoStatus;
    const targetStatus = parsed.data.status as PoStatus;

    // Handle cancellation
    if (targetStatus === 'cancelled') {
      if (!isCancellable(currentStatus)) {
        return res.status(400).json({
          error: `Cannot cancel purchase order in '${currentStatus}' status.`,
        });
      }
      if (!parsed.data.reason) {
        return res.status(400).json({ error: "Cancellation reason is required." });
      }

      const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);

      const [updatedPo] = await req.tenantDb
        .update(purchaseOrder)
        .set({
          status: 'cancelled',
          cancellationReason: parsed.data.reason,
          cancelledAt: new Date(),
          cancelledBy: currentUserId,
        })
        .where(eq(purchaseOrder.id, idParam))
        .returning();

      return res.status(200).json(updatedPo);
    }

    // Handle approval flow: draft -> approved
    if (currentStatus === 'draft' && targetStatus === 'approved') {
      // Check if approval is required
      const config = await req.tenantDb
        .select()
        .from(approvalConfig)
        .where(
          and(
            eq(approvalConfig.transactionType, 'purchase_order'),
            eq(approvalConfig.isRequired, true),
          )
        )
        .limit(1)
        .then((rows: any[]) => rows[0]);

      if (config) {
        const threshold = config.thresholdAmount ? parseFloat(config.thresholdAmount) : 0;
        const poTotal = parseFloat(existingPo.totalAmount);

        if (!config.thresholdAmount || poTotal >= threshold) {
          // Approval required - set to pending_approval
          const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);

          await req.tenantDb.insert(approvalLog).values({
            transactionType: 'purchase_order',
            transactionId: idParam,
            requestedBy: currentUserId,
            action: 'pending',
          });

          const [updatedPo] = await req.tenantDb
            .update(purchaseOrder)
            .set({ status: 'pending_approval' })
            .where(eq(purchaseOrder.id, idParam))
            .returning();

          return res.status(202).json({
            message: "Approval required. Your request has been submitted for review.",
            purchaseOrder: updatedPo,
          });
        }
      }

      // No approval needed - go directly to approved
      const [updatedPo] = await req.tenantDb
        .update(purchaseOrder)
        .set({ status: 'approved' })
        .where(eq(purchaseOrder.id, idParam))
        .returning();

      return res.status(200).json(updatedPo);
    }

    // General state transition validation
    const transition = validateTransition(currentStatus, targetStatus);
    if (!transition.valid) {
      return res.status(400).json({ error: transition.error });
    }

    const [updatedPo] = await req.tenantDb
      .update(purchaseOrder)
      .set({ status: targetStatus })
      .where(eq(purchaseOrder.id, idParam))
      .returning();

    res.status(200).json(updatedPo);
  } catch (error) {
    console.error("Error transitioning PO status:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CANCEL PURCHASE ORDER (via DELETE)
// ============================================================

/**
 * @swagger
 * /api/modules/purchase-order/po/{id}:
 *   delete:
 *     tags:
 *       - Purchase Order
 *     summary: Cancel a purchase order
 *     description: Soft-cancel a PO with mandatory reason. Only draft or approved POs can be cancelled.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Purchase order cancelled
 *       400:
 *         description: Cannot cancel or reason missing
 */
purchaseOrderRoutes.delete("/:id", authorized("ADMIN", "retail.po.delete"), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = cancelPoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const existingPo = await req.tenantDb
      .select()
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!existingPo) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (!isCancellable(existingPo.status as PoStatus)) {
      return res.status(400).json({
        error: `Cannot cancel purchase order in '${existingPo.status}' status. Only draft or approved POs can be cancelled.`,
      });
    }

    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);

    const [updatedPo] = await req.tenantDb
      .update(purchaseOrder)
      .set({
        status: 'cancelled',
        cancellationReason: parsed.data.reason,
        cancelledAt: new Date(),
        cancelledBy: currentUserId,
      })
      .where(eq(purchaseOrder.id, idParam))
      .returning();

    res.status(200).json({ message: "Purchase order cancelled successfully", purchaseOrder: updatedPo });
  } catch (error) {
    console.error("Error cancelling purchase order:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default purchaseOrderRoutes;
