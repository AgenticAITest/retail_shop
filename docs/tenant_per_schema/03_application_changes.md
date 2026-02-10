# Phase 3: Application Layer Changes

## Task 3.1: Update Middleware for Tenant Context

### 1. Create Tenant Context Middleware

Create `src/server/middleware/tenantContextMiddleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { tenantConnectionManager } from '../lib/db/tenant-connection-manager';
import { db } from '../lib/db';
import { tenant } from '../lib/db/schema/shared';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      tenantDb?: any;
      tenantCode?: string;
      tenantSchema?: string;
      tenantId?: string;
    }
  }
}

interface TenantContextOptions {
  required?: boolean;
  allowPublic?: boolean;
  fallbackTenant?: string;
}

export function tenantContext(options: TenantContextOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        required = true,
        allowPublic = false,
        fallbackTenant = 'system'
      } = options;

      // Extract tenant code from various sources
      let tenantCode = extractTenantCode(req);
      
      // If no tenant code found and we have a fallback
      if (!tenantCode && fallbackTenant) {
        tenantCode = fallbackTenant;
      }

      // If still no tenant and it's required, return error
      if (!tenantCode && required) {
        return res.status(400).json({ 
          error: 'Tenant context is required',
          message: 'No tenant identifier found in request'
        });
      }

      // If tenant code is 'public' and not allowed, return error
      if (tenantCode === 'public' && !allowPublic) {
        return res.status(403).json({
          error: 'Public tenant access not allowed',
          message: 'This endpoint requires a specific tenant context'
        });
      }

      // Get tenant information from shared database
      const tenantRecord = await db
        .select()
        .from(tenant)
        .where(eq(tenant.code, tenantCode!))
        .limit(1);

      if (tenantRecord.length === 0) {
        return res.status(404).json({
          error: 'Tenant not found',
          message: `Tenant with code '${tenantCode}' does not exist`
        });
      }

      const tenantInfo = tenantRecord[0];

      // Check if tenant is active
      if (!tenantInfo.isActive) {
        return res.status(403).json({
          error: 'Tenant inactive',
          message: `Tenant '${tenantCode}' is currently inactive`
        });
      }

      // Get tenant database connection
      const connection = await tenantConnectionManager.getConnection(tenantCode!);

      // Set tenant context in request
      req.tenantDb = connection.db;
      req.tenantCode = tenantCode;
      req.tenantSchema = connection.schema;
      req.tenantId = tenantInfo.id;

      // Add tenant info to response headers (for debugging)
      res.set('X-Tenant-Code', tenantCode!);
      res.set('X-Tenant-Schema', connection.schema);

      next();
    } catch (error) {
      console.error('Tenant context middleware error:', error);
      res.status(500).json({ 
        error: 'Tenant context initialization failed',
        message: 'Internal server error while setting up tenant context'
      });
    }
  };
}

function extractTenantCode(req: Request): string | null {
  // Priority order for tenant extraction:
  
  // 1. Explicit header
  const headerTenant = req.get('X-Tenant-Code') || req.get('x-tenant-code');
  if (headerTenant) {
    return headerTenant.toLowerCase();
  }

  // 2. Query parameter
  const queryTenant = req.query.tenant as string;
  if (queryTenant) {
    return queryTenant.toLowerCase();
  }

  // 3. URL path parameter
  const pathTenant = req.params.tenant;
  if (pathTenant) {
    return pathTenant.toLowerCase();
  }

  // 4. Subdomain extraction
  const host = req.get('host');
  if (host) {
    const subdomain = host.split('.')[0];
    // Don't treat 'www', 'api', 'app' as tenant subdomains
    const reservedSubdomains = ['www', 'api', 'app', 'admin', 'staging', 'dev'];
    if (subdomain && !reservedSubdomains.includes(subdomain)) {
      return subdomain.toLowerCase();
    }
  }

  // 5. From authenticated user context (if available)
  if (req.user && (req.user as any).activeTenantCode) {
    return (req.user as any).activeTenantCode.toLowerCase();
  }

  // 6. From JWT token custom claim
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Decode JWT without verification (just for tenant extraction)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload.tenantCode) {
        return payload.tenantCode.toLowerCase();
      }
    } catch (error) {
      // Ignore JWT parsing errors
    }
  }

  return null;
}

// Utility middleware for specific tenant requirements
export function requireTenant(tenantCode: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.tenantCode !== tenantCode) {
      return res.status(403).json({
        error: 'Unauthorized tenant access',
        message: `This endpoint requires tenant: ${tenantCode}`
      });
    }
    next();
  };
}

// Middleware for system/admin operations (public schema)
export function systemContext() {
  return tenantContext({
    required: false,
    allowPublic: true,
    fallbackTenant: 'public'
  });
}
```

