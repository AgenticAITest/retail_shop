import express from 'express';
import { moduleAuthorization, ModuleAuthorization } from '../../lib/db/schema/tenantSchema';
import { moduleRegistry } from '../../lib/db/schema/sharedSchema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticated, authorized, hasPermissions, resolveTenantContext } from '../../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { executeModuleEnableScripts, executeModuleDisableScripts } from '../../lib/utils/sqlScriptExecutor';

const router = express.Router();
router.use(resolveTenantContext());
router.use(authenticated());

/**
 * @swagger
 * components:
 *   schemas:
 *     ModuleAuthorization:
 *       type: object
 *       required:
 *         - moduleId
 *         - moduleName
 *         - isEnabled
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the module authorization
 *         moduleId:
 *           type: string
 *           maxLength: 255
 *           description: ID of the module
 *         moduleName:
 *           type: string
 *           maxLength: 255
 *           description: Name of the module
 *         tenantId:
 *           type: string
 *           format: uuid
 *           description: ID of the tenant
 *         isEnabled:
 *           type: boolean
 *           description: Whether the module is enabled for the tenant
 *         enabledAt:
 *           type: string
 *           format: date-time
 *           description: When the module was enabled
 *         enabledBy:
 *           type: string
 *           description: Who enabled the module
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
 * /api/system/module-authorization:
 *   get:
 *     summary: Get all module authorizations for the current tenant
 *     tags: [Module Authorization]
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
 *     responses:
 *       200:
 *         description: List of module authorizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModuleAuthorization'
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
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const authorizations = await req.tenantDb!
      .select()
      .from(moduleAuthorization)
      .orderBy(desc(moduleAuthorization.createdAt))
      .limit(limit)
      .offset(offset);

    const totalCount = await req.tenantDb!
      .select({ count: moduleAuthorization.id })
      .from(moduleAuthorization)
      ;

    const total = totalCount.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: authorizations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching module authorizations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-authorization/registered-modules:
 *   get:
 *     summary: Get list of registered modules that can be authorized
 *     tags: [Module Authorization]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of registered modules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   moduleId:
 *                     type: string
 *                   moduleName:
 *                     type: string
 *                   description:
 *                     type: string
 *                   version:
 *                     type: string
 *                   category:
 *                     type: string
 *                   isAuthorized:
 *                     type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/registered-modules', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    // Get existing authorizations
    const existingAuths = await req.tenantDb!
      .select()
      .from(moduleAuthorization)
      ;

    const authMap = new Map(existingAuths.map((auth: ModuleAuthorization) => [auth.moduleId, auth]));

    // Get registered modules from database
    const registeredModulesFromDB = await req.sharedDb!
      .select()
      .from(moduleRegistry)
      .where(eq(moduleRegistry.isActive, true))
      .orderBy(desc(moduleRegistry.createdAt));

    // Map to include authorization status
    const registeredModules = registeredModulesFromDB.map(module => ({
      moduleId: module.moduleId,
      moduleName: module.moduleName,
      description: module.description || '',
      version: module.version,
      category: module.category,
      isAuthorized: authMap.has(module.moduleId) ? authMap.get(module.moduleId)?.isEnabled || false : false,
      isEnabled: authMap.has(module.moduleId) ? authMap.get(module.moduleId)?.isEnabled || false : false,
    }));

    res.json(registeredModules);
  } catch (error) {
    console.error('Error fetching registered modules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-authorization/{id}:
 *   get:
 *     summary: Get a module authorization by ID
 *     tags: [Module Authorization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Module authorization ID
 *     responses:
 *       200:
 *         description: Module authorization details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleAuthorization'
 *       404:
 *         description: Module authorization not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.get('/:id', hasPermissions('system.modules.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const authorization = await req.tenantDb!
      .select()
      .from(moduleAuthorization)
      .where(eq(moduleAuthorization.id, id))
      .limit(1);

    if (authorization.length === 0) {
      return res.status(404).json({ error: 'Module authorization not found' });
    }

    res.json(authorization[0]);
  } catch (error) {
    console.error('Error fetching module authorization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-authorization:
 *   post:
 *     summary: Create or update a module authorization
 *     tags: [Module Authorization]
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
 *               - isEnabled
 *             properties:
 *               moduleId:
 *                 type: string
 *                 maxLength: 255
 *               moduleName:
 *                 type: string
 *                 maxLength: 255
 *               isEnabled:
 *                 type: boolean
 *               deleteTables:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to delete module tables when disabling (ignored when enabling)
 *               createTables:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to create module tables when enabling (ignored when disabling)
 *     responses:
 *       201:
 *         description: Module authorization created/updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleAuthorization'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.post('/', hasPermissions('system.module.manage'), async (req, res) => {
  try {
    const { moduleId, moduleName, isEnabled, deleteTables = true, createTables = true } = req.body;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }
    const username = req.user!.username;

    if (!moduleId || !moduleName || typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'moduleId, moduleName, and isEnabled are required' });
    }

    // Check if authorization already exists
    const existingAuth = await req.tenantDb!
      .select()
      .from(moduleAuthorization)
      .where(
        eq(moduleAuthorization.moduleId, moduleId)
      )
      .limit(1);

    let result;
    let wasEnabled = false;

    if (existingAuth.length > 0) {
      wasEnabled = existingAuth[0].isEnabled;
      
      // Update existing authorization
      const updateData: any = {
        isEnabled,
        updatedAt: new Date(),
      };

      if (isEnabled) {
        updateData.enabledAt = new Date();
        updateData.enabledBy = username;
      } else {
        updateData.enabledAt = null;
        updateData.enabledBy = null;
      }

      [result] = await req.tenantDb!
        .update(moduleAuthorization)
        .set(updateData)
        .where(eq(moduleAuthorization.moduleId, moduleId))
        .returning();
    } else {
      // Create new authorization
      const newAuth = {
        id: uuidv4(),
        moduleId,
        moduleName,
        tenantId,
        isEnabled,
        enabledAt: isEnabled ? new Date() : null,
        enabledBy: isEnabled ? username : null,
      };

      [result] = await req.tenantDb!
        .insert(moduleAuthorization)
        .values(newAuth)
        .returning();
    }

    // Execute SQL scripts based on the state change
    if (wasEnabled !== isEnabled) {
      try {
        if (isEnabled && !wasEnabled && createTables) {
          // Module is being enabled and tables should be created - execute create_tables.sql and seed_data.sql
          await executeModuleEnableScripts(req.tenantDb!, moduleId);
        } else if (!isEnabled && wasEnabled && deleteTables) {
          // Module is being disabled and tables should be deleted - execute drop_tables.sql
          await executeModuleDisableScripts(req.tenantDb!, moduleId);
        }
        // If isEnabled && !createTables, we don't execute creation scripts
        // If !isEnabled && !deleteTables, we don't execute deletion scripts
        // This gives full control over database operations
      } catch (scriptError) {
        console.error(`SQL script execution failed for module ${moduleId}:`, scriptError);
        // Optionally, you might want to rollback the authorization change here
        // For now, we'll just log the error and continue
        // The authorization state will still be updated even if scripts fail
      }
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating/updating module authorization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/system/module-authorization/toggle/{moduleId}:
 *   patch:
 *     summary: Toggle module authorization for the current tenant
 *     tags: [Module Authorization]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Module ID to toggle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moduleName
 *               - isEnabled
 *             properties:
 *               moduleName:
 *                 type: string
 *               isEnabled:
 *                 type: boolean
 *               deleteTables:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to delete module tables when disabling (ignored when enabling)
 *               createTables:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to create module tables when enabling (ignored when disabling)
 *     responses:
 *       200:
 *         description: Module authorization toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleAuthorization'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Server error
 */
