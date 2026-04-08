import {
  creditNote,
  supplierReturn,
  supplier,
  goodsReceivedNote,
} from "@server/lib/db/schema/tenantSchema";
import { user } from "@server/lib/db/schema/system";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { createCreditNoteSchema } from "../schemas/returnSchema";

const creditNoteRoutes = Router();
creditNoteRoutes.use(resolveTenantContext());
creditNoteRoutes.use(authenticated());
creditNoteRoutes.use(checkModuleAuthorization('supplier-return'));

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
// LIST CREDIT NOTES
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/credit-note:
 *   get:
 *     tags:
 *       - Credit Notes
 *     summary: List credit notes
 *     description: Retrieve a paginated list of credit notes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A paginated list of credit notes
 */
creditNoteRoutes.get("/", authorized("ADMIN", "retail.supplier-return.view"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const filterParam = (req.query.filter as string) || '';
  const supplierIdParam = req.query.supplierId as string | undefined;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [];

    if (filterParam) {
      conditions.push(
        or(
          ilike(creditNote.creditNoteNumber, `%${filterParam}%`),
          ilike(supplierReturn.returnNumber, `%${filterParam}%`),
        )
      );
    }

    if (supplierIdParam) {
      conditions.push(eq(supplierReturn.supplierId, supplierIdParam));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(creditNote)
      .innerJoin(supplierReturn, eq(creditNote.supplierReturnId, supplierReturn.id))
      .where(whereCondition);

    const notes = await req.tenantDb
      .select({
        id: creditNote.id,
        creditNoteNumber: creditNote.creditNoteNumber,
        amount: creditNote.amount,
        creditDate: creditNote.creditDate,
        isReplacement: creditNote.isReplacement,
        supplierReturnId: creditNote.supplierReturnId,
        returnNumber: supplierReturn.returnNumber,
        supplierId: supplierReturn.supplierId,
        supplierName: supplier.name,
        notes: creditNote.notes,
        createdAt: creditNote.createdAt,
      })
      .from(creditNote)
      .innerJoin(supplierReturn, eq(creditNote.supplierReturnId, supplierReturn.id))
      .leftJoin(supplier, eq(supplierReturn.supplierId, supplier.id))
      .where(whereCondition)
      .orderBy(desc(creditNote.creditDate))
      .limit(perPage)
      .offset(offset);

    res.json({
      creditNotes: notes,
      count: total,
      page,
      perPage,
      filter: filterParam,
    });
  } catch (error) {
    console.error("Error fetching credit notes:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// GET OUTSTANDING CREDITS FOR A SUPPLIER
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/credit-note/supplier/{supplierId}/outstanding:
 *   get:
 *     tags:
 *       - Credit Notes
 *     summary: Get outstanding credits for a supplier
 *     description: Returns total outstanding credit notes for a supplier
 *     parameters:
 *       - in: path
 *         name: supplierId
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Outstanding credits summary
 */
creditNoteRoutes.get("/supplier/:supplierId/outstanding", authorized("ADMIN", "retail.supplier-return.view"), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const supplierId = req.params.supplierId;

    const [result] = await req.tenantDb
      .select({
        totalCredits: sql<string>`COALESCE(SUM(${creditNote.amount}), 0)`,
        creditCount: count(),
      })
      .from(creditNote)
      .innerJoin(supplierReturn, eq(creditNote.supplierReturnId, supplierReturn.id))
      .where(
        and(
          eq(supplierReturn.supplierId, supplierId),
          eq(creditNote.isReplacement, false),
        )
      );

    const credits = await req.tenantDb
      .select({
        id: creditNote.id,
        creditNoteNumber: creditNote.creditNoteNumber,
        amount: creditNote.amount,
        creditDate: creditNote.creditDate,
        returnNumber: supplierReturn.returnNumber,
      })
      .from(creditNote)
      .innerJoin(supplierReturn, eq(creditNote.supplierReturnId, supplierReturn.id))
      .where(
        and(
          eq(supplierReturn.supplierId, supplierId),
          eq(creditNote.isReplacement, false),
        )
      )
      .orderBy(desc(creditNote.creditDate));

    res.json({
      supplierId,
      totalCredits: result.totalCredits,
      creditCount: result.creditCount,
      credits,
    });
  } catch (error) {
    console.error("Error fetching outstanding credits:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ============================================================
// CREATE CREDIT NOTE
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-return/credit-note:
 *   post:
 *     tags:
 *       - Credit Notes
 *     summary: Record a credit note
 *     description: Record a credit note or replacement receipt against a supplier return
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Credit note created successfully
 *       400:
 *         description: Validation error
 */
creditNoteRoutes.post("/", authorized("ADMIN", "retail.supplier-return.create"), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const parsed = createCreditNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid data", details: parsed.error.issues });
  }

  try {
    const currentUserId = await getCurrentUserId(req.tenantDb, req.user.username);
    if (!currentUserId) {
      return res.status(404).json({ error: "User not found." });
    }

    // Validate supplier return exists and is in valid state
    const sr = await req.tenantDb
      .select()
      .from(supplierReturn)
      .where(eq(supplierReturn.id, parsed.data.supplierReturnId))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!sr) {
      return res.status(404).json({ error: "Supplier return not found" });
    }

    if (sr.status !== 'acknowledged' && sr.status !== 'credit_note_received') {
      return res.status(400).json({
        error: `Supplier return is in '${sr.status}' status. Credit notes can only be recorded for 'acknowledged' or 'credit_note_received' returns.`,
      });
    }

    // Insert credit note and update return status
    const result = await req.tenantDb.transaction(async (tx: any) => {
      const [newCreditNote] = await tx.insert(creditNote).values({
        supplierReturnId: parsed.data.supplierReturnId,
        creditNoteNumber: parsed.data.creditNoteNumber,
        amount: String(parsed.data.amount),
        creditDate: new Date(parsed.data.creditDate),
        notes: parsed.data.notes || null,
        isReplacement: parsed.data.isReplacement || false,
        replacementGrnId: parsed.data.replacementGrnId || null,
        createdBy: currentUserId,
      }).returning();

      // Transition to credit_note_received if still in acknowledged
      if (sr.status === 'acknowledged') {
        await tx
          .update(supplierReturn)
          .set({ status: 'credit_note_received' })
          .where(eq(supplierReturn.id, parsed.data.supplierReturnId));
      }

      return newCreditNote;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating credit note:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default creditNoteRoutes;
