import { taxConfig } from "@server/lib/db/schema/tenantSchema";
import { taxConfigSchema } from "@modules/tax-configuration/server/schemas/taxConfigSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { ZodError } from "zod";

const taxConfigRoutes = Router();
taxConfigRoutes.use(resolveTenantContext());
taxConfigRoutes.use(authenticated());
taxConfigRoutes.use(checkModuleAuthorization('tax-configuration'));

/**
 * @swagger
 * /api/modules/tax-configuration/config:
 *   get:
 *     tags:
 *       - Tax Configuration
 *     summary: Get all tax configs
 *     description: Retrieve all tax configurations ordered by effective date descending. Shows current active and historical rates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of tax configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TaxConfig'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     TaxConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The tax config ID
 *         ratePercent:
 *           type: string
 *           description: The PPN tax rate percentage
 *         effectiveDate:
 *           type: string
 *           format: date-time
 *           description: The date this rate becomes effective
 *         calcMode:
 *           type: string
 *           enum: [inclusive, exclusive]
 *           description: Whether tax is inclusive or exclusive
 *         status:
 *           type: string
 *           enum: [active, historical]
 *           description: Whether this is the current active rate or historical
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
taxConfigRoutes.get("/", authorized("ADMIN", "retail.tax.view"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const configs = await req.tenantDb
      .select()
      .from(taxConfig)
      .orderBy(desc(taxConfig.effectiveDate));

    res.json({ configs });
  } catch (error) {
    console.error("Error fetching tax configs:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/modules/tax-configuration/config/active:
 *   get:
 *     tags:
 *       - Tax Configuration
 *     summary: Get current active tax config
 *     description: Retrieve the currently active tax configuration
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The active tax configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaxConfig'
 *       404:
 *         description: No active tax configuration found
 */
taxConfigRoutes.get("/active", authorized("ADMIN", "retail.tax.view"), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const activeConfig = await req.tenantDb
      .select()
      .from(taxConfig)
      .where(eq(taxConfig.status, 'active'))
      .orderBy(desc(taxConfig.effectiveDate))
      .limit(1)
      .then((rows) => rows[0]);

    if (!activeConfig) {
      return res.status(404).json({ error: "No active tax configuration found." });
    }

    res.json(activeConfig);
  } catch (error) {
    console.error("Error fetching active tax config:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/modules/tax-configuration/config:
 *   post:
 *     tags:
 *       - Tax Configuration
 *     summary: Create a new tax config
 *     description: Create a new tax configuration. All existing active configs will be set to historical.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaxConfigForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tax config created successfully
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     TaxConfigForm:
 *       type: object
 *       properties:
 *         ratePercent:
 *           type: number
 *           description: The PPN tax rate percentage (0-100)
 *         effectiveDate:
 *           type: string
 *           format: date-time
 *           description: The date this rate becomes effective
 *         calcMode:
 *           type: string
 *           enum: [inclusive, exclusive]
 *           description: Whether tax is inclusive or exclusive
 */
taxConfigRoutes.post("/", authorized("ADMIN", "retail.tax.edit"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    await taxConfigSchema.parseAsync(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  }

  const { ratePercent, effectiveDate, calcMode } = req.body;

  try {
    // Set all existing active configs to historical
    await req.tenantDb
      .update(taxConfig)
      .set({ status: 'historical' })
      .where(eq(taxConfig.status, 'active'));

    // Insert the new config as active
    const newConfig = await req.tenantDb
      .insert(taxConfig)
      .values({
        ratePercent: String(ratePercent),
        effectiveDate: new Date(effectiveDate),
        calcMode,
        status: 'active',
      })
      .returning()
      .then((rows) => rows[0]);

    res.status(201).json(newConfig);
  } catch (error) {
    console.error("Error creating tax config:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default taxConfigRoutes;
