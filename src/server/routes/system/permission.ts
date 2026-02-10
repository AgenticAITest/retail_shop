import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router } from "express";
import { aw } from "node_modules/react-router/dist/development/context-DohQKLID.mjs";
import { resolve } from "path";
import { permission as permissionTable } from "src/server/lib/db/schema/tenantSchema";
import { authenticated, authorized, hasPermissions, resolveTenantContext } from 'src/server/middleware/authMiddleware';
import { validateData } from "src/server/middleware/validationMiddleware";
import { permissionCodeValidationSchema, permissionCodeValidator, permissionSchema, permissionValidator } from "src/server/schemas/permissionSchema";
import { ZodError } from "zod";

const permissionRoutes = Router();
permissionRoutes.use(resolveTenantContext());
permissionRoutes.use(authenticated());

/**
 * @swagger
 * /api/system/permission:
 *   get:
 *     tags:
 *       - System - Permission
 *     summary: Get all permissions
 *     description: Retrieve a list of all permissions
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: code
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           default: asc
 *         description: Sort order (asc or desc)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           default: ''
 *         description: Filter by name
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of permissions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Permission'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The permission ID
 *         code:
 *           type: string
 *           description: The code of the permission
 *         name:
 *           type: string
 *           description: The name of the permission
 *         description:
 *           type: string
 *           description: A description of the permission
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the permission
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the permission was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the permission was last updated
 */
permissionRoutes.get('/', hasPermissions('system.permission.view'), async (req, res) => {

  if (!req.user || !req.tenantDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Get pagination params from URL
  const pageParam = req.query.page as string;
  const perPageParam = req.query.perPage as string;
  const sortParam = req.query.sort || 'code';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';

  // Map allowed sort keys to columns
  const sortColumns = {
    id: permissionTable.id,
    code: permissionTable.code,
    name: permissionTable.name,
    description: permissionTable.description
    // add other columns as needed
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || permissionTable.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
    const filterCondition = filterParam
      ? or(
          ilike(permissionTable.code, `%${filterParam}%`), 
          ilike(permissionTable.name, `%${filterParam}%`),
          ilike(permissionTable.description, `%${filterParam}%`)
        )
      : undefined;

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(permissionTable)
    .where(filterCondition);

  // Get paginated, sorted, filtered permissions
  const permissionList = await req.tenantDb
    .select()
    .from(permissionTable)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  return res.json({
    permissions: permissionList,
    count: total,
    page,
    perPage,
    sort: sortParam,
    order: orderParam,
    filter: filterParam
  });
});

/**
 * @swagger
 * /api/system/permission/add:
 *   post:
 *     tags:
 *       - System - Permission
 *     summary: Add a new  permission
 *     description: Create a new permission
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Permission created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     PermissionForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The permission ID
 *         code:
 *           type: string
 *           description: The code of the permission
 *         name:
 *           type: string
 *           description: The name of the permission
 *         description:
 *           type: string
 *           description: A description of the permission
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the permission
 */
permissionRoutes.post('/add', hasPermissions('system.permission.create'), async (req, res) => {
  const { code, name, description } = req.body;

  if (!req.tenantDb) {
    return res.status(400).json({ error: "Tenant database not available" });
  }

  const validator = permissionValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const newPermission = await req.tenantDb.insert(permissionTable).values({
      id: crypto.randomUUID(),
      code,
      name,
      description
    })
      .returning()
      .then((rows: any[]) => rows[0]);

    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({ error: "Internal server error." });
  }

});

/**
 * @swagger
 * /api/system/permission/validate-code:
 *   post:
 *     tags:
 *       - System - Permission
 *     summary: Validate permission code
 *     description: Check if the permission code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission code is valid
 *       400:
 *         description: Permission code must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     PermissionCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The permission ID
 *         code:
 *           type: string
 *           description: The code of the permission
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the permission
 */
permissionRoutes.post("/validate-code", hasPermissions('system.permission.edit'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(400).json({ error: "Tenant database not available" });
  }
  
  const validator = permissionCodeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  res.status(200).json({ message: "Permission code is valid." });
});

/**
 * @swagger
 * /api/system/permission/{id}:
 *   get:
 *     tags:
 *       - System - Permission
 *     summary: Get a permission by ID
 *     description: Retrieve a specific permission by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the permission to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The permission details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permission'
 */
permissionRoutes.get('/:id', hasPermissions('system.permission.view'), async (req, res) => {
  const { id } = req.params;

  if (!id || !req.tenantDb) {
    return res.status(400).json({ message: 'ID is required' });
  }

  const idParam = id;

  try {
    const data = await req.tenantDb
      .select()
      .from(permissionTable)
      .where(eq(permissionTable.id, idParam))
      .limit(1)
      .then((rows: any[]) => rows[0]);

    if (!data) {
      return res.status(404).json({ message: 'Data not found' });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching permission:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/permission/{id}/edit:
 *   put:
 *     tags:
 *       - System - Permission
 *     summary: Edit system permission
 *     description: Edit system permission
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       404:
 *         description: Permission not found
 *       500:
 *         description: Internal server error
 */
permissionRoutes.put('/:id/edit', hasPermissions('system.permission.edit'), async (req, res) => {
  const { id: idParam } = req.params;
  const { id, code, name, description } = req.body;

  if (idParam !== id) {
    return res.status(400).json({ message: 'Invalid permission ID' });
  }
  
  if (!req.tenantDb) {
    return res.status(400).json({ message: 'Tenant database not available' });
  }

  const validator = permissionValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    const updatedPermission = await req.tenantDb.update(permissionTable).set({
      code,
      name,
      description
    }).where(eq(permissionTable.id, id)
    )
      .returning()
      .then((rows: any[]) => rows[0]);

    res.status(200).json(updatedPermission);
  } catch (error) {
    console.error("Error updating permission:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/permission/{id}/delete:
 *   delete:
 *     tags:
 *       - System - Permission
 *     summary: Delete system permission
 *     description: Delete an existing permission by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the permission to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission deleted successfully
 *       404:
 *         description: Permission not found
 */
permissionRoutes.delete('/:id/delete', hasPermissions('system.permission.delete'), async (req, res) => {

  if (!req.user || !req.tenantDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.params.id;

  try {
    const deletedPermission = await req.tenantDb.delete(permissionTable).where(
      eq(permissionTable.id, idParam)
    ).returning()
      .then((rows: any[]) => rows[0]);

    if (!deletedPermission) {
      return res.status(404).json({ error: "Permission not found" });
    }

    res.status(200).json({ message: "Permission deleted successfully" });
  } catch (error) {
    console.error("Error deleting permission:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


export default permissionRoutes;