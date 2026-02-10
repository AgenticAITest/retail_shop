import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router } from "express";
import fileUpload from "express-fileupload";
import { format, parse } from 'fast-csv';
import { permission as permissionsTable, role as rolesTable, rolePermission as rolePermissionsTable } from "src/server/lib/db/schema/tenantSchema";
import { authenticated, authorized, hasPermissions, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { validateData } from "src/server/middleware/validationMiddleware";
import { roleCodeValidationSchema, roleCodeValidator, roleSchema, roleValidator } from "src/server/schemas/roleSchema";
import { ZodError } from "zod";


const roleRoutes = Router();
roleRoutes.use(resolveTenantContext());
roleRoutes.use(authenticated());

/**
 * @swagger
 * /api/system/role:
 *   get:
 *     tags:
 *       - System - Role
 *     summary: Get all roles
 *     description: Retrieve a list of all roles
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: The page number to retrieve
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *         description: The number of roles to retrieve per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: The field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *         description: The sort order (asc or desc)
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: A filter to apply to the role names
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The role ID
 *         code:
 *           type: string
 *           description: The code of the role
 *         name:
 *           type: string
 *           description: The name of the role
 *         description:
 *           type: string
 *           description: A description of the role
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the role
 *         isSystem:
 *           type: boolean
 *           description: Whether the role is a system role
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the role was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the role was last updated
 */
roleRoutes.get("/", hasPermissions('system.role.view'), async (req, res) => {

  if (!req.user || !req.tenantDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = req.query.sort || 'code';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';

  // Map allowed sort keys to columns from tenant schema
  const sortColumns = {
    id: rolesTable.id,
    name: rolesTable.name,
    description: rolesTable.description
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || rolesTable.name;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition
  const filterCondition = filterParam
    ? and(
      or(
        ilike(rolesTable.code, `%${filterParam}%`),
        ilike(rolesTable.name, `%${filterParam}%`),
        ilike(rolesTable.description, `%${filterParam}%`)
      ),
      eq(rolesTable.isSystem, false)
    )
    : eq(rolesTable.isSystem, false);

  // Get total count with filter
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(rolesTable)
    .where(filterCondition);

  const roleList = await req.tenantDb
    .select()
    .from(rolesTable)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    roles: roleList,
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
 * /api/system/role/add:
 *   post:
 *     tags:
 *       - System - Role
 *     summary: Add a new role
 *     description: Create a new role with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Role created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     RoleForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The role ID
 *         code:
 *           type: string
 *           description: The code of the role
 *         name:
 *           type: string
 *           description: The name of the role
 *         description:
 *           type: string
 *           description: A description of the role
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the role
 */
roleRoutes.post("/add", hasPermissions('system.role.create'), async (req, res) => {
  const { code, name, description, permissionIds } = req.body;

  let permIds: string[] = [];
  if (Array.isArray(permissionIds) && permissionIds.every(item => typeof item === 'string')) {
    permIds = permissionIds;
  }

  if (!req.tenantDb) {
    return res.status(400).json({ message: 'Tenant database not available' });
  }

  const validator = roleValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  try {
    let newRole: any;
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // insert role data
      //const roleId = crypto.randomUUID();
      newRole = await tx.insert(rolesTable).values({
        id: crypto.randomUUID(),
        code,
        name,
        description,
        isSystem: false
      }).returning()
        .then((rows: any) => rows[0]);

      if (permIds.length > 0) {
        // insert role permissions
        await tx.insert(rolePermissionsTable).values(permIds.map(permId => ({
          roleId: newRole.id,
          permissionId: permId
        })));
      }
      
    });
    res.status(201).json(newRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

//export roles to csv
/**
 * @swagger
 * /api/system/role/export:
 *   get:
 *     tags:
 *       - System - Role
 *     summary: Export roles to CSV
 *     description: Export all roles to a CSV file for download
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file containing the exported roles
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
roleRoutes.get("/export", hasPermissions('system.role.view'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const roleList = await req.tenantDb!.select().from(rolesTable)
    
    .then((rows: any) => rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description
    })));

  // Set response headers for CSV download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="data.csv"');

  // Create a writable stream for fast-csv
  const csvStream = format({ headers: true });

  // Pipe the data to the CSV stream and then to the response
  csvStream.pipe(res);

  // Write each row of data
  roleList.forEach((row: any) => csvStream.write(row));

  // End the CSV stream
  csvStream.end();

});

// import roles from csv file
roleRoutes.post("/import", hasPermissions('system.role.create'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  interface RoleRow {
    code: string;
    name: string;
    description: string;
  }

  try {

    const file = req.files?.file as fileUpload.UploadedFile;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    if (file.mimetype !== 'text/csv' && !file.name.endsWith('.csv')) {
      return res.status(400).json({ error: "Invalid file type. Only CSV files are allowed." });
    }
    
    console.log(file);

    // Parse CSV read from file.data buffer 
    const parseCSV = (file: fileUpload.UploadedFile): Promise<RoleRow[]> => {
      return new Promise((resolve, reject) => {
        const results: RoleRow[] = [];
        const stream = parse({ headers: true })
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', (error) => {
            reject(error);
          });
        
        // Write the buffer data to the stream
        stream.write(file.data);
        stream.end();
      });
    };

    const roles = await parseCSV(file);
    console.log(roles);
    
    // Validate and insert roles into the database
    await req.tenantDb!.transaction(async (tx: any) => {
      for (const roleData of roles) {
        const { code, name, description } = roleData;
        
        if (!code || !name) {
          throw new Error(`Missing required fields: code=${code}, name=${name}`);
        }
        
        await tx.insert(rolesTable).values({
          id: crypto.randomUUID(),
          code,
          name,
          description: description || '',
          isSystem: false
        });
      }
    });

    res.status(201).json({ message: "Roles imported successfully." });
  } catch (error) {
    console.error("Error importing roles:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


/**
 * @swagger
 * /api/system/role/ref-permissions:
 *   get:
 *     tags:
 *       - System - Role
 *     summary: Get reference permissions
 *     description: Fetch a list of reference permissions for role management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of reference permissions
 *       401:
 *         description: Unauthorized
 */
roleRoutes.get("/ref-permissions", hasPermissions('system.role.view'), async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const permissionList = await req.tenantDb!.select().from(permissionsTable)
      
      .then((rows: any) => rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name
      })));
    res.status(200).json(permissionList);
  } catch (error) {
    console.error("Error fetching reference permissions:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/role/validate-code:
 *   post:
 *     tags:
 *       - System - Role
 *     summary: Validate role code
 *     description: Check if the role code is unique within the tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleCodeValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role code is valid
 *       400:
 *         description: Role code must be unique within the tenant
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     RoleCodeValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The role ID
 *         code:
 *           type: string
 *           description: The code of the role
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the role
 */
roleRoutes.post("/validate-code", hasPermissions('system.role.edit'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(400).json({ message: 'Tenant database not available' });
  }

  const validator = roleCodeValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });
  
  res.status(200).json({ message: "Role code is valid." });
});

/**
 * @swagger
 * /api/system/role/{id}:
 *   get:
 *     tags:
 *       - System - Role
 *     summary: Get a role by ID
 *     description: Retrieve a specific role by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The role details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 */
roleRoutes.get("/:id", hasPermissions('system.role.view'), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {

    // Get role data
    const role = await req.tenantDb!
      .select({
        id: rolesTable.id,
        code: rolesTable.code,
        name: rolesTable.name,
        description: rolesTable.description,
      })
      .from(rolesTable)
      .where(eq(rolesTable.id, idParam))
      .limit(1)
      .then((rows: any) => rows[0]);
    
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }

    // Get role permissions
    const rolePermissions = await req.tenantDb!
      .select({
        id: permissionsTable.id,
        code: permissionsTable.code,
        name: permissionsTable.name,
        description: permissionsTable.description
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .where(eq(rolePermissionsTable.roleId, idParam));

    res.json({ ...role, permissions: rolePermissions });
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/role/{id}/edit:
 *   put:
 *     tags:
 *       - System - Role
 *     summary: Update a role
 *     description: Update the details of an existing role
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
roleRoutes.put("/:id/edit", hasPermissions('system.role.edit'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(400).json({ message: 'Tenant database not available' });
  }

  const validator = roleValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  const idParam = req.params.id;

  const sanitizedRole = await roleSchema.parseAsync(req.body);
  const { id, code, name, description, permissionIds } = sanitizedRole;

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid role ID" });
  }

  let permIds: string[] = [];
  if (Array.isArray(permissionIds) && permissionIds.every(item => typeof item === 'string')) {
    permIds = permissionIds;
  }

  try {
    let updatedRole: any;
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // delete existing role permissions
      await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, idParam));
      if (permIds.length > 0) {
        // insert new role permissions
        await tx.insert(rolePermissionsTable).values(permIds.map(permId => ({
          roleId: idParam,
          permissionId: permId
        })));
      }
      
      // update role data
      updatedRole = await tx
        .update(rolesTable)
        .set({
          code,
          name,
          description
        })
        .where(eq(rolesTable.id, id))
        .returning()
        .then((rows: any) => rows[0]);
    });


    res.status(200).json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/role/{id}/delete:
 *   delete:
 *     tags:
 *       - System - Role
 *     summary: Delete a role
 *     description: Delete an existing role by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the role to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       404:
 *         description: Role not found
 */
roleRoutes.delete("/:id/delete", hasPermissions('system.role.delete'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.params.id;
  const tenantId = req.user?.tenantId;

  try {
    let deletedRole: any;
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // delete role permission
      await tx.delete(rolePermissionsTable).where(
        and(eq(rolePermissionsTable.roleId, idParam))
      );
      // delete role
      deletedRole = await tx.delete(rolesTable).where(
        and(eq(rolesTable.id, idParam))
      ).returning().then((rows: any) => rows[0]);
    });

    if (!deletedRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});


export default roleRoutes;