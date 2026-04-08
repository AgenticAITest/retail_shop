import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { sendResetEmail } from 'src/server/lib/email';
import { authenticated, DecodedToken, resolveTenantContext } from 'src/server/middleware/authMiddleware';
import { validateData } from 'src/server/middleware/validationMiddleware';
import { tenantCodeRegistrationValidationSchema, tenantCodeRegistrationValidator, tenantRegistrationValidator, userForgetPasswordSchema, userLoginSchema, usernameValidationSchema, userRegistrationValidator, userResetPasswordSchema } from 'src/server/schemas/userSchema';
import { ZodError } from 'zod';
import * as sharedSchema from '../../lib/db/schema/sharedSchema';
import * as tenantSchema from '../../lib/db/schema/tenantSchema';
import { createTenantSchema, getSharedDb, getTenantDb } from '../../lib/db/tenant-connection-manager';
import { getRedis } from '../../lib/redis';



const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'my_access_token_secret_key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'my_refresh_token_secret_key';
const RESET_PASSWORD_TOKEN_SECRET = process.env.RESET_PASSWORD_TOKEN_SECRET || 'my_reset_password_token_secret_key';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const PIN_MAX_ATTEMPTS = 3;
const PIN_LOCKOUT_MINUTES = 15;

const authRoutes = Router();

// Login route
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login a user
 *     description: Login a user with a username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username of the user
 *               password:
 *                 type: string
 *                 description: The password of the user
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       400:
 *         description: Invalid request body
 */
