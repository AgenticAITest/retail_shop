import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { Router } from "express";
//import { db } from "src/server/lib/db";
import { user as userTable, role as roleTable, userRole as userRoleTable, user } from "src/server/lib/db/schema/tenantSchema";
import { tenant } from "src/server/lib/db/schema/sharedSchema";
import { authenticated, authorized, hasPermissions, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { validateData } from "src/server/middleware/validationMiddleware";
import { userAddSchema, userAddValidator, userEditSchema, userEditValidator, usernameValidationSchema, usernameValidator, userResetPasswordSchema } from "src/server/schemas/userSchema";
import permissionRoutes from "./permission";
import { ZodError } from "zod";

const userRoutes = Router();
userRoutes.use(resolveTenantContext());
userRoutes.use(authenticated());

/**
 * @swagger
 * /api/system/user:
 *   get:
 *     tags:
 *       - System - User
 *     summary: Get all users
 *     description: Retrieve a list of all users
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
 *         description: The number of users to retrieve per page
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
 *         description: A filter to apply to the users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username of the user
 *         fullname:
 *           type: string
 *           description: The fullname of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         tenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         avatar:
 *           type: string
 *           description: The avatar URL of the user
 *         status:
 *           type: string
 *           description: The status of the user (e.g., active, inactive)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the user was last updated
 */
userRoutes.get("/",  hasPermissions('system.user.view'), async (req, res) => {

  if (!req.user || !req.tenantDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pageParam = req.query.page as string | undefined;
  const perPageParam = req.query.perPage as string | undefined;
  const sortParam = req.query.sort || 'username';
  const orderParam = req.query.order || 'asc';
  const filterParam = req.query.filter || '';

  // Map allowed sort keys to columns
  const sortColumns = {
    id: userTable.id,
    username: userTable.username,
    fullname: userTable.fullname,
    email: userTable.email
  } as const;

  // Fallback to 'name' if sortParam is not a valid key
  const sortColumn = sortColumns[sortParam as keyof typeof sortColumns] || userTable.username;

  const page = pageParam ? parseInt(pageParam) : 1;
  const perPage = perPageParam ? parseInt(perPageParam) : 10;
  const offset = (page - 1) * perPage;

  // Build filter condition (remove tenant filtering since we're in tenant-specific schema)
  const filterCondition = filterParam
    ? and(
      or(
        ilike(userTable.username, `%${filterParam}%`),
        ilike(userTable.fullname, `%${filterParam}%`),
        ilike(userTable.email, `%${filterParam}%`)
      ),
      ne(userTable.username, 'sysadmin')
    )
    : ne(userTable.username, 'sysadmin');

  // Get total count with filter using tenant-specific db
  const [{ value: total }] = await req.tenantDb
    .select({ value: count() })
    .from(userTable)
    .where(filterCondition);

  const userList = await req.tenantDb
    .select(
      {
        id: userTable.id,
        username: userTable.username,
        fullname: userTable.fullname,
        email: userTable.email,
        avatar: userTable.avatar,
        status: userTable.status,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt
      }
    )
    .from(userTable)
    .where(filterCondition)
    .orderBy(orderParam === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset);

  res.json({
    users: userList,
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
 * /api/system/user/add:
 *   post:
 *     tags:
 *       - System - User
 *     summary: Add a new user
 *     description: Create a new user with the provided details
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserAddForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User created successfully
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     UserAddForm:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: The username of the user
 *         fullname:
 *           type: string
 *           description: The fullname of the user
 *         password:
 *           type: string
 *           description: The password of the user
 *         tenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         avatar:
 *           type: string
 *           description: The avatar of the user
 *         roleIds:
 *           type: array
 *           items:
 *             type: string
 *           description: The list of role IDs associated with the user
 */
userRoutes.post("/add", hasPermissions('system.user.create'), async (req, res) => {
  const { username, fullname, password, activeTenantId, email, avatar, roleIds } = req.body;

  if (!req.user || !req.tenantDb || !req.tenantInfo) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validator = userAddValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  let selectedRoleIds: string[] = [];
  if (Array.isArray(roleIds) && roleIds.every(item => typeof item === 'string')) {
    selectedRoleIds = roleIds;
  }

  // Verify the request is for the current tenant
  if (req.tenantInfo.id !== activeTenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const newUsername = `${username}@${req.tenantInfo.code}`;
    let newUser: any;
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Use tenant-specific database for transaction
    await req.tenantDb.transaction(async (tx: any) => {
      // insert user data
      newUser = await tx.insert(userTable).values({
        id: crypto.randomUUID(),
        username : newUsername,
        fullname,
        passwordHash,
        email,
        avatar,
        status: 'active'
      }).returning()
        .then((rows: any) => rows[0]);

      if (selectedRoleIds.length>0) {
        // insert user roles
        await tx.insert(userRoleTable).values(selectedRoleIds.map(roleId => ({
          userId: newUser.id,
          roleId
        })));
      }
    });

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      fullname: newUser.fullname,
      email: newUser.email,
      avatar: newUser.avatar,
      status: newUser.status,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    });

  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/user/ref-roles:
 *   get:
 *     tags:
 *       - System - User
 *     summary: Get reference roles
 *     description: Fetch a list of reference roles for user management
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of reference roles
 *       401:
 *         description: Unauthorized
 */
userRoutes.get("/ref-roles",  hasPermissions('system.user.view'), async (req, res) => {
  if (!req.user || !req.tenantDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    if (!req.tenantDb) {
      return res.status(401).json({ error: "Tenant context required" });
    }

    const roleList = await req.tenantDb.select().from(roleTable)
      .then((rows: any) => rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name
      })));
    res.status(200).json(roleList);
  } catch (error) {
    console.error("Error fetching reference roles:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/user/validate-username:
 *   post:
 *     tags:
 *       - System - User
 *     summary: Validate username
 *     description: Check if the username is unique
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UsernameValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Username is valid
 *       400:
 *         description: Username must be unique 
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     UsernameValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username
 *
 */
userRoutes.post("/validate-username", hasPermissions('system.user.edit'), async (req, res) => {
  if (!req.tenantDb) {
    return res.status(400).json({ message: 'Tenant database not available' });
  }

  const validator = usernameValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });
  res.status(200).json({ message: "Username is valid." });
});

// // get userTenants
// /**
//  * @swagger
//  * /api/system/user/user-tenants:
//  *   get:
//  *     tags:
//  *       - System - User
//  *     summary: Get user tenants
//  *     description: Retrieve a list of tenants associated with the current user
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: A list of user tenants
//  *       404:
//  *         description: User not found
//  */
// userRoutes.get('/user-tenants',  async (req, res) => {
//   const username = req.user?.username;

//   if (!username) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   try {
//     const userTenants = await db.query.user.findFirst({
//       where: eq(user.username, username),
//       with: {
//         tenants: {
//           columns: {
//             userId: false,
//             tenantId: false
//           },
//           with: {
//             tenant: {
//               columns: {
//                 id: true,
//                 code: true,
//                 name: true,
//                 description: true
//               }
//             }
//           }
//         }
//       }
//     });

//     if (userTenants == null) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     res.status(200).json(userTenants.tenants.map(ut => ut.tenant));
//   } catch (error) {
//     console.error("Error fetching user tenants:", error);
//     res.status(500).json({ error: "Internal server error." });
//   }
// }); 

// // post switch-tenant
// /**
//  * @swagger
//  * /api/system/user/switch-tenant:
//  *   post:
//  *     tags:
//  *       - System - User
//  *     summary: Set active tenant
//  *     description: Update the active tenant for the current user
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               tenantId:
//  *                 type: string
//  *                 description: The ID of the tenant to set as active
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Active tenant updated successfully
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Forbidden
//  *       404:
//  *         description: Tenant not found
//  */
// userRoutes.post('/switch-tenant',  async (req, res) => {
//   const { tenantId } = req.body;

//   if (!req.user) {
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   try {

//     const currentUser = await db.select().from(user).where(eq(user.username, req.user.username)).limit(1).then((rows) => rows[0]);
//     if (!currentUser) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const selectedTenant = await db.query.userTenant.findFirst({
//       where: eq(userTenant.userId, currentUser.id)
//     });

//     if (!selectedTenant) {
//       return res.status(404).json({ error: "Tenant not found" });
//     }

//     // Note: Tenant switching in tenant-per-schema architecture needs redesign
//     // await db.update(user).set({ activeTenantId: tenantId }).where(eq(user.id, currentUser.id));
//     res.status(200).json({ message: "Active tenant updated successfully." });
//   } catch (error) {
//     console.error("Error setting active tenant:", error);
//     res.status(500).json({ error: "Internal server error." });
//   }
// });

/**
 * @swagger
 * /api/system/user/{id}:
 *   get:
 *     tags:
 *       - System - User
 *     summary: Get a user by ID
 *     description: Retrieve a specific user by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The user details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetails'
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     UserDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username of the user
 *         fullname:
 *           type: string
 *           description: The fullname of the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         tenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         avatar:
 *           type: string
 *           description: The avatar URL of the user
 *         status:
 *           type: string
 *           description: The status of the user (e.g., active, inactive)
 *         roles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The role ID
 *               code:
 *                 type: string
 *                 description: The code of the role
 *               name:
 *                 type: string
 *                 description: The name of the role
 *               description:
 *                 type: string
 *                 description: A description of the role
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the user was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the user was last updated
 */
userRoutes.get("/:id", hasPermissions('system.user.view'), async (req, res) => {
  const idParam = req.params.id;

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await req.tenantDb!.query.user.findFirst({
      columns: {
        id: true,
        username: true,
        fullname: true,
        email: true,
        avatar: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      where: eq(userTable.id, idParam),
      with: {
        roles: {
          columns: {
            userId: false,
            roleId: false
          },
          with: {
            role: {
              columns: {
                id: true,
                code: true,
                name: true,
                description: true
              }
            }
          }
        }
      }
    });
    
    if (!data) {
      return res.status(404).json({ error: "User not found" });
    }

    const roles = data.roles.map((ur: any) => ({
      id: ur.role.id,
      code: ur.role.code,
      name: ur.role.name,
      description: ur.role.description
    }));

    res.json({ ...data, roles: roles });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/user/{id}/edit:
 *   put:
 *     tags:
 *       - System - User
 *     summary: Update a user
 *     description: Update the details of an existing user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserEditForm'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     UserEditForm:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         username:
 *           type: string
 *           description: The username of the user
 *         fullname:
 *           type: string
 *           description: The fullname of the user
 *         tenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         email:
 *           type: string
 *           description: The email of the user
 *         avatar:
 *           type: string
 *           description: The avatar of the user
 *         status:
 *           type: string
 *           description: The status of the user (e.g., active, inactive)
 *         roleIds:
 *           type: array
 *           items:
 *             type: string
 *           description: The list of role IDs associated with the user
 */
userRoutes.put("/:id/edit", hasPermissions('system.user.edit'), async (req, res) => {
  const idParam = req.params.id;
  const { id, username, fullname, status, activeTenantId, email, avatar, roleIds } = req.body;

  if (!req.user || !req.tenantDb || !req.sharedDb) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const validator = userEditValidator(req.tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  if (req.user?.tenantId !== activeTenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  // get tenant
  const currentTenant = await req.sharedDb.select().from(tenant)
    .where(eq(tenant.id, activeTenantId)).limit(1).then((rows) => rows[0]);

  if (!currentTenant) {
    return res.status(404).json({ error: "Tenant not found" }); 
  }

  let selectedRoleIds: string[] = [];
  if (Array.isArray(roleIds) && roleIds.every(item => typeof item === 'string')) {
    selectedRoleIds = roleIds;
  }

  try {
    let updatedUser: any;
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // delete existing user roles
      await tx.delete(userRoleTable).where(eq(userRoleTable.userId, idParam));

      if (selectedRoleIds.length > 0) {
        // insert new role permissions
        await tx.insert(userRoleTable).values(selectedRoleIds.map(roleId => ({
          userId: idParam,
          roleId: roleId
        })));
      }
      
      // update user data
      const updatedUsername = `${username}@${currentTenant.code}`;
      updatedUser = await tx
        .update(userTable)
        .set({
          username: updatedUsername,
          fullname,
          email,
          avatar,
          status
        })
        .where(eq(userTable.id, id))
        .returning()
        .then((rows: any) => rows[0]);
    });


    res.status(200).json({
      id: updatedUser.id,
      username: updatedUser.username,
      fullname: updatedUser.fullname,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      tenantId: updatedUser.tenantId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/user/{id}/reset-password:
 *   post:
 *     tags:
 *       - System - User
 *     summary: Reset user password
 *     description: Reset the password of an existing user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user whose password is to be reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserResetPassword'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     UserResetPassword:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         tenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         password:
 *           type: string
 *           description: The new password for the user
 *         confirmPassword:
 *           type: string
 *           description: The confirmation of the new password
 */
userRoutes.post("/:id/reset-password", hasPermissions('system.user.edit'), validateData(userResetPasswordSchema), async (req, res) => {
  const idParam = req.params.id;
  const { id, tenantId, password, confirmPassword } = req.body;

  if (req.user?.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (idParam !== id) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    let updatedUser: any;
    const passwordHash = await bcrypt.hash(password, 10);
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // update user data
      updatedUser = await tx
        .update(userTable)
        .set({
          passwordHash
        })
        .where(
          eq(userTable.id, id)
        )
        .returning()
        .then((rows: any) => rows[0]);
    });


    res.status(200).json({
      id: updatedUser.id,
      username: updatedUser.username,
      fullname: updatedUser.fullname,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      tenantId: updatedUser.tenantId,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /api/system/user/{id}/delete:
 *   delete:
 *     tags:
 *       - System - User
 *     summary: Delete a user
 *     description: Delete an existing user by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to delete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
userRoutes.delete("/:id/delete", hasPermissions('system.user.delete'), async (req, res) => {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idParam = req.params.id;
  const tenantId = req.user?.tenantId;

  try {
    let deletedUser: any;
    // transaction
    await req.tenantDb!.transaction(async (tx: any) => {
      // delete user roles
      await tx.delete(userRoleTable).where(
        and(eq(userRoleTable.userId, idParam))
      );

      // delete user
      deletedUser = await tx.delete(userTable).where(
        and(eq(userTable.id, idParam))
      ).returning().then((rows: any) => rows[0]);
    });

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default userRoutes;