### 2. Update Authentication Middleware

Update `src/server/middleware/authMiddleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { tenantConnectionManager } from '../lib/db/tenant-connection-manager';
import { user, userRole, role } from '../lib/db/schema/tenant';
import { eq } from 'drizzle-orm';

interface JWTPayload {
  userId: string;
  tenantCode: string;
  tenantId: string;
  roles?: string[];
  permissions?: string[];
}

export function authenticated() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'No valid authorization token provided' 
        });
      }

      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET;
      
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Verify and decode token
      const decoded = jwt.verify(token, secret) as JWTPayload;
      
      // If tenant context is already set, verify it matches token
      if (req.tenantCode && req.tenantCode !== decoded.tenantCode) {
        return res.status(403).json({
          error: 'Tenant mismatch',
          message: 'Token tenant does not match request tenant context'
        });
      }

      // Set tenant context if not already set
      if (!req.tenantCode) {
        const connection = await tenantConnectionManager.getConnection(decoded.tenantCode);
        req.tenantDb = connection.db;
        req.tenantCode = decoded.tenantCode;
        req.tenantSchema = connection.schema;
        req.tenantId = decoded.tenantId;
      }

      // Get user details from tenant database
      const userRecord = await req.tenantDb
        .select()
        .from(user)
        .where(eq(user.id, decoded.userId))
        .limit(1);

      if (userRecord.length === 0) {
        return res.status(401).json({
          error: 'User not found',
          message: 'User account does not exist in tenant context'
        });
      }

      const userInfo = userRecord[0];

      // Check if user is active
      if (userInfo.status !== 'active') {
        return res.status(403).json({
          error: 'Account inactive',
          message: 'User account is not active'
        });
      }

      // Get user roles and permissions (cached from token or fresh query)
      let userRoles = decoded.roles || [];
      let userPermissions = decoded.permissions || [];

      if (userRoles.length === 0) {
        // Fetch roles from database if not in token
        const roleRecords = await req.tenantDb
          .select({ code: role.code })
          .from(userRole)
          .innerJoin(role, eq(userRole.roleId, role.id))
          .where(eq(userRole.userId, decoded.userId));

        userRoles = roleRecords.map(r => r.code);
      }

      // Set user context
      req.user = {
        id: userInfo.id,
        username: userInfo.username,
        fullname: userInfo.fullname,
        email: userInfo.email,
        avatar: userInfo.avatar,
        status: userInfo.status,
        tenantCode: decoded.tenantCode,
        tenantId: decoded.tenantId,
        roles: userRoles,
        permissions: userPermissions
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'The provided token is invalid or expired'
        });
      }

      res.status(500).json({
        error: 'Authentication failed',
        message: 'Internal server error during authentication'
      });
    }
  };
}

// Update hasRoles middleware to work without tenant_id filtering
export function hasRoles(roles: string | string[], operator: 'or' | 'and' = 'or') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    const userRoles = user.roles || [];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    // System admin always has access
    if (userRoles.includes('SYSADMIN')) {
      return next();
    }

    let hasAccess = false;

    if (operator === 'or') {
      hasAccess = requiredRoles.some(role => userRoles.includes(role));
    } else {
      hasAccess = requiredRoles.every(role => userRoles.includes(role));
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Insufficient privileges',
        message: `Required roles: ${requiredRoles.join(operator === 'or' ? ' OR ' : ' AND ')}`
      });
    }

    next();
  };
}

// Update hasPermissions middleware
export function hasPermissions(permissions: string | string[], operator: 'or' | 'and' = 'or') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    const userPermissions = user.permissions || [];
    const userRoles = user.roles || [];
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    // System admin always has access
    if (userRoles.includes('SYSADMIN')) {
      return next();
    }

    let hasAccess = false;

    if (operator === 'or') {
      hasAccess = requiredPermissions.some(permission => userPermissions.includes(permission));
    } else {
      hasAccess = requiredPermissions.every(permission => userPermissions.includes(permission));
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Insufficient privileges',
        message: `Required permissions: ${requiredPermissions.join(operator === 'or' ? ' OR ' : ' AND ')}`
      });
    }

    next();
  };
}
```

