import {
  transfer,
  transferItem,
  location,
  inventory,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { createTransferSchema, transferStatusSchema } from "../schemas/transferSchema";
import { generateTransferNumber } from "../lib/transferNumberGenerator";
import { validateTransition, getAvailableTransitions, type TransferStatus } from "../lib/transferStateMachine";

const transferRoutes = Router();
transferRoutes.use(resolveTenantContext());
transferRoutes.use(authenticated());
transferRoutes.use(checkModuleAuthorization('transfer'));

async function getCurrentUserId(tenantDb: any, username: string): Promise<string | null> {
  const result = await tenantDb.select({ id: user.id }).from(user)
    .where(eq(user.username, username)).limit(1).then((r: any[]) => r[0]);
  return result?.id || null;
}

// ============================================================
// LIST TRANSFERS
// ============================================================

transferRoutes.get("/", authorized("ADMIN", "retail.transfer.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found." });

  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const sortParam = (req.query.sort as string) || 'createdAt';
  const orderParam = (req.query.order as string) || 'desc';
  const filterParam = (req.query.filter as string) || '';
  const statusParam = req.query.status as string | undefined;
  const offset = (page - 1) * perPage;

  const sortColumns = {
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    createdAt: transfer.createdAt,
  } as const;
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || transfer.createdAt;

  try {
    // Build ORM conditions for count query
    const ormConditions: any[] = [];
    if (filterParam) ormConditions.push(ilike(transfer.transferNumber, `%${filterParam}%`));
    if (statusParam && statusParam !== 'all') ormConditions.push(eq(transfer.status, statusParam as any));
    const ormWhere = ormConditions.length > 0 ? and(...ormConditions) : undefined;

    const [{ value: total }] = await req.tenantDb.select({ value: count() }).from(transfer).where(ormWhere);

    // Build raw SQL conditions using alias 't' (Drizzle ORM conditions would reference "transfers"."col" which conflicts with alias)
    const rawConditions: ReturnType<typeof sql>[] = [];
    if (filterParam) rawConditions.push(sql`t.transfer_number ILIKE ${`%${filterParam}%`}`);
    if (statusParam && statusParam !== 'all') rawConditions.push(sql`t.status = ${statusParam}`);
    const rawWhere = rawConditions.length > 0
      ? sql`WHERE ${sql.join(rawConditions, sql` AND `)}`
      : sql``;

    // Use aliases for the two location joins
    const transfers = await req.tenantDb.execute(sql`
      SELECT t.id, t.transfer_number, t.status, t.created_at,
        sl.name as source_location_name, dl.name as dest_location_name,
        u.fullname as requested_by_name
      FROM transfers t
      LEFT JOIN locations sl ON t.source_location_id = sl.id
      LEFT JOIN locations dl ON t.dest_location_id = dl.id
      LEFT JOIN sys_user u ON t.requested_by = u.id
      ${rawWhere}
      ORDER BY t.${sql.raw(sortParam === 'transferNumber' ? 'transfer_number' : sortParam === 'status' ? 'status' : 'created_at')} ${sql.raw(orderParam === 'asc' ? 'ASC' : 'DESC')}
      LIMIT ${perPage} OFFSET ${offset}
    `);

    res.json({ transfers, count: total, page, perPage, sort: sortParam, order: orderParam, filter: filterParam, status: statusParam });
  } catch (error) {
    console.error("Error listing transfers:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET TRANSFER DETAIL
// ============================================================

transferRoutes.get("/:id", authorized("ADMIN", "retail.transfer.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found." });

  try {
    const t = await req.tenantDb.query.transfer.findFirst({
      where: eq(transfer.id, req.params.id),
      with: {
        sourceLocation: true,
        destLocation: true,
        requestedByUser: { columns: { id: true, username: true, fullname: true } },
        approvedByUser: { columns: { id: true, username: true, fullname: true } },
        items: true,
      },
    });

    if (!t) return res.status(404).json({ error: "Transfer not found" });

    const availableTransitions = getAvailableTransitions(t.status as TransferStatus);
    res.json({ ...t, availableTransitions });
  } catch (error) {
    console.error("Error fetching transfer:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CREATE TRANSFER
// ============================================================

transferRoutes.post("/", authorized("ADMIN", "retail.transfer.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = createTransferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  if (parsed.data.sourceLocationId === parsed.data.destLocationId) {
    return res.status(400).json({ error: "Source and destination must be different locations." });
  }

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found." });

    const transferNumber = await generateTransferNumber(req.tenantDb);

    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newTransfer] = await tx.insert(transfer).values({
        transferNumber,
        sourceLocationId: parsed.data.sourceLocationId,
        destLocationId: parsed.data.destLocationId,
        status: 'requested',
        requestedBy: userId,
        notes: parsed.data.notes || null,
      }).returning();

      const itemValues = parsed.data.items.map(item => ({
        transferId: newTransfer.id,
        productId: item.productId,
        skuCode: item.skuCode,
        productName: item.productName,
        requestedQty: item.requestedQty,
        uom: item.uom || 'pcs',
      }));

      const items = await tx.insert(transferItem).values(itemValues).returning();
      return { ...newTransfer, items };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating transfer:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// STATUS TRANSITION
// ============================================================

transferRoutes.put("/:id/status", authorized("ADMIN", "retail.transfer.transition"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = transferStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found." });

    const existing = await req.tenantDb.select().from(transfer)
      .where(eq(transfer.id, req.params.id)).limit(1).then((r: any[]) => r[0]);
    if (!existing) return res.status(404).json({ error: "Transfer not found" });

    const currentStatus = existing.status as TransferStatus;
    const targetStatus = parsed.data.status as TransferStatus;
    const transition = validateTransition(currentStatus, targetStatus);
    if (!transition.valid) return res.status(400).json({ error: transition.error });

    const updateFields: any = { status: targetStatus };

    // === PICKING: update picked quantities ===
    if (targetStatus === 'picking' && parsed.data.pickItems) {
      await req.tenantDb.transaction(async (tx: any) => {
        for (const pi of parsed.data.pickItems!) {
          await tx.update(transferItem).set({ pickedQty: pi.pickedQty })
            .where(eq(transferItem.id, pi.transferItemId));
        }
      });
    }

    // === APPROVED ===
    if (targetStatus === 'approved') {
      updateFields.approvedBy = userId;
      updateFields.approvedAt = new Date();
    }

    // === DISPATCHED: decrement source inventory, increment in_transit ===
    if (targetStatus === 'dispatched') {
      updateFields.dispatchedAt = new Date();
      const items = await req.tenantDb.select().from(transferItem)
        .where(eq(transferItem.transferId, req.params.id));

      await req.tenantDb.transaction(async (tx: any) => {
        for (const item of items) {
          const qty = item.pickedQty || item.requestedQty;
          // Decrement source
          await tx.execute(sql`
            INSERT INTO inventory (location_id, product_id, qty_on_hand, in_transit)
            VALUES (${existing.sourceLocationId}, ${item.productId}, ${-qty}, 0)
            ON CONFLICT (location_id, product_id) DO UPDATE
            SET qty_on_hand = inventory.qty_on_hand - ${qty}, updated_at = NOW()
          `);
          // Increment in_transit at destination
          await tx.execute(sql`
            INSERT INTO inventory (location_id, product_id, qty_on_hand, in_transit)
            VALUES (${existing.destLocationId}, ${item.productId}, 0, ${qty})
            ON CONFLICT (location_id, product_id) DO UPDATE
            SET in_transit = inventory.in_transit + ${qty}, updated_at = NOW()
          `);
        }
        await tx.update(transfer).set(updateFields).where(eq(transfer.id, req.params.id));
      });

      const [updated] = await req.tenantDb.select().from(transfer).where(eq(transfer.id, req.params.id));
      return res.json(updated);
    }

    // === RECEIVED: decrement in_transit, increment dest inventory, record discrepancies ===
    if (targetStatus === 'received') {
      updateFields.receivedAt = new Date();

      await req.tenantDb.transaction(async (tx: any) => {
        const items = await tx.select().from(transferItem)
          .where(eq(transferItem.transferId, req.params.id));

        for (const item of items) {
          const receiveData = parsed.data.receiveItems?.find((r: any) => r.transferItemId === item.id);
          const receivedQty = receiveData?.receivedQty ?? (item.pickedQty || item.requestedQty);
          const expectedQty = item.pickedQty || item.requestedQty;
          const discrepancy = receivedQty - expectedQty;

          await tx.update(transferItem).set({
            receivedQty,
            discrepancyQty: discrepancy,
            discrepancyReason: receiveData?.discrepancyReason || (discrepancy < 0 ? 'short' : discrepancy > 0 ? 'over' : null),
            discrepancyNotes: receiveData?.discrepancyNotes || null,
          }).where(eq(transferItem.id, item.id));

          // Decrement in_transit
          await tx.execute(sql`
            UPDATE inventory SET in_transit = GREATEST(inventory.in_transit - ${expectedQty}, 0), updated_at = NOW()
            WHERE location_id = ${existing.destLocationId} AND product_id = ${item.productId}
          `);
          // Increment dest qty_on_hand
          await tx.execute(sql`
            INSERT INTO inventory (location_id, product_id, qty_on_hand, in_transit)
            VALUES (${existing.destLocationId}, ${item.productId}, ${receivedQty}, 0)
            ON CONFLICT (location_id, product_id) DO UPDATE
            SET qty_on_hand = inventory.qty_on_hand + ${receivedQty}, updated_at = NOW()
          `);
        }

        await tx.update(transfer).set(updateFields).where(eq(transfer.id, req.params.id));
      });

      const [updated] = await req.tenantDb.select().from(transfer).where(eq(transfer.id, req.params.id));
      return res.json(updated);
    }

    // === CLOSED ===
    if (targetStatus === 'closed') {
      updateFields.closedAt = new Date();
    }

    // Default: simple status update
    const [updated] = await req.tenantDb.update(transfer).set(updateFields)
      .where(eq(transfer.id, req.params.id)).returning();

    res.json(updated);
  } catch (error) {
    console.error("Error transitioning transfer:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default transferRoutes;
