import { Router } from 'express';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { event as webhookEvent } from '../lib/db/schemas/integration';
import { authenticated, authorized } from '@server/middleware/authMiddleware';
import { validateData } from '@server/middleware/validationMiddleware';
import { eventAddSchema, eventEditSchema, eventQuerySchema } from '../schemas/eventSchema';
import { resolveTenantContext } from '@server/middleware/authMiddleware';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';

const eventRoutes = Router();

eventRoutes.use(resolveTenantContext());
eventRoutes.use(authenticated());
eventRoutes.use(checkModuleAuthorization('integration'));


/**
 * @swagger
 * /api/webhook-events:
 *   get:
 *     tags:
 *       - Webhook Events
 *     summary: List webhook events
 *     description: Get paginated list of webhook events for the current tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page (default 10)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by event name
 *     responses:
 *       200:
 *         description: List of webhook events
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Insufficient permissions
 */
eventRoutes.get('/', authorized('ADMIN', 'integration.event.view'), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const query = eventQuerySchema.parse(req.query);
    
    // Build where conditions
    let whereConditions = [];
    
    if (query.isActive !== undefined) {
      whereConditions.push(eq(webhookEvent.isActive, query.isActive));
    }
    
    if (query.name) {
      whereConditions.push(sql`${webhookEvent.name} ILIKE ${`%${query.name}%`}`);
    }

    // Get total count
    const totalResult = await req.tenantDb
      .select({ count: count() })
      .from(webhookEvent)
      .where(and(...whereConditions));

    const total = totalResult[0].count;
    const totalPages = Math.ceil(total / query.perPage);

    // Get paginated data
    const events = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(...whereConditions))
      .orderBy(desc(webhookEvent.createdAt))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage);

    res.json({
      success: true,
      data: events,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error listing webhook events:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhook-events:
 *   post:
 *     tags:
 *       - Webhook Events
 *     summary: Create webhook event
 *     description: Create a new webhook event type for the current tenant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "user.created"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Triggered when a new user is created"
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Webhook event created successfully
 *       400:
 *         description: Validation error or event name already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Insufficient permissions
 */
eventRoutes.post('/', validateData(eventAddSchema), authorized('ADMIN', 'integration.event.create'), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const { name, description, isActive } = req.body;

    // Check for duplicate event name in tenant (case insensitive)
    const existing = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(
        sql`lower(${webhookEvent.name}) = ${name.toLowerCase()}`
      ));

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event name already exists in this tenant' 
      });
    }

    const newEvent = await req.tenantDb
      .insert(webhookEvent)
      .values({
        id: crypto.randomUUID(),
        name,
        description,
        isActive,
      })
      .returning();
      
    res.status(201).json({ success: true, data: newEvent[0] });
  } catch (error) {
    console.error('Error creating webhook event:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhook-events/{id}:
 *   get:
 *     tags:
 *       - Webhook Events
 *     summary: Get webhook event by ID
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
 *         description: Webhook event details
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Webhook event not found
 */
eventRoutes.get('/:id', authorized('ADMIN', 'integration.event.view'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const { id } = req.params;

    const event = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(eq(webhookEvent.id, id)));

    if (event.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook event not found' });
    }

    res.json({ success: true, data: event[0] });
  } catch (error) {
    console.error('Error fetching webhook event:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhook-events/{id}:
 *   put:
 *     tags:
 *       - Webhook Events
 *     summary: Update webhook event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook event updated successfully
 *       400:
 *         description: Validation error or event name already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Webhook event not found
 */
eventRoutes.put('/:id', validateData(eventEditSchema), authorized('ADMIN', 'integration.event.edit'), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    
    // Ensure event exists and belongs to tenant
    const existingEvent = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(eq(webhookEvent.id, id)));

    if (existingEvent.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook event not found' });
    }

    // Check for duplicate event name in tenant (case insensitive), excluding current record
    const duplicateCheck = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(
        sql`${webhookEvent.id} != ${id}`,
        sql`lower(${webhookEvent.name}) = ${name.toLowerCase()}`
      ));

    if (duplicateCheck.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Event name already exists in this tenant' 
      });
    }

    const updated = await req.tenantDb
      .update(webhookEvent)
      .set({ 
        name, 
        description, 
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(webhookEvent.id, id))
      .returning();
      
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Error updating webhook event:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/webhook-events/{id}:
 *   delete:
 *     tags:
 *       - Webhook Events
 *     summary: Delete webhook event
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
 *         description: Webhook event deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Webhook event not found
 */
eventRoutes.delete('/:id', authorized('ADMIN', 'integration.event.delete'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const { id } = req.params;

    // Ensure event exists and belongs to tenant
    const existingEvent = await req.tenantDb
      .select()
      .from(webhookEvent)
      .where(and(eq(webhookEvent.id, id)));

    if (existingEvent.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook event not found' });
    }

    await req.tenantDb.delete(webhookEvent).where(eq(webhookEvent.id, id));

    res.json({ success: true, message: 'Webhook event deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook event:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default eventRoutes;