## Task 3.2: Update Route Handlers

### 1. Update User Routes

Update `src/server/routes/system/user.ts`:

```typescript
import { Router } from 'express';
import { authenticated, hasPermissions } from '../../middleware/authMiddleware';
import { tenantContext } from '../../middleware/tenantContextMiddleware';
import { user, role, userRole } from '../../lib/db/schema/tenant';
import { eq, and, asc, desc, like, sql, count } from 'drizzle-orm';

const router = Router();

// Apply middleware - tenant context is required for all user operations
router.use(authenticated());
router.use(tenantContext({ required: true }));

/**
 * @swagger
 * /api/system/user:
 *   get:
 *     summary: Get users list with pagination
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Code
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username or fullname
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/', hasPermissions('system.user.view'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    
    if (search) {
      whereConditions.push(
        sql`${user.username} ILIKE ${'%' + search + '%'} OR ${user.fullname} ILIKE ${'%' + search + '%'}`
      );
    }

    const whereClause = whereConditions.length > 0 
      ? sql`${whereConditions[0]}` 
      : undefined;

    // Get users from tenant database - no tenant_id filtering needed
    const [users, totalResult] = await Promise.all([
      req.tenantDb
        .select({
          id: user.id,
          username: user.username,
          fullname: user.fullname,
          email: user.email,
          avatar: user.avatar,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(whereClause)
        .orderBy(asc(user.username))
        .limit(limit)
        .offset(offset),

      req.tenantDb
        .select({ count: count() })
        .from(user)
        .where(whereClause)
    ]);

    const total = totalResult[0].count;

    return res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @swagger
 * /api/system/user/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Code
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 */
router.get('/:id', hasPermissions('system.user.view'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user details with roles from tenant database
    const userDetails = await req.tenantDb
      .select({
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userDetails.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user roles
    const userRoles = await req.tenantDb
      .select({
        id: role.id,
        code: role.code,
        name: role.name,
      })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(eq(userRole.userId, userId));

    const userInfo = {
      ...userDetails[0],
      roles: userRoles
    };

    return res.json(userInfo);

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * @swagger
 * /api/system/user:
 *   post:
 *     summary: Create new user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Code
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/', hasPermissions('system.user.create'), async (req, res) => {
  try {
    const { username, fullname, email, password, roleIds = [], status = 'active' } = req.body;

    // Validate required fields
    if (!username || !fullname || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Username, fullname, and password are required' 
      });
    }

    // Check if username already exists in tenant
    const existingUser = await req.tenantDb
      .select()
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({ 
        error: 'Username already exists',
        message: `User with username '${username}' already exists in this tenant`
      });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in tenant database
    const newUser = await req.tenantDb
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        username,
        fullname,
        email: email || null,
        passwordHash,
        status,
        // No tenantId needed - schema provides context
      })
      .returning();

    // Assign roles if provided
    if (roleIds.length > 0) {
      const roleAssignments = roleIds.map((roleId: string) => ({
        userId: newUser[0].id,
        roleId,
      }));

      await req.tenantDb
        .insert(userRole)
        .values(roleAssignments);
    }

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        fullname: newUser[0].fullname,
        email: newUser[0].email,
        status: newUser[0].status,
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Continue with UPDATE and DELETE routes following the same pattern...

export default router;
```

