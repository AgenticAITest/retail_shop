import { auditLog, user } from '@server/lib/db/schema/tenantSchema';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import { Router } from 'express';
import { authenticated, authorized, resolveTenantContext } from 'src/server/middleware/authMiddleware';

const auditLogRoutes = Router();
auditLogRoutes.use(resolveTenantContext());
auditLogRoutes.use(authenticated());
auditLogRoutes.use(checkModuleAuthorization('approval-engine'));

/**
 * @swagger
 * /api/modules/approval-engine/audit:
 *   get:
 *     tags:
 *       - Approval Engine - Audit Logs
 *     summary: List audit logs
 *     description: Retrieve audit logs with pagination, sorting, and filtering
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
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: desc
 *           enum: [asc, desc]
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         description: Filter by module name
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type
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
 *         description: Paginated audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auditLogs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *                 count:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         username:
 *           type: string
 *         action:
 *           type: string
 *         module:
 *           type: string
 *         entityType:
 *           type: string
 *           nullable: true
 *         entityId:
 *           type: string
 *           nullable: true
 *         beforeData:
 *           type: object
 *           nullable: true
 *         afterData:
 *           type: object
 *           nullable: true
 *         ipAddress:
 *           type: string
 *           nullable: true
 *         userAgent:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */
auditLogRoutes.get('/', authorized('ADMIN', 'retail.approval.view'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = (req.query.sort as string) || 'createdAt';
  const orderParam = (req.query.order as string) || 'desc';
  const moduleFilter = req.query.module as string | undefined;
  const actionFilter = req.query.action as string | undefined;
  const userIdFilter = req.query.userId as string | undefined;
  const entityTypeFilter = req.query.entityType as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  const sortColumns = {
    createdAt: auditLog.createdAt,
    action: auditLog.action,
    module: auditLog.module,
    entityType: auditLog.entityType,
  } as const;

  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || auditLog.createdAt;

  try {
    const conditions = [];

    if (moduleFilter) {
      conditions.push(eq(auditLog.module, moduleFilter));
    }

    if (actionFilter) {
      conditions.push(eq(auditLog.action, actionFilter));
    }

    if (userIdFilter) {
      conditions.push(eq(auditLog.userId, userIdFilter));
    }

    if (entityTypeFilter) {
      conditions.push(eq(auditLog.entityType, entityTypeFilter));
    }

    if (dateFrom) {
      conditions.push(gte(auditLog.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(auditLog.createdAt, new Date(dateTo)));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ value: total }] = await req.tenantDb
      .select({ value: count() })
      .from(auditLog)
      .where(whereCondition);

    const logs = await req.tenantDb
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        username: user.username,
        action: auditLog.action,
        module: auditLog.module,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(user, eq(auditLog.userId, user.id))
      .where(whereCondition)
      .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(perPage)
      .offset(offset);

    res.json({
      auditLogs: logs,
      count: total,
      page,
      perPage,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/approval-engine/audit/{id}:
 *   get:
 *     tags:
 *       - Approval Engine - Audit Logs
 *     summary: Get a single audit log detail
 *     description: Retrieve the full details of a specific audit log entry including before/after data
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The audit log ID
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Audit log detail with before/after data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       404:
 *         description: Audit log not found
 */
auditLogRoutes.get('/:id', authorized('ADMIN', 'retail.approval.view'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  const { id } = req.params;

  try {
    const log = await req.tenantDb
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        username: user.username,
        action: auditLog.action,
        module: auditLog.module,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        beforeData: auditLog.beforeData,
        afterData: auditLog.afterData,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(user, eq(auditLog.userId, user.id))
      .where(eq(auditLog.id, id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found.' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching audit log detail:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default auditLogRoutes;
