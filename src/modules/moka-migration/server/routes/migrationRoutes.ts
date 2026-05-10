import { Router } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import {
  resolveTenantContext,
  authenticated,
  authorized,
} from '@server/middleware/authMiddleware';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import { user as userTable } from '@server/lib/db/schema/tenantSchema';
import { parseMokaItemsCsv } from '../lib/csvParser';
import { transformMokaRows } from '../lib/transformer';
import { runMokaImport, rollbackBatch } from '../lib/importer';
import { mokaMigrationBatch } from '../lib/db/schemas/mokaSchema';

const migrationRoutes = Router();
migrationRoutes.use(resolveTenantContext());
migrationRoutes.use(authenticated());
migrationRoutes.use(checkModuleAuthorization('moka-migration'));

const parseBodySchema = z.object({
  csvData: z.string().min(1, 'csvData is required'),
});

const importBodySchema = z.object({
  csvData: z.string().min(1, 'csvData is required'),
  targetLocationId: z.string().uuid('targetLocationId must be a valid UUID'),
  fileName: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /parse — parse CSV and return preview without writing to DB
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/modules/moka-migration/migration/parse:
 *   post:
 *     tags:
 *       - MokaPOS Migration
 *     summary: Parse MokaPOS CSV and return preview
 *     description: >
 *       Parses a MokaPOS Items CSV export and returns a structured preview of
 *       categories, products, and variants. No data is written to the database.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csvData]
 *             properties:
 *               csvData:
 *                 type: string
 *                 description: Raw CSV string from MokaPOS export
 *     responses:
 *       200:
 *         description: Parsed preview data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                 products:
 *                   type: array
 *                 modifiersSkipped:
 *                   type: integer
 *                 warnings:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Validation or parse error
 */
migrationRoutes.post(
  '/parse',
  authorized('ADMIN', 'moka-migration.migration.import'),
  async (req, res) => {
    const parsed = parseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const rows = await parseMokaItemsCsv(parsed.data.csvData);
      const result = transformMokaRows(rows);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: `CSV parse error: ${(err as Error).message}` });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// POST /import — parse CSV and write to DB
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/modules/moka-migration/migration/import:
 *   post:
 *     tags:
 *       - MokaPOS Migration
 *     summary: Import MokaPOS CSV data into the system
 *     description: >
 *       Parses the CSV, creates categories / products / variants / barcodes and
 *       sets opening stock at the target location. Records a migration batch for
 *       rollback support.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [csvData, targetLocationId]
 *             properties:
 *               csvData:
 *                 type: string
 *               targetLocationId:
 *                 type: string
 *                 format: uuid
 *               fileName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Import summary
 *       400:
 *         description: Validation error
 *       500:
 *         description: Import failed
 */
migrationRoutes.post(
  '/import',
  authorized('ADMIN', 'moka-migration.migration.import'),
  async (req, res) => {
    if (!req.tenantDb) {
      return res.status(500).json({ error: 'Tenant database connection not found' });
    }

    const parsed = importBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    try {
      const currentUser = await req.tenantDb
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.username, req.user!.username))
        .limit(1)
        .then((r: { id: string }[]) => r[0]);

      if (!currentUser) {
        return res.status(401).json({ error: 'User not found' });
      }

      const rows = await parseMokaItemsCsv(parsed.data.csvData);
      const result = transformMokaRows(rows);
      const summary = await runMokaImport({
        db: req.tenantDb,
        result,
        locationId: parsed.data.targetLocationId,
        userId: currentUser.id,
        fileName: parsed.data.fileName ?? 'moka-import.csv',
      });
      return res.json(summary);
    } catch (err) {
      return res.status(500).json({ error: `Import failed: ${(err as Error).message}` });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// GET /batches — list migration history
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/modules/moka-migration/migration/batches:
 *   get:
 *     tags:
 *       - MokaPOS Migration
 *     summary: List migration batch history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of batches
 */
migrationRoutes.get(
  '/batches',
  authorized(['ADMIN', 'MANAGER'], 'moka-migration.migration.view'),
  async (req, res) => {
    if (!req.tenantDb) {
      return res.status(500).json({ error: 'Tenant database connection not found' });
    }

    const batches = await req.tenantDb
      .select()
      .from(mokaMigrationBatch)
      .orderBy(desc(mokaMigrationBatch.createdAt));

    return res.json(batches);
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /batches/:id — rollback a batch
// ──────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/modules/moka-migration/migration/batches/{id}:
 *   delete:
 *     tags:
 *       - MokaPOS Migration
 *     summary: Rollback a migration batch
 *     description: Deletes all entities created by this batch and marks it as rolled_back.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rolled back successfully
 *       404:
 *         description: Batch not found
 */
migrationRoutes.delete(
  '/batches/:id',
  authorized('ADMIN', 'moka-migration.migration.delete'),
  async (req, res) => {
    if (!req.tenantDb) {
      return res.status(500).json({ error: 'Tenant database connection not found' });
    }

    const batchId = req.params.id;
    const [batch] = await req.tenantDb
      .select()
      .from(mokaMigrationBatch)
      .where(eq(mokaMigrationBatch.id, batchId))
      .limit(1);

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    if (batch.status === 'rolled_back') {
      return res.status(400).json({ error: 'Batch has already been rolled back' });
    }

    await rollbackBatch(req.tenantDb, batchId);
    return res.json({ message: 'Batch rolled back successfully' });
  }
);

export default migrationRoutes;
