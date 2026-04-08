import { approvalConfig, role } from '@server/lib/db/schema/tenantSchema';
import { approvalConfigUpdateSchema } from '@modules/approval-engine/server/schemas/approvalSchema';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { authenticated, authorized, resolveTenantContext } from 'src/server/middleware/authMiddleware';
import { ZodError } from 'zod';

const configRoutes = Router();
configRoutes.use(resolveTenantContext());
configRoutes.use(authenticated());
configRoutes.use(checkModuleAuthorization('approval-engine'));

/**
 * @swagger
 * /api/modules/approval-engine/config:
 *   get:
 *     tags:
 *       - Approval Engine - Config
 *     summary: List all approval configurations
 *     description: Retrieve all approval configurations with approver role names
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of approval configurations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApprovalConfig'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     ApprovalConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The approval config ID
 *         transactionType:
 *           type: string
 *           description: The transaction type
 *         isRequired:
 *           type: boolean
 *           description: Whether approval is required
 *         approverRoleId:
 *           type: string
 *           description: UUID of the approver role
 *         approverRoleName:
 *           type: string
 *           description: Name of the approver role
 *         thresholdAmount:
 *           type: number
 *           nullable: true
 *           description: Threshold amount for approval
 *         timeoutHours:
 *           type: integer
 *           description: Hours before timeout action triggers
 *         timeoutAction:
 *           type: string
 *           enum: [escalate, auto_approve]
 *           description: Action to take on timeout
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
configRoutes.get('/', authorized('ADMIN', 'retail.approval.manage'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  try {
    const configs = await req.tenantDb
      .select({
        id: approvalConfig.id,
        transactionType: approvalConfig.transactionType,
        isRequired: approvalConfig.isRequired,
        approverRoleId: approvalConfig.approverRoleId,
        approverRoleName: role.name,
        thresholdAmount: approvalConfig.thresholdAmount,
        timeoutHours: approvalConfig.timeoutHours,
        timeoutAction: approvalConfig.timeoutAction,
        createdAt: approvalConfig.createdAt,
        updatedAt: approvalConfig.updatedAt,
      })
      .from(approvalConfig)
      .leftJoin(role, eq(approvalConfig.approverRoleId, role.id));

    res.json(configs);
  } catch (error) {
    console.error('Error fetching approval configs:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/config/{transactionType}:
 *   put:
 *     tags:
 *       - Approval Engine - Config
 *     summary: Update approval config for a transaction type
 *     description: Update the approval configuration for a specific transaction type
 *     parameters:
 *       - in: path
 *         name: transactionType
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction type to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isRequired:
 *                 type: boolean
 *               approverRoleId:
 *                 type: string
 *               thresholdAmount:
 *                 type: number
 *                 nullable: true
 *               timeoutHours:
 *                 type: integer
 *               timeoutAction:
 *                 type: string
 *                 enum: [escalate, auto_approve]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Approval config updated successfully
 *       400:
 *         description: Invalid data
 *       404:
 *         description: Approval config not found
 */
configRoutes.put('/:transactionType', authorized('ADMIN', 'retail.approval.manage'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const { transactionType } = req.params;

  try {
    const parsed = approvalConfigUpdateSchema.parse(req.body);

    const updated = await req.tenantDb
      .update(approvalConfig)
      .set({
        isRequired: parsed.isRequired,
        approverRoleId: parsed.approverRoleId || null,
        thresholdAmount: parsed.thresholdAmount !== undefined && parsed.thresholdAmount !== null
          ? String(parsed.thresholdAmount)
          : null,
        timeoutHours: parsed.timeoutHours,
        timeoutAction: parsed.timeoutAction,
      })
      .where(eq(approvalConfig.transactionType, transactionType))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return res.status(404).json({ error: 'Approval config not found for this transaction type.' });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error updating approval config:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default configRoutes;