authRoutes.post('/login', validateData(userLoginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    // Extract tenant code from username (format: username@TENANTCODE)
    const usernameParts = username.split('@');
    if (usernameParts.length !== 2) {
      return res.status(400).json({ message: 'Invalid credentials 1' });
    }

    const [baseUsername, tenantCode] = usernameParts;

    // Get tenant info from the shared database to validate tenant exists
    console.log(tenantCode);
    const sharedDb = await getSharedDb();
    const tenantResult = await sharedDb.select().from(sharedSchema.tenant).where(
      eq(sharedSchema.tenant.code, tenantCode.toLowerCase())
    );
    console.log(tenantResult);
    const tenant = tenantResult.at(0);
    if (!tenant) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Get tenant-specific database connection
    const tenantDb = await getTenantDb(tenant.code, tenantSchema);

    // Query user from tenant-specific schema
    const results = await tenantDb.select().from(tenantSchema.user).where(
      and(
        eq(tenantSchema.user.username, username),
        eq(tenantSchema.user.status, 'active')
      )
    );

    const user = results.at(0);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Get user's assigned location IDs
    const userLocations = await tenantDb
      .select({ locationId: tenantSchema.userLocation.locationId })
      .from(tenantSchema.userLocation)
      .where(eq(tenantSchema.userLocation.userId, user.id));
    const locationIds = userLocations.map(ul => ul.locationId);

    // Create a JWT with tenant context and location access
    const accessToken = jwt.sign({
      username: user.username,
      tenantId: tenant.id,
      activeTenantCode: tenant.code,
      locationIds,
      tokenType: 'standard',
    }, ACCESS_TOKEN_SECRET, { expiresIn: '24h' });

    const refreshToken = jwt.sign({
      username: user.username,
      tenantId: tenant.id,
      activeTenantCode: tenant.code,
    }, REFRESH_TOKEN_SECRET, { expiresIn: '48h' });

    res.json({ accessToken, refreshToken });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new user
 *     description: Register a new user with a username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The username of the user
 *               fullname:
 *                 type: string
 *                 description: The fullname of the user
 *               email:
 *                 type: string
 *                 description: The email of the user
 *               activeTenantCode:
 *                 type: string
 *                 description: The active tenant code of the user
 *               password:
 *                 type: string
 *                 description: The password of the user
 *               confirmPassword:
 *                 type: string
 *                 description: The confirm password of the user
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid request body
 */
authRoutes.post('/register', async (req, res) => {
  const { username, password, fullname, email } = req.body;

  const sharedDb = await getSharedDb();

  const tenantDb = await getTenantDb('public', tenantSchema);

  const validator = userRegistrationValidator(tenantDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10);
  
  try {
    // get public tenant
    const publicTenant = (await sharedDb.select().from(sharedSchema.tenant).where(eq(sharedSchema.tenant.code, 'public'))).at(0);
    if (!publicTenant) {
      return res.status(500).json({ message: 'Public tenant not found' });
    }

    // Get tenant-specific database connection for PUBLIC tenant
    const tenantDb = await getTenantDb(publicTenant.code, tenantSchema);

    // get public tenant USER role from tenant schema
    const publicUserRole = (await tenantDb.select().from(tenantSchema.role).where(
      eq(tenantSchema.role.code, 'USER')
    )).at(0);
    
    if (!publicUserRole) {
      return res.status(500).json({ message: 'Public user role not found' });
    }

    const newUserId = crypto.randomUUID();
    const newUsername = `${username}@${publicTenant.code}`;
    
    // Create user in tenant-specific schema
    await tenantDb.transaction(async (tx: any) => {
      await tx.insert(tenantSchema.user).values({ 
        id: newUserId, 
        username: newUsername, 
        passwordHash, 
        fullname, 
        email, 
        status: 'active', 
        activeTenantId: publicTenant.id 
      });
      await tx.insert(tenantSchema.userRole).values({ userId: newUserId, roleId: publicUserRole.id, tenantId: publicTenant.id });
    });
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (e) {
    console.error('Error during registration:', e);
    return res.status(400).json({ message: 'Bad request' });
  }
});

/**
 * @swagger
 * /api/auth/register-tenant:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a new tenant
 *     description: Register a new tenant with admin user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantCode:
 *                 type: string
 *                 description: The code of the tenant
 *               tenantName:
 *                 type: string
 *                 description: The name of the tenant
 *               username:
 *                 type: string
 *                 description: The username of the user
 *               fullname:
 *                 type: string
 *                 description: The fullname of the user
 *               email:
 *                 type: string
 *                 description: The email of the user
 *               password:
 *                 type: string
 *                 description: The password of the user
 *               confirmPassword:
 *                 type: string
 *                 description: The confirm password of the user
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid request body
 */
authRoutes.post('/register-tenant', async (req, res) => {
  const { activeTenantCode, activeTenantName, username, password, fullname, email } = req.body;

  const sharedDb = await getSharedDb();

  const validator = tenantRegistrationValidator(sharedDb);
  await validator.parseAsync(req.body).catch((error) => {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    } else {
      console.error('Unhandled error:', error);
      return res.status(500).json({ message: 'Validation error' });
    }
  });

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10);

  try {

    // insert new tenant into shared schema
    const newTenantId = crypto.randomUUID();
    await sharedDb.insert(sharedSchema.tenant).values({
      id: newTenantId,
      code: activeTenantCode,
      name: activeTenantName
    });

    // create tenant-specific database schema
    await createTenantSchema(activeTenantCode);

    const tenantDb = await getTenantDb(activeTenantCode, tenantSchema);

    await tenantDb.transaction(async (tx) => {

      // Insert retail-specific roles
      const newAdminRole = await tx.insert(tenantSchema.role).values({
        id: crypto.randomUUID(),
        code: 'ADMIN',
        name: 'Tenant Administrator',
        isSystem: false,
        description: 'Full access to all features including system settings',
      }).returning().then((rows) => rows[0]);

      await tx.insert(tenantSchema.role).values([
        { id: crypto.randomUUID(), code: 'BUSINESS_OWNER', name: 'Business Owner', isSystem: false, description: 'Consolidated dashboards, revenue reports, strategic decisions' },
        { id: crypto.randomUUID(), code: 'SHOP_MANAGER', name: 'Shop Manager', isSystem: false, description: 'Daily operations, stock management, local sales oversight, shift management' },
        { id: crypto.randomUUID(), code: 'WAREHOUSE_STAFF', name: 'Warehouse/Procurement Staff', isSystem: false, description: 'GRN processing, supplier returns, quality checks' },
        { id: crypto.randomUUID(), code: 'TRANSFER_COORDINATOR', name: 'Transfer Coordinator', isSystem: false, description: 'Create/approve transfer requests, dispatch/receive goods' },
        { id: crypto.randomUUID(), code: 'CASHIER', name: 'Cashier/POS Operator', isSystem: false, description: 'Process sales, handle payments, print receipts, open/close shifts' },
        { id: crypto.randomUUID(), code: 'VIEWER', name: 'Viewer', isSystem: false, description: 'Read-only access to reports and dashboards' },
      ]);

      // Create admin user
      const newUsername = `${username}@${activeTenantCode}`;
      const newUser = await tx.insert(tenantSchema.user).values({
        id: crypto.randomUUID(), username: newUsername, passwordHash, fullname, email, status: 'active'
      }).returning().then((rows) => rows[0]);

      await tx.insert(tenantSchema.userRole).values({ userId: newUser.id, roleId: newAdminRole.id });

      // Insert all permissions (system + retail modules)
      const permIds = await tx.insert(tenantSchema.permission).values([
        // System permissions
        { id: crypto.randomUUID(), code: "system.tenant.view", name: "View Tenant", description: "View tenant settings" },
        { id: crypto.randomUUID(), code: "system.tenant.edit", name: "Edit Tenant", description: "Edit tenant settings" },
        { id: crypto.randomUUID(), code: "system.user.view", name: "View User", description: "View users" },
        { id: crypto.randomUUID(), code: "system.user.create", name: "Create User", description: "Create users" },
        { id: crypto.randomUUID(), code: "system.user.edit", name: "Edit User", description: "Edit users" },
        { id: crypto.randomUUID(), code: "system.user.delete", name: "Delete User", description: "Delete users" },
        { id: crypto.randomUUID(), code: "system.user.reset_password", name: "Reset Password", description: "Reset user password" },
        { id: crypto.randomUUID(), code: "system.role.view", name: "View Role", description: "View roles" },
        { id: crypto.randomUUID(), code: "system.role.create", name: "Create Role", description: "Create roles" },
        { id: crypto.randomUUID(), code: "system.role.edit", name: "Edit Role", description: "Edit roles" },
        { id: crypto.randomUUID(), code: "system.role.delete", name: "Delete Role", description: "Delete roles" },
        { id: crypto.randomUUID(), code: "system.permission.view", name: "View Permission", description: "View permissions" },
        { id: crypto.randomUUID(), code: "system.permission.create", name: "Create Permission", description: "Create permissions" },
        { id: crypto.randomUUID(), code: "system.permission.edit", name: "Edit Permission", description: "Edit permissions" },
        { id: crypto.randomUUID(), code: "system.permission.delete", name: "Delete Permission", description: "Delete permissions" },
        { id: crypto.randomUUID(), code: "system.option.view", name: "View Option", description: "View options" },
        { id: crypto.randomUUID(), code: "system.option.create", name: "Create Option", description: "Create options" },
        { id: crypto.randomUUID(), code: "system.option.edit", name: "Edit Option", description: "Edit options" },
        { id: crypto.randomUUID(), code: "system.option.delete", name: "Delete Option", description: "Delete options" },
        { id: crypto.randomUUID(), code: "system.module.view", name: "View Modules", description: "View modules" },
        { id: crypto.randomUUID(), code: "system.module.manage", name: "Manage Modules", description: "Manage modules" },

        // Location permissions
        { id: crypto.randomUUID(), code: "retail.location.view", name: "View Locations", description: "View shop/warehouse locations" },
        { id: crypto.randomUUID(), code: "retail.location.create", name: "Create Location", description: "Create new locations" },
        { id: crypto.randomUUID(), code: "retail.location.edit", name: "Edit Location", description: "Edit location settings" },
        { id: crypto.randomUUID(), code: "retail.location.delete", name: "Delete Location", description: "Deactivate locations" },

        // Product permissions
        { id: crypto.randomUUID(), code: "retail.product.view", name: "View Products", description: "View product catalog" },
        { id: crypto.randomUUID(), code: "retail.product.create", name: "Create Product", description: "Create products/SKUs" },
        { id: crypto.randomUUID(), code: "retail.product.edit", name: "Edit Product", description: "Edit products" },
        { id: crypto.randomUUID(), code: "retail.product.delete", name: "Delete Product", description: "Archive products" },
        { id: crypto.randomUUID(), code: "retail.product.import", name: "Import Products", description: "Bulk import products via CSV" },

        // Supplier permissions
        { id: crypto.randomUUID(), code: "retail.supplier.view", name: "View Suppliers", description: "View suppliers" },
        { id: crypto.randomUUID(), code: "retail.supplier.create", name: "Create Supplier", description: "Create suppliers" },
        { id: crypto.randomUUID(), code: "retail.supplier.edit", name: "Edit Supplier", description: "Edit suppliers" },
        { id: crypto.randomUUID(), code: "retail.supplier.delete", name: "Delete Supplier", description: "Deactivate suppliers" },

        // Purchase Order permissions
        { id: crypto.randomUUID(), code: "retail.po.view", name: "View Purchase Orders", description: "View purchase orders" },
        { id: crypto.randomUUID(), code: "retail.po.create", name: "Create PO", description: "Create purchase orders" },
        { id: crypto.randomUUID(), code: "retail.po.edit", name: "Edit PO", description: "Edit purchase orders" },
        { id: crypto.randomUUID(), code: "retail.po.approve", name: "Approve PO", description: "Approve purchase orders" },

        // GRN permissions
        { id: crypto.randomUUID(), code: "retail.grn.view", name: "View GRN", description: "View goods received notes" },
        { id: crypto.randomUUID(), code: "retail.grn.create", name: "Create GRN", description: "Create goods received notes" },
        { id: crypto.randomUUID(), code: "retail.grn.approve", name: "Approve GRN", description: "Approve goods received notes" },

        // POS permissions
        { id: crypto.randomUUID(), code: "retail.pos.sale", name: "Process Sale", description: "Process POS sales transactions" },
        { id: crypto.randomUUID(), code: "retail.pos.return", name: "Process Return", description: "Process POS returns" },
        { id: crypto.randomUUID(), code: "retail.pos.void", name: "Void Transaction", description: "Void POS transactions" },
        { id: crypto.randomUUID(), code: "retail.pos.discount", name: "Apply Discount", description: "Apply discounts on POS" },
        { id: crypto.randomUUID(), code: "retail.pos.shift", name: "Manage Shift", description: "Open/close POS shifts" },
        { id: crypto.randomUUID(), code: "retail.pos.reprint", name: "Reprint Receipt", description: "Reprint POS receipts" },

        // Transfer permissions
        { id: crypto.randomUUID(), code: "retail.transfer.view", name: "View Transfers", description: "View stock transfers" },
        { id: crypto.randomUUID(), code: "retail.transfer.create", name: "Create Transfer", description: "Create stock transfers" },
        { id: crypto.randomUUID(), code: "retail.transfer.approve", name: "Approve Transfer", description: "Approve stock transfers" },
        { id: crypto.randomUUID(), code: "retail.transfer.dispatch", name: "Dispatch Transfer", description: "Dispatch stock transfers" },
        { id: crypto.randomUUID(), code: "retail.transfer.receive", name: "Receive Transfer", description: "Receive stock transfers" },

        // Inventory permissions
        { id: crypto.randomUUID(), code: "retail.inventory.view", name: "View Inventory", description: "View stock levels" },
        { id: crypto.randomUUID(), code: "retail.inventory.adjust", name: "Adjust Stock", description: "Manual stock adjustments" },
        { id: crypto.randomUUID(), code: "retail.inventory.count", name: "Stock Count", description: "Perform stock counts" },

        // Report permissions
        { id: crypto.randomUUID(), code: "retail.report.view", name: "View Reports", description: "View reports and analytics" },
        { id: crypto.randomUUID(), code: "retail.report.export", name: "Export Reports", description: "Export reports to PDF/Excel/CSV" },

        // Tax permissions
        { id: crypto.randomUUID(), code: "retail.tax.view", name: "View Tax Config", description: "View tax configuration" },
        { id: crypto.randomUUID(), code: "retail.tax.edit", name: "Edit Tax Config", description: "Edit tax configuration" },

        // Approval permissions
        { id: crypto.randomUUID(), code: "retail.approval.view", name: "View Approvals", description: "View pending approvals" },
        { id: crypto.randomUUID(), code: "retail.approval.manage", name: "Manage Approvals", description: "Configure approval rules" },
        { id: crypto.randomUUID(), code: "retail.approval.action", name: "Action Approvals", description: "Approve or reject pending items" },

      ]).returning().then((rows) => rows.map(r => r.id));

      // Assign all permissions to ADMIN role
      for (const permId of permIds) {
        await tx.insert(tenantSchema.rolePermission).values({ roleId: newAdminRole.id, permissionId: permId });
      }

    });
    res.status(201).json({ message: 'Tenant registered successfully' });
  } catch (e) {
    console.error('Error during registration:', e);
    return res.status(400).json({ message: 'Bad request' });
  }
});

/**
 * @swagger
 * /api/auth/validate-username:
 *   post:
 *     tags:
 *       - Auth
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
authRoutes.post("/validate-username", validateData(usernameValidationSchema), async (req, res) => {
  // const { activeTenantCode } = req.body;
  // const tenantDb = await getTenantDb(activeTenantCode, tenantSchema);
  // if (!tenantDb) {
  //   return res.status(400).json({ message: 'Tenant database not available' });
  // }

  // const validator = usernameValidator(tenantDb);
  // await validator.parseAsync(req.body).catch((error) => {
  //   if (error instanceof ZodError) {
  //     return res.status(400).json({ message: 'Invalid data', details: error.issues });
  //   } else {
  //     console.error('Unhandled error:', error);
  //     return res.status(500).json({ message: 'Validation error' });
  //   }
  //});

  res.status(200).json({ message: "Username is valid." });
});

/**
 * @swagger
 * /api/auth/validate-tenantcode:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Validate tenant code
 *     description: Check if the tenant code is unique
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TenantCodeRegistrationValidation'
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant code is valid
 *       400:
 *         description: Tenant code must be unique
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     TenantCodeRegistrationValidation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The tenant ID
 *         activeTenantCode:
 *           type: string
 *           description: The code of the tenant
 *         tenantId:
 *           type: string
 *           description: The tenant ID associated with the tenant
 */
authRoutes.post("/validate-tenantcode", validateData(tenantCodeRegistrationValidationSchema), async (req, res) => {
  const sharedDb = await getSharedDb();

  const validator = tenantCodeRegistrationValidator(sharedDb);
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
* /api/auth/forget-password:
*   post:
*     tags:
*       - Auth
*     summary: Forget password
*     description: Send a password reset link to the user's email
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/AuthForgetPassword'
*     responses:
*       200:
*         description: Password reset link sent successfully
*       400:
*         description: Invalid request body
*/
/**
 * @swagger
 * components:
 *   schemas:
 *     AuthForgetPassword:
 *       type: object
 *       properties:
 *         username:
 *           type: string
 *           description: The username of the user
 */
authRoutes.post("/forget-password", validateData(userForgetPasswordSchema), async (req, res) => {
  const { username } = req.body;
  console.log("Forget password request for username:", username);

  // parse username to get tenant code
  const [userPart, tenantPart] = username.split('@');

  const tenantDb = await getTenantDb(tenantPart, tenantSchema);
  const user = await tenantDb.select().from(tenantSchema.user).where(eq(tenantSchema.user.username, username))
    .limit(1)
    .then(results => results.at(0));

  if (user && user.email !== null) {
    const token = jwt.sign(
      { username: user.username, type: 'password-reset' },
      RESET_PASSWORD_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
    const resetLink = `${BASE_URL}/auth/reset-password?token=${token}`;
    await sendResetEmail(user.email, resetLink);
  }

  res.status(200).json({ message: "Password reset link sent." });

});

// get user by reset password jwt token
/**
 * @swagger
 * /api/auth/reset-password:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get user by reset password token
 *     description: Retrieve user information using the reset password token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         description: The reset password token
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *       400:
 *         description: Invalid token
 */
authRoutes.get("/reset-password", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    return res.status(400).json({ message: "Invalid token" });
  }

  try {
    const decoded = jwt.verify(token, RESET_PASSWORD_TOKEN_SECRET) as DecodedToken;
    if (!decoded.username) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    

    // parse username to get tenant code
    const [userPart, tenantPart] = decoded.username.split('@');

    const tenantDb = await getTenantDb(tenantPart, tenantSchema);

    // get tenant info from shared db
    const sharedDb = await getSharedDb();
    const tenantResult = await sharedDb.select().from(sharedSchema.tenant).where(
      eq(sharedSchema.tenant.code, tenantPart.toLowerCase())
    );

    const tenant = tenantResult.at(0);

    if (!tenant) {
      return res.status(400).json({ message: 'Invalid token' });
    }

    const user = await tenantDb.select().from(tenantSchema.user).where(eq(tenantSchema.user.username, decoded.username)).limit(1).then(results => results.at(0));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ id: user.id, activeTenantId: tenant.id });
  } catch (error) {
    console.error("Error verifying reset password token:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//post reset password
/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Reset password
 *     description: Reset user password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthResetPassword'
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid request body
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     AuthResetPassword:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user ID
 *         activeTenantId:
 *           type: string
 *           description: The active tenant ID associated with the user
 *         password:
 *           type: string
 *           description: The new password for the user
 *         confirmPassword:
 *           type: string
 *           description: The confirmation of the new password
 */
authRoutes.post("/reset-password", validateData(userResetPasswordSchema), async (req, res) => {
  const { id, activeTenantId, password } = req.body;

  // Get tenant info from shared db
  const sharedDb = await getSharedDb();
  const tenantResult = await sharedDb.select().from(sharedSchema.tenant).where(
    eq(sharedSchema.tenant.id, activeTenantId)
  );
  
  const tenant = tenantResult.at(0);
  if (!tenant) {
    return res.status(400).json({ message: 'Invalid tenant' });
  }

  // Get tenant-specific database connection
  const tenantDb = await getTenantDb(tenant.code, tenantSchema);

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    // Update the user's password in the database
    await tenantDb.update(tenantSchema.user).set({ passwordHash }).where(eq(tenantSchema.user.id, id));

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: Refresh access token using refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: The refresh token of the user
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 *       400:
 *         description: Invalid request body
 */
authRoutes.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as DecodedToken;
      const accessToken = jwt.sign({ username: decoded.username }, ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      return res.json({ accessToken });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Token expired.' });
      }
      return res.status(401).json({ message: 'Invalid token.' });
    }
  } else {
    return res.status(400).json({ message: 'Invalid request body' });
  }
})


// User route
/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * /api/auth/user:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get user information
 *     description: Get user information using access token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *       500:
 *         description: User information not found after authentication.
 */
authRoutes.get('/user', resolveTenantContext(), authenticated(), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb) {
    res.status(500).json({ message: 'Shared or tenant database connection not found.' });
    return;
  }

  if (req.user) {

    // get tenant info from shared db
    const sharedDb = req.sharedDb;
    const tenantResult = await sharedDb.select().from(sharedSchema.tenant).where(
      eq(sharedSchema.tenant.code, req.tenantCode || '')
    );

    const tenant = tenantResult.at(0);

    if (!tenant) {
      res.status(400).json({ message: 'Active tenant not found' });
      return;
    }

    // First get the user from shared database
    const userData = await req.tenantDb.query.user.findFirst({
      columns: {
        id: true,
        username: true,
        fullname: true,
        email: true,
        avatar: true,
        status: true
      },
      where: eq(tenantSchema.user.username, req.user?.username),
    });

    if (!userData) {
      res.status(404).json({ message: 'Username not found' });
      return;
    }

     // add activeTenant info to user object
     const user = {
      ...userData,
      activeTenant: {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name
      }
    };

    // if (!user.activeTenant) {
    //   res.status(400).json({ message: 'User has no active tenant' });
    //   return;
    // }

    try {
      // Get tenant-specific database connection
      const tenantDb = req.tenantDb;

      // Query roles and permissions from tenant database
      const userRoles = await tenantDb
        .select({
          roleId: tenantSchema.role.id,
          roleCode: tenantSchema.role.code
        })
        .from(tenantSchema.userRole)
        .innerJoin(tenantSchema.role, eq(tenantSchema.userRole.roleId, tenantSchema.role.id))
        .where(eq(tenantSchema.userRole.userId, user.id));

      if (userRoles.length === 0) {
        // User has no roles, return empty arrays
        res.json({
          ...user,
          roles: [],
          permissions: []
        });
        return;
      }

      const rolePermissions = await tenantDb
        .select({
          roleId: tenantSchema.role.id,
          permissionCode: tenantSchema.permission.code
        })
        .from(tenantSchema.rolePermission)
        .innerJoin(tenantSchema.role, eq(tenantSchema.rolePermission.roleId, tenantSchema.role.id))
        .innerJoin(tenantSchema.permission, eq(tenantSchema.rolePermission.permissionId, tenantSchema.permission.id))
        .where(
          inArray(
            tenantSchema.role.id,
            userRoles.map((ur: any) => ur.roleId)
          )
        );

      // Extract roles and permissions
      const roles = userRoles.map((ur: any) => ur.roleCode);
      const permissions = [...new Set(rolePermissions.map((rp: any) => rp.permissionCode))];

      res.json({
        ...user,
        roles,
        permissions
      });

    } catch (error) {
      console.error('Error fetching user roles and permissions:', error);
      // Return user data without roles/permissions if tenant DB query fails
      res.json({
        ...user,
        roles: [],
        permissions: []
      });
    }

  } else {
    res.status(500).json({ message: 'User information not found after authentication.' });
  }
});