### 2. Update Role Routes

Update `src/server/routes/system/role.ts`:

```typescript
import { Router } from 'express';
import { authenticated, hasPermissions } from '../../middleware/authMiddleware';
import { tenantContext } from '../../middleware/tenantContextMiddleware';
import { role, permission, rolePermission } from '../../lib/db/schema/tenant';
import { eq, asc, count, sql } from 'drizzle-orm';

const router = Router();

router.use(authenticated());
router.use(tenantContext({ required: true }));

router.get('/', hasPermissions('system.role.view'), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get roles from tenant database - no tenant filtering needed
    const [roles, totalResult] = await Promise.all([
      req.tenantDb
        .select()
        .from(role)
        .orderBy(asc(role.name))
        .limit(limit)
        .offset(offset),

      req.tenantDb
        .select({ count: count() })
        .from(role)
    ]);

    return res.json({
      roles,
      pagination: {
        page,
        limit,
        total: totalResult[0].count,
        pages: Math.ceil(totalResult[0].count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.post('/', hasPermissions('system.role.create'), async (req, res) => {
  try {
    const { code, name, description, permissionIds = [] } = req.body;

    if (!code || !name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Code and name are required' 
      });
    }

    // Check if role code already exists in tenant
    const existing = await req.tenantDb
      .select()
      .from(role)
      .where(eq(role.code, code))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ 
        error: 'Role code already exists',
        message: `Role with code '${code}' already exists in this tenant`
      });
    }

    // Create role in tenant database
    const newRole = await req.tenantDb
      .insert(role)
      .values({
        id: crypto.randomUUID(),
        code,
        name,
        description: description || null,
        isSystem: false,
        // No tenantId needed
      })
      .returning();

    // Assign permissions if provided
    if (permissionIds.length > 0) {
      const permissionAssignments = permissionIds.map((permissionId: string) => ({
        roleId: newRole[0].id,
        permissionId,
      }));

      await req.tenantDb
        .insert(rolePermission)
        .values(permissionAssignments);
    }

    return res.status(201).json({
      message: 'Role created successfully',
      role: newRole[0]
    });

  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

export default router;
```

## Task 3.3: Update Schema Validation

### 1. Update User Schema Validation

Update `src/server/schemas/userSchema.ts`:

```typescript
import { z } from 'zod';

// Remove tenant-related validations since schema provides context
export const userAddSchema = z.object({
  username: z.string()
    .min(1, "Username is required")
    .max(255, "Username must be less than 255 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, dashes, and underscores")
    .refine((val) => !val.includes('@'), {
      message: "Username must not contain '@' symbol",
    }),
  
  fullname: z.string()
    .min(1, "Full name is required")
    .max(255, "Full name must be less than 255 characters"),
    
  password: z.string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password must be less than 128 characters"),
    
  email: z.string()
    .email("Invalid email format")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
    
  status: z.enum(["active", "inactive"])
    .default("active"),
    
  roleIds: z.array(z.string().uuid("Invalid role ID format"))
    .optional()
    .default([]),
    
  // Removed: activeTenantId, activeTenantCode - no longer needed
});

export const userUpdateSchema = z.object({
  username: z.string()
    .min(1, "Username is required")
    .max(255, "Username must be less than 255 characters")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, dots, dashes, and underscores")
    .optional(),
    
  fullname: z.string()
    .min(1, "Full name is required")
    .max(255, "Full name must be less than 255 characters")
    .optional(),
    
  email: z.string()
    .email("Invalid email format")
    .max(255, "Email must be less than 255 characters")
    .optional()
    .or(z.literal("")),
    
  status: z.enum(["active", "inactive"])
    .optional(),
    
  roleIds: z.array(z.string().uuid("Invalid role ID format"))
    .optional(),
    
  avatar: z.string()
    .url("Invalid avatar URL")
    .optional()
    .or(z.literal("")),
});

export const userPasswordResetSchema = z.object({
  newPassword: z.string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password must be less than 128 characters"),
    
  confirmPassword: z.string()
    .min(6, "Confirm password must be at least 6 characters long")
    .max(128, "Confirm password must be less than 128 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Custom validation middleware for tenant context
export function validateUserUniqueness() {
  return async (req: any, res: any, next: any) => {
    try {
      const { username } = req.body;
      const userId = req.params.id; // For updates

      if (!username) {
        return next(); // Let Zod handle required validation
      }

      // Check username uniqueness within tenant
      const existing = await req.tenantDb
        .select({ id: user.id })
        .from(user)
        .where(
          userId 
            ? sql`${user.username} = ${username} AND ${user.id} != ${userId}`
            : sql`${user.username} = ${username}`
        );

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Username already exists',
          message: 'A user with this username already exists in this tenant'
        });
      }

      next();
    } catch (error) {
      console.error('User validation error:', error);
      res.status(500).json({
        error: 'Validation failed',
        message: 'Internal server error during validation'
      });
    }
  };
}

export type UserAddData = z.infer<typeof userAddSchema>;
export type UserUpdateData = z.infer<typeof userUpdateSchema>;
export type UserPasswordResetData = z.infer<typeof userPasswordResetSchema>;
```

