import express from 'express';
import { moduleRegistry } from '../../lib/db/schema/sharedSchema';
import { eq, and, desc, ilike, or } from 'drizzle-orm';
import { authenticated, authorized, hasPermissions, hasRoles, resolveTenantContext } from '../../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { ro } from 'date-fns/locale';

const router = express.Router();
router.use(resolveTenantContext());
router.use(authenticated());

/**
 * @swagger
 * components:
 *   schemas:
 *     ModuleRegistry:
 *       type: object
 *       required:
 *         - moduleId
 *         - moduleName
 *         - version
 *         - category
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the registered module
 *         moduleId:
 *           type: string
 *           maxLength: 255
 *           description: Unique identifier for the module
 *         moduleName:
 *           type: string
 *           maxLength: 255
 *           description: Display name of the module
 *         description:
 *           type: string
 *           description: Description of the module
 *         version:
 *           type: string
 *           maxLength: 50
 *           description: Version of the module
 *         category:
 *           type: string
 *           maxLength: 100
 *           description: Category of the module
 *         isActive:
 *           type: boolean
 *           description: Whether the module is active and registered
 *         repositoryUrl:
 *           type: string
 *           maxLength: 500
 *           description: URL to the module repository
 *         documentationUrl:
 *           type: string
 *           maxLength: 500
 *           description: URL to the module documentation
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /api/system/module-registry:
 *   get:
 *     summary: Get all registered modules
 *     tags: [Module Registered]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for module name or description
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of registered modules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModuleRegistry'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const category = req.query.category as string;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    // Build where conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(moduleRegistry.moduleName, `%${search}%`),
          ilike(moduleRegistry.description, `%${search}%`),
          ilike(moduleRegistry.moduleId, `%${search}%`)
        )
      );
    }

    if (category) {
      conditions.push(eq(moduleRegistry.category, category));
    }

    if (isActive !== undefined) {
      conditions.push(eq(moduleRegistry.isActive, isActive));
    }

    // Build final query with conditions
    let modules;
    let totalResult;

    if (conditions.length > 0) {
      const whereCondition = and(...conditions);
      
      modules = await req.sharedDb!
        .select()
        .from(moduleRegistry)
        .where(whereCondition)
        .orderBy(desc(moduleRegistry.createdAt))
        .limit(limit)
        .offset(offset);

      totalResult = await req.sharedDb!
        .select({ count: moduleRegistry.id })
        .from(moduleRegistry)
        .where(whereCondition);
    } else {
      modules = await req.sharedDb!
        .select()
        .from(moduleRegistry)
        .orderBy(desc(moduleRegistry.createdAt))
        .limit(limit)
        .offset(offset);

      totalResult = await req.sharedDb!
        .select({ count: moduleRegistry.id })
        .from(moduleRegistry);
    }
    
    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: modules,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching registered modules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-registry/{id}:
 *   get:
 *     summary: Get an registered module by ID
 *     tags: [Module Registered]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registered module ID
 *     responses:
 *       200:
 *         description: Registered module details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleRegistry'
 *       404:
 *         description: Registered module not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/:id', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const module = await req.sharedDb!
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.id, id))
      .limit(1);

    if (module.length === 0) {
      return res.status(404).json({ error: 'Registered module not found' });
    }

    res.json(module[0]);
  } catch (error) {
    console.error('Error fetching registered module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-registry:
 *   post:
 *     summary: Create a new registered module
 *     tags: [Module Registered]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moduleId
 *               - moduleName
 *               - version
 *               - category
 *             properties:
 *               moduleId:
 *                 type: string
 *                 maxLength: 255
 *               moduleName:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *                 maxLength: 50
 *               category:
 *                 type: string
 *                 maxLength: 100
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               repositoryUrl:
 *                 type: string
 *                 maxLength: 500
 *               documentationUrl:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Registered module created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleRegistry'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Module ID already exists
 *       500:
 *         description: Server error
 */