// ============================================================
// PIN LOGIN (POS cashier fast-switch)
// ============================================================

/**
 * @swagger
 * /api/auth/login/pin:
 *   post:
 *     tags:
 *       - Auth
 *     summary: POS PIN login
 *     description: Fast login for cashiers using 6-digit PIN. Returns short-lived token (1 hour).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Full username (user@tenant)
 *               pin:
 *                 type: string
 *                 description: 6-digit PIN
 *     responses:
 *       200:
 *         description: PIN login successful
 *       400:
 *         description: Invalid PIN or account locked
 *       423:
 *         description: Account locked due to too many failed attempts
 */
authRoutes.post('/login/pin', async (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ message: 'Username and PIN are required' });
  }

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
  }

  try {
    const usernameParts = username.split('@');
    if (usernameParts.length !== 2) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const [, tenantCode] = usernameParts;

    const sharedDb = await getSharedDb();
    const tenantResult = await sharedDb.select().from(sharedSchema.tenant).where(
      eq(sharedSchema.tenant.code, tenantCode.toLowerCase())
    );
    const tenant = tenantResult.at(0);
    if (!tenant) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const tenantDb = await getTenantDb(tenant.code, tenantSchema);

    const results = await tenantDb.select().from(tenantSchema.user).where(
      and(
        eq(tenantSchema.user.username, username),
        eq(tenantSchema.user.status, 'active')
      )
    );

    const user = results.at(0);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.pinHash) {
      return res.status(400).json({ message: 'PIN not set. Please set your PIN first.' });
    }

    // Check lockout
    if (user.pinLockedUntil && new Date(user.pinLockedUntil) > new Date()) {
      const remainingMs = new Date(user.pinLockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(423).json({
        message: `Account locked. Try again in ${remainingMin} minute(s).`,
        lockedUntil: user.pinLockedUntil,
      });
    }

    // Verify PIN
    const isMatch = await bcrypt.compare(pin, user.pinHash);
    if (!isMatch) {
      const attempts = (user.pinFailedAttempts || 0) + 1;

      if (attempts >= PIN_MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60 * 1000);
        await tenantDb.update(tenantSchema.user).set({
          pinFailedAttempts: attempts,
          pinLockedUntil: lockedUntil,
        }).where(eq(tenantSchema.user.id, user.id));

        return res.status(423).json({
          message: `Too many failed attempts. Account locked for ${PIN_LOCKOUT_MINUTES} minutes.`,
          lockedUntil,
        });
      }

      await tenantDb.update(tenantSchema.user).set({
        pinFailedAttempts: attempts,
      }).where(eq(tenantSchema.user.id, user.id));

      return res.status(400).json({
        message: 'Invalid PIN',
        remainingAttempts: PIN_MAX_ATTEMPTS - attempts,
      });
    }

    // PIN correct — reset failed attempts
    await tenantDb.update(tenantSchema.user).set({
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    }).where(eq(tenantSchema.user.id, user.id));

    // Get user's location IDs
    const userLocations = await tenantDb
      .select({ locationId: tenantSchema.userLocation.locationId })
      .from(tenantSchema.userLocation)
      .where(eq(tenantSchema.userLocation.userId, user.id));

    const locationIds = userLocations.map(ul => ul.locationId);

    // Issue short-lived POS token (1 hour)
    const accessToken = jwt.sign({
      username: user.username,
      tenantId: tenant.id,
      activeTenantCode: tenant.code,
      locationIds,
      tokenType: 'pin',
    }, ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    res.json({ accessToken, tokenType: 'pin', expiresIn: 3600 });

  } catch (error) {
    console.error('PIN login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================================
// SET PIN (Cashier PIN setup)
// ============================================================

/**
 * @swagger
 * /api/auth/set-pin:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Set or update POS PIN
 *     description: Set a 6-digit PIN for POS fast login. Requires authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pin:
 *                 type: string
 *                 description: New 6-digit PIN
 *               currentPassword:
 *                 type: string
 *                 description: Current password for verification
 *     responses:
 *       200:
 *         description: PIN set successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized or incorrect password
 */
authRoutes.post('/set-pin', resolveTenantContext(), authenticated(), async (req, res) => {
  const { pin, currentPassword } = req.body;

  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be exactly 6 digits' });
  }

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required to set PIN' });
  }

  try {
    if (!req.tenantDb || !req.user) {
      return res.status(500).json({ message: 'Tenant context not available' });
    }

    const userResult = await req.tenantDb.select().from(tenantSchema.user).where(
      eq(tenantSchema.user.username, req.user.username)
    );
    const user = userResult.at(0);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Hash and set the PIN
    const pinHash = await bcrypt.hash(pin, 10);
    await req.tenantDb.update(tenantSchema.user).set({
      pinHash,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    }).where(eq(tenantSchema.user.id, user.id));

    res.json({ message: 'PIN set successfully' });

  } catch (error) {
    console.error('Set PIN error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================================
// LOGOUT (Token blacklisting via Redis)
// ============================================================

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Logout user
 *     description: Blacklists the access token in Redis to prevent reuse
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: No token provided
 */
authRoutes.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Decode token to get expiry
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        const redis = getRedis();
        await redis.setex(`token_blacklist:${token}`, ttl, '1');
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ message: 'Logged out successfully' });
  }
});

export default authRoutes;
