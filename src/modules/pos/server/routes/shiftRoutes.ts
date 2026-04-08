import {
  posShift,
  posCashDrop,
  posTransaction,
  posTransactionPayment,
  location,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, asc, count, desc, eq, sql, sum } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { openShiftSchema, closeShiftSchema, cashDropSchema } from "../schemas/posSchema";

const shiftRoutes = Router();
shiftRoutes.use(resolveTenantContext());
shiftRoutes.use(authenticated());
shiftRoutes.use(checkModuleAuthorization('pos'));

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
// OPEN SHIFT
// ============================================================

shiftRoutes.post("/open", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = openShiftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    // Check no existing open shift for this user+location
    const existing = await req.tenantDb
      .select()
      .from(posShift)
      .where(and(eq(posShift.cashierId, userId), eq(posShift.status, 'open' as any)))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (existing) {
      return res.status(400).json({ error: "You already have an open shift. Close it before opening a new one." });
    }

    const [shift] = await req.tenantDb.insert(posShift).values({
      cashierId: userId,
      locationId: parsed.data.locationId,
      status: 'open',
      openingFloat: String(parsed.data.openingFloat),
    }).returning();

    res.status(201).json(shift);
  } catch (error) {
    console.error("Error opening shift:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET CURRENT OPEN SHIFT
// ============================================================

shiftRoutes.get("/current", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const shift = await req.tenantDb.query.posShift.findFirst({
      where: and(eq(posShift.cashierId, userId), eq(posShift.status, 'open' as any)),
      with: {
        location: true,
        cashDrops: true,
      },
    });

    if (!shift) {
      return res.json({ shift: null });
    }

    // Get summary stats for this shift
    const [salesStats] = await req.tenantDb
      .select({
        totalSales: count(),
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${posTransaction.status} = 'completed' THEN ${posTransaction.totalAmount} ELSE 0 END), 0)`,
        totalVoided: sql<string>`COUNT(CASE WHEN ${posTransaction.status} = 'voided' THEN 1 END)`,
      })
      .from(posTransaction)
      .where(eq(posTransaction.shiftId, shift.id));

    // Get cash payments total for expected cash calc
    const [cashStats] = await req.tenantDb
      .select({
        totalCash: sql<string>`COALESCE(SUM(${posTransactionPayment.amount}), 0)`,
      })
      .from(posTransactionPayment)
      .innerJoin(posTransaction, eq(posTransactionPayment.posTransactionId, posTransaction.id))
      .where(and(
        eq(posTransaction.shiftId, shift.id),
        eq(posTransaction.status, 'completed' as any),
        eq(posTransactionPayment.paymentMethod, 'cash' as any),
      ));

    const totalCashDrops = shift.cashDrops?.reduce((s: number, d: any) => s + Number(d.amount), 0) || 0;

    res.json({
      shift,
      summary: {
        totalSales: salesStats.totalSales,
        totalRevenue: salesStats.totalRevenue,
        totalVoided: salesStats.totalVoided,
        totalCashPayments: cashStats.totalCash,
        totalCashDrops,
        expectedCash: Number(shift.openingFloat) + Number(cashStats.totalCash) - totalCashDrops,
      },
    });
  } catch (error) {
    console.error("Error fetching current shift:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// CLOSE SHIFT
// ============================================================

shiftRoutes.post("/:id/close", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = closeShiftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const shift = await req.tenantDb
      .select()
      .from(posShift)
      .where(eq(posShift.id, req.params.id))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (!shift) return res.status(404).json({ error: "Shift not found" });
    if (shift.status !== 'open') return res.status(400).json({ error: "Shift is already closed" });

    // Calculate expected cash
    const [cashStats] = await req.tenantDb
      .select({
        totalCash: sql<string>`COALESCE(SUM(${posTransactionPayment.amount}), 0)`,
      })
      .from(posTransactionPayment)
      .innerJoin(posTransaction, eq(posTransactionPayment.posTransactionId, posTransaction.id))
      .where(and(
        eq(posTransaction.shiftId, shift.id),
        eq(posTransaction.status, 'completed' as any),
        eq(posTransactionPayment.paymentMethod, 'cash' as any),
      ));

    const drops = await req.tenantDb
      .select({ amount: posCashDrop.amount })
      .from(posCashDrop)
      .where(eq(posCashDrop.shiftId, shift.id));

    const totalDrops = drops.reduce((s: number, d: any) => s + Number(d.amount), 0);
    const expectedCash = Number(shift.openingFloat) + Number(cashStats.totalCash) - totalDrops;
    const variance = parsed.data.actualCash - expectedCash;

    const [updated] = await req.tenantDb
      .update(posShift)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId,
        expectedCash: String(expectedCash),
        actualCash: String(parsed.data.actualCash),
        variance: String(Math.round(variance * 100) / 100),
        varianceReason: parsed.data.varianceReason || null,
        notes: parsed.data.notes || null,
      })
      .where(eq(posShift.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error closing shift:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// CASH DROP
// ============================================================

shiftRoutes.post("/:id/cash-drop", authorized('ADMIN', "pos.sale.create"), async (req, res) => {
  if (!req.user || !req.tenantDb) return res.status(401).json({ error: "Unauthorized" });

  const parsed = cashDropSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });

  try {
    const userId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!userId) return res.status(404).json({ error: "User not found" });

    const shift = await req.tenantDb
      .select()
      .from(posShift)
      .where(and(eq(posShift.id, req.params.id), eq(posShift.status, 'open' as any)))
      .limit(1)
      .then((r: any[]) => r[0]);

    if (!shift) return res.status(400).json({ error: "Shift not found or not open" });

    const [drop] = await req.tenantDb.insert(posCashDrop).values({
      shiftId: shift.id,
      amount: String(parsed.data.amount),
      reason: parsed.data.reason,
      droppedBy: userId,
    }).returning();

    res.status(201).json(drop);
  } catch (error) {
    console.error("Error recording cash drop:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// GET SHIFT DETAIL
// ============================================================

shiftRoutes.get("/:id", authorized(['ADMIN', 'MANAGER'], "pos.transaction.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  try {
    const shift = await req.tenantDb.query.posShift.findFirst({
      where: eq(posShift.id, req.params.id),
      with: {
        cashier: { columns: { id: true, username: true, fullname: true } },
        closedByUser: { columns: { id: true, username: true, fullname: true } },
        location: true,
        cashDrops: true,
      },
    });

    if (!shift) return res.status(404).json({ error: "Shift not found" });

    // Transaction summary
    const [stats] = await req.tenantDb
      .select({
        totalSales: count(),
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${posTransaction.status} = 'completed' THEN ${posTransaction.totalAmount} ELSE 0 END), 0)`,
      })
      .from(posTransaction)
      .where(eq(posTransaction.shiftId, shift.id));

    res.json({ ...shift, summary: stats });
  } catch (error) {
    console.error("Error fetching shift:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// LIST SHIFTS
// ============================================================

shiftRoutes.get("/", authorized(['ADMIN', 'MANAGER'], "pos.transaction.view"), async (req, res) => {
  if (!req.tenantDb) return res.status(500).json({ error: "Tenant database connection not found" });

  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.perPage as string) || 10;
  const statusParam = req.query.status as string | undefined;
  const offset = (page - 1) * perPage;

  try {
    const conditions: any[] = [];
    if (statusParam && statusParam !== 'all') {
      conditions.push(eq(posShift.status, statusParam as any));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb.select({ value: count() }).from(posShift).where(where);

    const shifts = await req.tenantDb
      .select({
        id: posShift.id,
        cashierName: user.fullname,
        locationName: location.name,
        status: posShift.status,
        openedAt: posShift.openedAt,
        closedAt: posShift.closedAt,
        openingFloat: posShift.openingFloat,
        expectedCash: posShift.expectedCash,
        actualCash: posShift.actualCash,
        variance: posShift.variance,
      })
      .from(posShift)
      .leftJoin(user, eq(posShift.cashierId, user.id))
      .leftJoin(location, eq(posShift.locationId, location.id))
      .where(where)
      .orderBy(desc(posShift.openedAt))
      .limit(perPage)
      .offset(offset);

    res.json({ shifts, count: total, page, perPage });
  } catch (error) {
    console.error("Error listing shifts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default shiftRoutes;