router.post('/', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const { 
      moduleId, 
      moduleName, 
      description, 
      version, 
      category, 
      isActive = true,
      repositoryUrl,
      documentationUrl
    } = req.body;

    if (!moduleId || !moduleName || !version || !category) {
      return res.status(400).json({ error: 'moduleId, moduleName, version, and category are required' });
    }

    // Check if moduleId already exists
    const existing = await req.sharedDb!
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.moduleId, moduleId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Module ID already exists' });
    }

    const newModule = {
      id: uuidv4(),
      moduleId,
      moduleName,
      description,
      version,
      category,
      isActive,
      repositoryUrl,
      documentationUrl,
    };

    const [createdModule] = await req.sharedDb!
      .insert(moduleRegistry)
      .values(newModule)
      .returning();

    res.status(201).json(createdModule);
  } catch (error) {
    console.error('Error creating registered module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-registry/{id}:
 *   put:
 *     summary: Update an registered module
 *     tags: [Module Registered]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registered module ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               moduleId:
 *                 type: string
 *                 maxLength: 255
 *               moduleName:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               version:
 *                 type: string
 *                 maxLength: 50
 *               category:
 *                 type: string
 *                 maxLength: 100
 *               isActive:
 *                 type: boolean
 *               repositoryUrl:
 *                 type: string
 *                 maxLength: 500
 *               documentationUrl:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Registered module updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleRegistry'
 *       404:
 *         description: Registered module not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Module ID already exists (if changed)
 *       500:
 *         description: Server error
 */
router.put('/:id', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      moduleId, 
      moduleName, 
      description, 
      version, 
      category, 
      isActive,
      repositoryUrl,
      documentationUrl
    } = req.body;

    // Check if module exists
    const existing = await req.sharedDb!
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Registered module not found' });
    }

    // Check if moduleId conflicts (if being changed)
    if (moduleId && moduleId !== existing[0].moduleId) {
      const conflicting = await req.sharedDb!
        .select()
        .from(moduleRegistry)
        .where(eq(moduleRegistry.moduleId, moduleId))
        .limit(1);

      if (conflicting.length > 0) {
        return res.status(409).json({ error: 'Module ID already exists' });
      }
    }

    const updateData: any = { updatedAt: new Date() };
    if (moduleId !== undefined) updateData.moduleId = moduleId;
    if (moduleName !== undefined) updateData.moduleName = moduleName;
    if (description !== undefined) updateData.description = description;
    if (version !== undefined) updateData.version = version;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (repositoryUrl !== undefined) updateData.repositoryUrl = repositoryUrl;
    if (documentationUrl !== undefined) updateData.documentationUrl = documentationUrl;

    const [updatedModule] = await req.sharedDb!
      .update(moduleRegistry)
      .set(updateData)
      .where(eq(moduleRegistry.id, id))
      .returning();

    res.json(updatedModule);
  } catch (error) {
    console.error('Error updating registered module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-registry/{id}:
 *   delete:
 *     summary: Delete an registered module
 *     tags: [Module Registered]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registered module ID
 *     responses:
 *       204:
 *         description: Registered module deleted successfully
 *       404:
 *         description: Registered module not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.delete('/:id', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await req.sharedDb!
      .delete(moduleRegistry)
      .where(eq(moduleRegistry.id, id))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Registered module not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting registered module:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-registry/register-from-json/{moduleId}:
 *   post:
 *     summary: Register a module from its module.json file
 *     tags: [Module Registry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ID (folder name)
 *     responses:
 *       201:
 *         description: Module registered successfully
 *       400:
 *         description: Module already exists or invalid module
 *       404:
 *         description: Module.json not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.post('/register-from-json/:moduleId', hasRoles('SYSADMIN'), async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    // Import the registration helper
    const { registerModuleFromJson } = await import('../../lib/utils/moduleRegistrationHelper');
    
    const success = await registerModuleFromJson(moduleId);
    
    if (!success) {
      return res.status(400).json({ 
        error: 'Module already exists or could not be registered'
      });
    }
    
    res.status(201).json({ 
      message: 'Module registered successfully',
      moduleId 
    });
    
  } catch (error) {
    console.error('Error registering module from JSON:', error);
    
    if (error instanceof Error && error.message.includes('Module.json not found')) {
      return res.status(404).json({ error: 'Module.json not found' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;