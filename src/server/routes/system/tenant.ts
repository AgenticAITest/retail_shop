import bcrypt from 'bcryptjs';
import { and, asc, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { Router } from 'express';
import { role, user, userRole } from "src/server/lib/db/schema/tenantSchema";
import { tenant } from "src/server/lib/db/schema/sharedSchema";
import { authenticated, authorized, hasPermissions, hasRoles, resolveTenantContext } from 'src/server/middleware/authMiddleware';
import { validateData } from 'src/server/middleware/validationMiddleware';
import { tenantCodeValidationSchema, tenantCodeValidator, tenantSchema, tenantValidator } from 'src/server/schemas/tenantSchema';
import { ZodError } from 'zod';
import { createTenantSchema, deleteTenantSchema, getTenantDb } from '@server/lib/db/tenant-connection-manager';
import * as tenantTableSchema from 'src/server/lib/db/schema/tenantSchema';
import { de } from 'date-fns/locale';

const tenantRoutes = Router();
tenantRoutes.use(resolveTenantContext());
tenantRoutes.use(authenticated());

/**
 * @swagger
 * /api/system/tenant:
 *   get:
 *     tags:
 *       - System - Tenant
 *     summary: Get all tenants
 *     description: Retrieve a list of all tenants
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
 *         description: A list of tenants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tenant'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Tenant:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The tenant ID
 *         code:
 *           type: string
 *           description: The code of the tenant
 *         name:
 *           type: string
 *           description: The name of the tenant
 *         description:
 *           type: string
 *           description: A description of the tenant
 */
tenantRoutes.get('/', hasPermissions('system.tenant.view'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!req.user.tenantId) {
    return res.status(400).json({ error: "Tenant context required 2" });
  }

  // Get pagination params from URL
  const pageParam = req.query.page as string;
  const perPageParam = req.query.perPage as string;
  const sortParam = req.query.sort || 'code';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';

  // Map allowed sort keys to columns
  const sortColumns = {
    id: tenant.id,
    code: tenant.code,
    name: tenant.name,
    description: tenant.description
    // add other columns as needed
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || tenant.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = filterParam
    ? and(
      or(
        ilike(tenant.code, `%${filterParam}%`),
        ilike(tenant.name, `%${filterParam}%`),
        ilike(tenant.description, `%${filterParam}%`)
      ),
      eq(tenant.id, req.user!.tenantId)
    )
    : eq(tenant.id, req.user!.tenantId);

  // TODO: check filter param

  // Get total count with filter
  const [{ value: total }] = await req.sharedDb!
    .select({ value: count() })
    .from(tenant)
    .where(filterCondition);

  // Get paginated, sorted, filtered permissions
  const tenants = await req.sharedDb!
    .select()
    .from(tenant)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  return res.json({
    tenants: tenants,
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
 * /api/system/tenant/add:
 *   post:
 *     tags:
 *       - System - Tenant
 *     summary: Add a new  tenant
 *     description: Create a new tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tenant created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     TenantForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The tenant ID
 *         code:
 *           type: string
 *           description: The code of the tenant
 *         name:
 *           type: string
 *           description: The name of the tenant
 *         description:
 *           type: string
 *           description: A description of the tenant
 */
tenantRoutes.post('/add', hasRoles('SYSADMIN'), async (req, res) => {
  const { code, name, description } = req.body;

  if (!req.sharedDb || !req.tenantDb) {
      return res.status(400).json({ message: 'Shared or Tenant database not available' });
    }
  
  const validator = tenantValidator(req.sharedDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {

    // get current user
    const currentUser = await req.tenantDb.select().from(user).where(eq(user.username, req.user!.username)).then((rows) => rows[0]);

     // insert new tenant
    let newTenant = await req.sharedDb.insert(tenant).values({
        id: crypto.randomUUID(),
        code,
        name,
        description
      })
      .returning()
      .then((rows) => rows[0]);

    // create tenant-specific database schema
    await createTenantSchema(newTenant.code);

    const newTenantDb = await getTenantDb(newTenant.code, tenantSchema);

    await newTenantDb.transaction(async (tx) => {
      // insert admin role for the new tenant
      const newAdminRole = await tx.insert(tenantTableSchema.role).values({
        id: crypto.randomUUID(),
        code: 'ADMIN',
        name: 'Administrator',
        isSystem: false,
        description: 'Full access to all features',
      }).returning().then((rows) => rows[0]);

      // insert user role & guest rolefor the new tenant
      await tx.insert(tenantTableSchema.role).values([
        {id: crypto.randomUUID(), code: 'USER', name: 'User', isSystem: false, description: 'Regular user role'},
        {id: crypto.randomUUID(), code: 'GUEST', name: 'Guest', isSystem: false, description: 'Guest role'}
      ]);

      //const newUsername = `${username}@${activeTenantCode}`;
      const newUser = await tx.insert(tenantTableSchema.user).values({ 
        id: crypto.randomUUID(), 
        username : currentUser.username, 
        passwordHash:currentUser.passwordHash, 
        fullname: currentUser.fullname, 
        email: currentUser.email, 
        status: 'active'
      }).returning().then((rows) => rows[0]);;

      await tx.insert(tenantTableSchema.userRole).values({ userId: newUser.id, roleId: newAdminRole.id });

      const permIds = await tx.insert(tenantTableSchema.permission).values([
        //  tenant permission
        { id: crypto.randomUUID(), code: "system.tenant.view", name: "View Tenant", description: "Permission to view tenant"},
        //{ id: crypto.randomUUID(), code: "system.tenant.create", name: "Create Tenant", description: "Permission to add tenant"},
        { id: crypto.randomUUID(), code: "system.tenant.edit", name: "Edit Tenant", description: "Permission to edit tenant"},
        //{ id: crypto.randomUUID(), code: "system.tenant.delete", name: "Delete Tenant", description: "Permission to delete tenant"},

        { id: crypto.randomUUID(), code: "system.user.view", name: "View User", description: "Permission to view user"},
        { id: crypto.randomUUID(), code: "system.user.create", name: "Create User", description: "Permission to add user"},
        { id: crypto.randomUUID(), code: "system.user.edit", name: "Edit User", description: "Permission to edit user"},
        { id: crypto.randomUUID(), code: "system.user.delete", name: "Delete User", description: "Permission to delete user"},
        { id: crypto.randomUUID(), code: "system.user.reset_password", name: "Reset Password", description: "Permission to reset password user"},

        { id: crypto.randomUUID(), code: "system.role.view", name: "View Role", description: "Permission to view role"},
        { id: crypto.randomUUID(), code: "system.role.create", name: "Create Role", description: "Permission to add role"},
        { id: crypto.randomUUID(), code: "system.role.edit", name: "Edit Role", description: "Permission to edit role"},
        { id: crypto.randomUUID(), code: "system.role.delete", name: "Delete Role", description: "Permission to delete role"},

        { id: crypto.randomUUID(), code: "system.permission.view", name: "View Permission", description: "Permission to view permission"},
        { id: crypto.randomUUID(), code: "system.permission.create", name: "Create Permission", description: "Permission to add permission"},
        { id: crypto.randomUUID(), code: "system.permission.edit", name: "Edit Permission", description: "Permission to edit permission"},
        { id: crypto.randomUUID(), code: "system.permission.delete", name: "Delete Permission", description: "Permission to delete permission"},  
    
        { id: crypto.randomUUID(), code: "system.option.view", name: "View Option", description: "Permission to view option"},
        { id: crypto.randomUUID(), code: "system.option.create", name: "Create Option", description: "Permission to add option"},
        { id: crypto.randomUUID(), code: "system.option.edit", name: "Edit Option", description: "Permission to edit option"},
        { id: crypto.randomUUID(), code: "system.option.delete", name: "Delete Option", description: "Permission to delete option"},

        { id: crypto.randomUUID(), code: "system.module.view", name: "View Modules", description: "Permission to view modules"},
        { id: crypto.randomUUID(), code: "system.module.manage", name: "Manage Modules", description: "Permission to manage modules"},

      ]).returning().then((rows) => rows.map(r => r.id));

      permIds.forEach(async permId => {
        await tx.insert(tenantTableSchema.rolePermission).values({ roleId: newAdminRole.id, permissionId: permId });
      });
    });

    res.status(201).json(newTenant);
  } catch (error) {
    console.error("Error creating tenant:", error);
    res.status(500).json({ error: "Internal server error." });
  }

});

/**
 * @swagger
 * /api/system/tenant/validate-code:
 *   post:
 *     tags:
 *       - System - Tenant
 *     summary: Validate tenant code
 *     description: Check if the tenant code is unique 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant code is valid
 *       400:
 *         description: Tenant code must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     TenantCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The tenant ID
 *         code:
 *           type: string
 *           description: The code of the tenant
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the tenant
 */
tenantRoutes.post("/validate-code", hasPermissions('system.tenant.edit'), validateData(tenantCodeValidationSchema), async (req, res) => {
  if (!req.sharedDb || !req.tenantDb) {
    return res.status(400).json({ message: 'Shared or Tenant database not available' });
  }
  
  const validator = tenantCodeValidator(req.sharedDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });
  
  res.status(200).json({ message: "Tenant code is valid." });
});

/**
 * @swagger
 * /api/system/tenant/current:
 *   get:
 *     tags:
 *       - System - Tenant
 *     summary: Get current tenant info
 *     description: Retrieve current tenant information from context
 *     responses:
 *       200:
 *         description: Current tenant information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The tenant ID
 *                 code:
 *                   type: string
 *                   description: The tenant code
 *                 name:
 *                   type: string
 *                   description: The tenant name
 *                 description:
 *                   type: string
 *                   description: The tenant description
 *                 schemaName:
 *                   type: string
 *                   description: The database schema name
 *                 isActive:
 *                   type: boolean
 *                   description: Whether the tenant is active
 *       400:
 *         description: No tenant context available
 *       404:
 *         description: Tenant not found
 */
tenantRoutes.get("/current", async (req, res) => {
  try {
    // Try to get tenant code from JWT token first, then from header
    const tenantCode = req.user?.activeTenantCode || req.headers['x-tenant-code'] as string;
    
    if (!tenantCode) {
      return res.status(400).json({ 
        error: "No tenant context available",
        message: "Unable to determine current tenant" 
      });
    }

    // Get tenant information from the shared database
    const tenantInfo = await req.sharedDb!
      .select({
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
        description: tenant.description,
        schemaName: sql`CONCAT('tenant_', ${tenant.code})`.as('schemaName'),
      })
      .from(tenant)
      .where(eq(tenant.code, tenantCode))
      .limit(1);

    if (tenantInfo.length === 0) {
      return res.status(404).json({ 
        error: "Tenant not found",
        message: `Tenant with code '${tenantCode}' does not exist` 
      });
    }

    res.status(200).json(tenantInfo[0]);
  } catch (error) {
    console.error("Error getting current tenant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/tenant/{id}:
 *   get:
 *     tags:
 *       - System - Tenant
 *     summary: Get a tenant by ID
 *     description: Retrieve a specific tenant by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the tenant to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The tenant details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tenant'
 */
tenantRoutes.get('/:id', hasPermissions('system.tenant.view'), async (req, res) => {
  const idParam = req.params.id;

  try {
    const data = await req.sharedDb!
      .select()
      .from(tenant)
      .where(eq(tenant.id, idParam))
      .limit(1)
      .then((rows) => rows[0]);

    if (!data) {
      return res.status(404).json({ message: 'Data not found' });
    }

    return res.json(data);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/tenant/{id}/edit:
 *   put:
 *     tags:
 *       - System - Tenant
 *     summary: Edit system tenant
 *     description: Edit system tenant
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
 *             $ref: '#/components/schemas/TenantForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *       404:
 *         description: Tenant not found
 *       500:
 *         description: Internal server error
 */
tenantRoutes.put('/:id/edit', hasPermissions('system.tenant.edit'), validateData(tenantSchema), async (req, res) => {
  const idParam = req.params.id;
  const { id, code, name, description, status } = req.body;

  if (!req.sharedDb || !req.tenantDb) {
      return res.status(400).json({ message: 'Shared or Tenant database not available' });
    }
  
  const validator = tenantValidator(req.sharedDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  if (idParam !== id) {
    return res.status(400).json({ message: 'Invalid tenant ID' });
  }

  try {
    const updatedTenant = await req.sharedDb.update(tenant).set({
      code,
      name,
      description,
      ...(status !== undefined && { status }),
    }).where(and(
      eq(tenant.id, id),
    )
    )
      .returning()
      .then((rows) => rows[0]);

    res.status(200).json(updatedTenant);
  } catch (error) {
    console.error("Error updating tenant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/system/tenant/{id}/delete:
 *   delete:
 *     tags:
 *       - System - Tenant
 *     summary: Delete system tenant
 *     description: Delete an existing tenant by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the tenant to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant deleted successfully
 *       404:
 *         description: Tenant not found
 */
tenantRoutes.delete('/:id/delete', hasRoles('SYSADMIN'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.params.id;

  try {
    const deletedTenant = await req.sharedDb!.delete(tenant).where(and(
      eq(tenant.id, idParam),
    )).returning()
      .then((rows) => rows[0]);

    if (!deletedTenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    await deleteTenantSchema(deletedTenant.code);

    res.status(200).json({ message: "Tenant deleted successfully" });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});




export default tenantRoutes;