### 2. Update Role Schema Validation

Update `src/server/schemas/roleSchema.ts`:

```typescript
import { z } from 'zod';
import { role } from '../lib/db/schema/tenant';
import { sql } from 'drizzle-orm';

export const roleAddSchema = z.object({
  code: z.string()
    .min(1, "Role code is required")
    .max(255, "Role code must be less than 255 characters")
    .regex(/^[A-Z0-9_]+$/, "Role code must be uppercase letters, numbers, and underscores only"),
    
  name: z.string()
    .min(1, "Role name is required")
    .max(255, "Role name must be less than 255 characters"),
    
  description: z.string()
    .max(255, "Description must be less than 255 characters")
    .optional()
    .or(z.literal("")),
    
  permissionIds: z.array(z.string().uuid("Invalid permission ID format"))
    .optional()
    .default([]),
    
  // Removed: tenantId - schema provides tenant context
});

export const roleUpdateSchema = z.object({
  code: z.string()
    .min(1, "Role code is required")
    .max(255, "Role code must be less than 255 characters")
    .regex(/^[A-Z0-9_]+$/, "Role code must be uppercase letters, numbers, and underscores only")
    .optional(),
    
  name: z.string()
    .min(1, "Role name is required")
    .max(255, "Role name must be less than 255 characters")
    .optional(),
    
  description: z.string()
    .max(255, "Description must be less than 255 characters")
    .optional()
    .or(z.literal("")),
    
  permissionIds: z.array(z.string().uuid("Invalid permission ID format"))
    .optional(),
});

export function validateRoleUniqueness() {
  return async (req: any, res: any, next: any) => {
    try {
      const { code } = req.body;
      const roleId = req.params.id;

      if (!code) {
        return next();
      }

      // Check code uniqueness within tenant schema
      const existing = await req.tenantDb
        .select({ id: role.id })
        .from(role)
        .where(
          roleId 
            ? sql`${role.code} = ${code} AND ${role.id} != ${roleId}`
            : sql`${role.code} = ${code}`
        );

      if (existing.length > 0) {
        return res.status(409).json({
          error: 'Role code already exists',
          message: 'A role with this code already exists in this tenant'
        });
      }

      next();
    } catch (error) {
      console.error('Role validation error:', error);
      res.status(500).json({
        error: 'Validation failed',
        message: 'Internal server error during validation'
      });
    }
  };
}

export type RoleAddData = z.infer<typeof roleAddSchema>;
export type RoleUpdateData = z.infer<typeof roleUpdateSchema>;
```

## Task 3.4: Update Authentication Routes

### 1. Update Login Route

Update `src/server/routes/auth/auth.ts`:

```typescript
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../lib/db';
import { tenantConnectionManager } from '../../lib/db/tenant-connection-manager';
import { tenant } from '../../lib/db/schema/shared';
import { user, role, userRole } from '../../lib/db/schema/tenant';
import { eq } from 'drizzle-orm';
import { systemContext } from '../../middleware/tenantContextMiddleware';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and return JWT token
 *     tags: [Authentication]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Code
 *         required: true
 *         schema:
 *           type: string
 *         description: Tenant identifier
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, tenantCode } = req.body;

    if (!username || !password || !tenantCode) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username, password, and tenant code are required'
      });
    }

    // Verify tenant exists and is active
    const tenantRecord = await db
      .select()
      .from(tenant)
      .where(eq(tenant.code, tenantCode))
      .limit(1);

    if (tenantRecord.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Invalid tenant code'
      });
    }

    const tenantInfo = tenantRecord[0];

    if (!tenantInfo.isActive) {
      return res.status(403).json({
        error: 'Tenant inactive',
        message: 'This tenant account is currently inactive'
      });
    }

    // Get tenant database connection
    const connection = await tenantConnectionManager.getConnection(tenantCode);

    // Find user in tenant database
    const userRecord = await connection.db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    if (userRecord.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    const userInfo = userRecord[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userInfo.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Check user status
    if (userInfo.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account is currently inactive'
      });
    }

    // Get user roles
    const userRoles = await connection.db
      .select({ code: role.code })
      .from(userRole)
      .innerJoin(role, eq(userRole.roleId, role.id))
      .where(eq(userRole.userId, userInfo.id));

    const roles = userRoles.map(r => r.code);

    // Generate JWT token with tenant context
    const tokenPayload = {
      userId: userInfo.id,
      username: userInfo.username,
      tenantCode: tenantCode,
      tenantId: tenantInfo.id,
      roles: roles
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }

    const token = jwt.sign(tokenPayload, secret, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
    });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: userInfo.id,
        username: userInfo.username,
        fullname: userInfo.fullname,
        email: userInfo.email,
        avatar: userInfo.avatar,
        tenantCode: tenantCode,
        roles: roles
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error during authentication'
    });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user account
 *     tags: [Authentication]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Code
 *         required: true
 *         schema:
 *           type: string
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullname, email, tenantCode } = req.body;

    if (!username || !password || !fullname || !tenantCode) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Username, password, fullname, and tenant code are required'
      });
    }

    // Verify tenant exists
    const tenantRecord = await db
      .select()
      .from(tenant)
      .where(eq(tenant.code, tenantCode))
      .limit(1);

    if (tenantRecord.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Invalid tenant code'
      });
    }

    const tenantInfo = tenantRecord[0];

    // Get tenant database connection
    const connection = await tenantConnectionManager.getConnection(tenantCode);

    // Check if username already exists
    const existing = await connection.db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Username taken',
        message: 'Username already exists in this tenant'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await connection.db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        username,
        fullname,
        email: email || null,
        passwordHash,
        status: 'active'
      })
      .returning();

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        fullname: newUser[0].fullname,
        email: newUser[0].email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error during registration'
    });
  }
});

export default router;
```

## Next Steps

After completing Phase 3:

1. ✅ Test middleware functionality in development
2. ✅ Verify route handlers work with tenant context
3. ✅ Test authentication with tenant-specific tokens
4. ✅ Validate schema validation with tenant context
5. ➡️ Proceed to [Phase 4: Frontend Changes](./04_migration_implementation.md)

## Checklist

- [ ] Tenant context middleware implemented
- [ ] Authentication middleware updated for tenant context
- [ ] Route handlers updated to use tenant database
- [ ] Schema validation updated (removed tenant_id references)
- [ ] Login/register routes updated for tenant context
- [ ] JWT tokens include tenant information
- [ ] Error handling for tenant-related issues
- [ ] Middleware properly chains (auth → tenant → permissions)
- [ ] API documentation updated with tenant headers
- [ ] Development testing completed