router.patch('/toggle/:moduleId', hasPermissions('system.module.manage'), async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { moduleName, isEnabled, deleteTables = true, createTables = true } = req.body;
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Tenant context required" });
    }
    const username = req.user!.username;

    if (!moduleName || typeof isEnabled !== 'boolean') {
      return res.status(400).json({ error: 'moduleName and isEnabled are required' });
    }

    // Check if authorization already exists
    const existingAuth = await req.tenantDb!
      .select()
      .from(moduleAuthorization)
      .where(and(
        eq(moduleAuthorization.moduleId, moduleId),
        
      ))
      .limit(1);

    let result;
    let wasEnabled = false;

    if (existingAuth.length > 0) {
      wasEnabled = existingAuth[0].isEnabled;
      
      // Update existing authorization
      const updateData: any = {
        isEnabled,
        updatedAt: new Date(),
      };

      if (isEnabled) {
        updateData.enabledAt = new Date();
        updateData.enabledBy = username;
      } else {
        updateData.enabledAt = null;
        updateData.enabledBy = null;
      }

      [result] = await req.tenantDb!
        .update(moduleAuthorization)
        .set(updateData)
        .where(eq(moduleAuthorization.moduleId, moduleId))
        .returning();
    } else {
      // Create new authorization
      const newAuth = {
        id: uuidv4(),
        moduleId,
        moduleName,
        tenantId,
        isEnabled,
        enabledAt: isEnabled ? new Date() : null,
        enabledBy: isEnabled ? username : null,
      };

      [result] = await req.tenantDb!
        .insert(moduleAuthorization)
        .values(newAuth)
        .returning();
    }

    // Execute SQL scripts based on the state change
    if (wasEnabled !== isEnabled) {
      try {
        if (isEnabled && !wasEnabled && createTables) {
          // Module is being enabled and tables should be created - execute create_tables.sql and seed_data.sql
          await executeModuleEnableScripts(req.tenantDb!, moduleId);
        } else if (!isEnabled && wasEnabled && deleteTables) {
          // Module is being disabled and tables should be deleted - execute drop_tables.sql
          await executeModuleDisableScripts(req.tenantDb!, moduleId);
        }
        // If isEnabled && !createTables, we don't execute creation scripts
        // If !isEnabled && !deleteTables, we don't execute deletion scripts
        // This gives full control over database operations
      } catch (scriptError) {
        console.error(`SQL script execution failed for module ${moduleId}:`, scriptError);
        // Optionally, you might want to rollback the authorization change here
        // For now, we'll just log the error and continue
        // The authorization state will still be updated even if scripts fail
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error toggling module authorization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;