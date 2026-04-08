import { approvalConfig, approvalLog, user, userRole } from '@server/lib/db/schema/tenantSchema';
import { rejectSchema } from '@modules/approval-engine/server/schemas/approvalSchema';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import { and, count, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { authenticated, authorized, resolveTenantContext } from 'src/server/middleware/authMiddleware';
import { ZodError } from 'zod';

const approvalRoutes = Router();
approvalRoutes.use(resolveTenantContext());
approvalRoutes.use(authenticated());
approvalRoutes.use(checkModuleAuthorization('approval-engine'));

/**
 * @swagger
 * /api/modules/approval-engine/approval/pending:
 *   get:
 *     tags:
 *       - Approval Engine - Approvals
 *     summary: List pending approvals for current user
 *     description: Retrieve pending approvals where the current user has the configured approver role
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of pending approvals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApprovalLog'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     ApprovalLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         transactionType:
 *           type: string
 *         transactionId:
 *           type: string
 *         requestedBy:
 *           type: string
 *         requestorName:
 *           type: string
 *         approvedBy:
 *           type: string
 *           nullable: true
 *         action:
 *           type: string
 *           enum: [pending, approved, rejected]
 *         reason:
 *           type: string
 *           nullable: true
 *         requestedAt:
 *           type: string
 *           format: date-time
 *         actionedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */
approvalRoutes.get('/pending', authorized('ADMIN', 'retail.approval.action'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  try {
    // Get the current user's record
    const currentUser = await req.tenantDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, req.user.username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Get role IDs for the current user
    const userRoles = await req.tenantDb
      .select({ roleId: userRole.roleId })
      .from(userRole)
      .where(eq(userRole.userId, currentUser.id));

    const userRoleIds = userRoles.map((ur) => ur.roleId);

    if (userRoleIds.length === 0) {
      return res.json([]);
    }

    // Get transaction types where the user's roles match the approver role
    const approverConfigs = await req.tenantDb
      .select({ transactionType: approvalConfig.transactionType })
      .from(approvalConfig)
      .where(
        and(
          eq(approvalConfig.isRequired, true),
          inArray(approvalConfig.approverRoleId, userRoleIds)
        )
      );

    const allowedTypes = approverConfigs.map((c) => c.transactionType);

    if (allowedTypes.length === 0) {
      return res.json([]);
    }

    // Alias for requestor user
    const requestor = user;

    const pendingApprovals = await req.tenantDb
      .select({
        id: approvalLog.id,
        transactionType: approvalLog.transactionType,
        transactionId: approvalLog.transactionId,
        requestedBy: approvalLog.requestedBy,
        requestorName: requestor.fullname,
        action: approvalLog.action,
        reason: approvalLog.reason,
        requestedAt: approvalLog.requestedAt,
        actionedAt: approvalLog.actionedAt,
      })
      .from(approvalLog)
      .innerJoin(requestor, eq(approvalLog.requestedBy, requestor.id))
      .where(
        and(
          eq(approvalLog.action, 'pending'),
          inArray(approvalLog.transactionType, allowedTypes)
        )
      )
      .orderBy(desc(approvalLog.requestedAt));

    res.json(pendingApprovals);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/approval/history:
 *   get:
 *     tags:
 *       - Approval Engine - Approvals
 *     summary: List approval history
 *     description: Retrieve all actioned approvals with pagination, sorting, and filtering
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
 *           default: actionedAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: desc
 *           enum: [asc, desc]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [approved, rejected]
 *         description: Filter by action status
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to date
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated approval history
 */
approvalRoutes.get('/history', authorized('ADMIN', 'retail.approval.action'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const orderParam = (req.query.order as string) || 'desc';
  const typeFilter = req.query.type as string | undefined;
  const statusFilter = req.query.status as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  try {
    const conditions = [
      or(eq(approvalLog.action, 'approved'), eq(approvalLog.action, 'rejected')),
    ];

    if (typeFilter) {
      conditions.push(eq(approvalLog.transactionType, typeFilter));
    }

    if (statusFilter && (statusFilter === 'approved' || statusFilter === 'rejected')) {
      conditions.push(eq(approvalLog.action, statusFilter));
    }

    if (dateFrom) {
      conditions.push(gte(approvalLog.actionedAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(approvalLog.actionedAt, new Date(dateTo)));
    }

    const whereCondition = and(...conditions);

    const requestor = user;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(approvalLog)
      .where(whereCondition);

    const history = await req.tenantDb
      .select({
        id: approvalLog.id,
        transactionType: approvalLog.transactionType,
        transactionId: approvalLog.transactionId,
        requestedBy: approvalLog.requestedBy,
        requestorName: requestor.fullname,
        approvedBy: approvalLog.approvedBy,
        action: approvalLog.action,
        reason: approvalLog.reason,
        requestedAt: approvalLog.requestedAt,
        actionedAt: approvalLog.actionedAt,
      })
      .from(approvalLog)
      .innerJoin(requestor, eq(approvalLog.requestedBy, requestor.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? sql`${approvalLog.actionedAt} asc` : desc(approvalLog.actionedAt))
      .limit(perPage)
      .offset(offset);

    res.json({
      approvals: history,
      count: total,
      page,
      perPage,
    });
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/approval/{id}:
 *   get:
 *     tags:
 *       - Approval Engine - Approvals
 *     summary: Get a single approval detail
 *     description: Retrieve the details of a specific approval log entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The approval log ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Approval detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalLog'
 *       404:
 *         description: Approval not found
 */
approvalRoutes.get('/:id', authorized('ADMIN', 'retail.approval.action'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const { id } = req.params;

  try {
    const requestor = user;

    const approval = await req.tenantDb
      .select({
        id: approvalLog.id,
        transactionType: approvalLog.transactionType,
        transactionId: approvalLog.transactionId,
        requestedBy: approvalLog.requestedBy,
        requestorName: requestor.fullname,
        approvedBy: approvalLog.approvedBy,
        action: approvalLog.action,
        reason: approvalLog.reason,
        requestedAt: approvalLog.requestedAt,
        actionedAt: approvalLog.actionedAt,
      })
      .from(approvalLog)
      .innerJoin(requestor, eq(approvalLog.requestedBy, requestor.id))
      .where(eq(approvalLog.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found.' });
    }

    res.json(approval);
  } catch (error) {
    console.error('Error fetching approval detail:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/approval/{id}/approve:
 *   post:
 *     tags:
 *       - Approval Engine - Approvals
 *     summary: Approve a pending approval
 *     description: Set the approval action to approved
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The approval log ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Approval approved successfully
 *       404:
 *         description: Approval not found or already actioned
 */
approvalRoutes.post('/:id/approve', authorized('ADMIN', 'retail.approval.action'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const { id } = req.params;

  try {
    // Get current user ID
    const currentUser = await req.tenantDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, req.user.username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updated = await req.tenantDb
      .update(approvalLog)
      .set({
        action: 'approved',
        approvedBy: currentUser.id,
        actionedAt: new Date(),
      })
      .where(and(eq(approvalLog.id, id), eq(approvalLog.action, 'pending')))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return res.status(404).json({ error: 'Approval not found or already actioned.' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error approving approval:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/approval/{id}/reject:
 *   post:
 *     tags:
 *       - Approval Engine - Approvals
 *     summary: Reject a pending approval
 *     description: Set the approval action to rejected with a reason
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The approval log ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Approval rejected successfully
 *       400:
 *         description: Invalid data
 *       404:
 *         description: Approval not found or already actioned
 */
approvalRoutes.post('/:id/reject', authorized('ADMIN', 'retail.approval.action'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const { id } = req.params;

  try {
    const parsed = rejectSchema.parse(req.body);

    // Get current user ID
    const currentUser = await req.tenantDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, req.user.username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updated = await req.tenantDb
      .update(approvalLog)
      .set({
        action: 'rejected',
        approvedBy: currentUser.id,
        reason: parsed.reason,
        actionedAt: new Date(),
      })
      .where(and(eq(approvalLog.id, id), eq(approvalLog.action, 'pending')))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      return res.status(404).json({ error: 'Approval not found or already actioned.' });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error rejecting approval:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default approvalRoutes;
