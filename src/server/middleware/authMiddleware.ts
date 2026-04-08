import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq, and, inArray, sql } from 'drizzle-orm';

// Import tenant connection manager utilities
import { getConnectionManager } from '../lib/db/tenant-connection-manager.js';

// Import tenant-specific schemas
import * as tenantSchema from '../lib/db/schema/tenantSchema';
import * as sharedSchema from '../lib/db/schema/sharedSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getRedis } from '../lib/redis';

// Extended Request interface to include tenant context
declare global {
  namespace Express {
    interface Request {
      user?: {
        username: string;
        activeTenantCode?: string;
        tenantId?: string;
        locationIds?: string[];
        tokenType?: 'standard' | 'pin';
      };
      tenantCode?: string;
      tenantDb?: PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}; // Drizzle instance for tenant-specific operations
      tenantInfo?: {
        id: string;
        code: string;
        name: string;
      };
      sharedDb?: PostgresJsDatabase<typeof sharedSchema> & {$client: postgres.Sql<{}>}; // Drizzle instance for shared operations
    }
  }
}

export interface DecodedToken {
  username: string;
  activeTenantCode?: string;
  tenantId?: string;
  locationIds?: string[];
  tokenType?: 'standard' | 'pin';
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'my_access_token_secret_key';

// Initialize connection manager
const connectionManager = getConnectionManager();

/**
 * Tenant Context Resolution Middleware
 * 
 * Resolves tenant context from various sources and attaches tenant database connections
 */
export const resolveTenantContext  = () => async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract tenant from subdomain
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    // Extract tenant from header (fallback)
    const headerTenant = req.get('x-tenant-code');
    
    // Extract tenant from JWT token (if available)
    let tokenTenant = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as DecodedToken;
        if (decoded.activeTenantCode) {
          tokenTenant = decoded.activeTenantCode;
        }
      } catch (error) {
        // JWT verification failed, tokenTenant remains null
        // We'll continue with other tenant resolution methods
      }
    }

    // Determine tenant code (priority: header > token > subdomain)
    const tenantCode = headerTenant || tokenTenant || subdomain;

    if (!tenantCode) {
      return res.status(400).json({ 
        message: 'Tenant context not found. Please provide tenant via subdomain, header, or token.' 
      });
    }

    // Validate tenant exists
    // const isValidTenant = await connectionManager.validateTenantExists(tenantCode);
    // if (!isValidTenant) {
    //   return res.status(404).json({ 
    //     message: `Tenant '${tenantCode}' not found or inactive.` 
    //   });
    // }

    // Get shared database connection 
    req.sharedDb = await connectionManager.initializeSharedConnection();

    // get tenant info
    const tenantResult = await req.sharedDb.select()
      .from(sharedSchema.tenant)
      .where(eq(sharedSchema.tenant.code, tenantCode))
      .limit(1);

    if (tenantResult.length === 0) {
      return res.status(404).json({ 
        message: `Tenant '${tenantCode}' not found or inactive.` 
      });
    }

    // Attach tenant context to request
    req.tenantCode = tenantCode;
    
    // Get tenant-specific database connection
    req.tenantDb = await connectionManager.getTenantDrizzle(tenantCode, tenantSchema);
    
    

    // Attach tenant info to request
    req.tenantInfo = tenantResult[0];

    next();
  } catch (error) {
    console.error('Tenant context resolution failed:', error);
    return res.status(500).json({ 
      message: 'Failed to resolve tenant context.',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * Authentication middleware for tenant-per-schema architecture
 */
export const authenticated = () => async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No Bearer token provided or invalid format.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check if token is blacklisted in Redis
    try {
      const redis = getRedis();
      const isBlacklisted = await redis.get(`token_blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ message: 'Token has been revoked.' });
      }
    } catch {
      // Redis unavailable — skip blacklist check gracefully
    }

    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET) as DecodedToken;
    if (!decoded.username) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    // Get tenant database connection (should be available from resolveTenantContext middleware)
    if (!req.tenantDb) {
      return res.status(500).json({ message: 'Tenant context not resolved.' });
    }

    // Query user from tenant-specific schema
    let user;
    try {
      user = await req.tenantDb
        .select()
        .from(tenantSchema.user)
        .where(and(
          eq(tenantSchema.user.username, decoded.username),
          eq(tenantSchema.user.status, "active"))
        )
        .limit(1);
    } catch (dbError) {
      console.error('Database error during authentication:', dbError);
      return res.status(500).json({
        message: 'Database connection error.',
        error: process.env.NODE_ENV === 'development' ? (dbError as Error).message : undefined
      });
    }

    const currentUser = user[0];

    if (!currentUser) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    // Attach user information to request
    req.user = {
      username: currentUser.username,
      activeTenantCode: req.tenantCode,
      tenantId: req.tenantInfo?.id,
      locationIds: decoded.locationIds,
      tokenType: decoded.tokenType || 'standard',
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

/**
 * Authorization middleware using tenant-specific roles and permissions
 */
export const authorized = (
  roles: string | string[],
  permissions: string | string[],
  operator: 'or' | 'and' = 'or'
) => async (req: Request, res: Response, next: NextFunction) => {

  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ message: 'Tenant context not resolved.' });
  }

  const username = req.user.username;
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  try {
    // Check if user has 'SYSADMIN' role (tenant-specific)
    const isSYSADMIN = await userHasRoles(req.tenantDb, username, ['SYSADMIN']);
    if (isSYSADMIN) {
      return next();
    }
    
    const hasRole = await userHasRoles(req.tenantDb, username, requiredRoles);
    const hasPermission = await userHasPermissions(req.tenantDb, username, requiredPermissions);
    
    if (operator === 'or' && (hasRole || hasPermission)) {
      next();
    } else if (operator === 'and' && hasRole && hasPermission) {
      next();
    } else {
      return res.status(403).json({ message: 'Forbidden.' });
    }
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Role-based authorization middleware
 */
export const hasRoles = (roles: string | string[]) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ message: 'Tenant context not resolved.' });
  }

  const username = req.user.username;
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  try {
    // Check if user has 'SYSADMIN' role
    const isSYSADMIN = await userHasRoles(req.tenantDb, username, ['SYSADMIN']);
    if (isSYSADMIN) {
      return next();
    }

    const hasRole = await userHasRoles(req.tenantDb, username, requiredRoles);
    if (hasRole) {
      next();
    } else {
      return res.status(403).json({ message: 'Forbidden.' });
    }
  } catch (error) {
    console.error('Role authorization error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Permission-based authorization middleware
 */
export const hasPermissions = (permissions: string | string[]) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  if (!req.tenantDb) {
    return res.status(500).json({ message: 'Tenant context not resolved.' });
  }

  const username = req.user.username;
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
  
  try {
    // Check if user has 'SYSADMIN' role
    const isSYSADMIN = await userHasRoles(req.tenantDb, username, ['SYSADMIN']);
    if (isSYSADMIN) {
      return next();
    }

    const hasPermission = await userHasPermissions(req.tenantDb, username, requiredPermissions);
    if (hasPermission) {
      next();
    } else {
      return res.status(403).json({ message: 'Forbidden.' });
    }
  } catch (error) {
    console.error('Permission authorization error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Helper function to check if user has specified roles in current tenant
 */
const userHasRoles = async (tenantDb: any, username: string, roleCodes: string[]): Promise<boolean> => {
  if (roleCodes.length === 0) {
    return true;
  }

  try {
    const subquery = tenantDb
      .select()
      .from(tenantSchema.userRole)
      .innerJoin(tenantSchema.role, eq(tenantSchema.userRole.roleId, tenantSchema.role.id))
      .innerJoin(tenantSchema.user, eq(tenantSchema.userRole.userId, tenantSchema.user.id))
      .where(
        and(
          eq(tenantSchema.user.username, username),
          inArray(tenantSchema.role.code, roleCodes)
        )
      );

    const result = await tenantDb
      .select({
        exists: sql<boolean>`exists(${subquery})`
      })
      .from(sql`(select 1) as dummy`)
      .limit(1);

    return result[0]?.exists || false;
  } catch (error) {
    console.error('Error checking user roles:', error);
    return false;
  }
};

/**
 * Helper function to check if user has specified permissions in current tenant
 */
const userHasPermissions = async (tenantDb: any, username: string, permissionCodes: string[]): Promise<boolean> => {
  if (permissionCodes.length === 0) {
    return true;
  }

  try {
    const subquery = tenantDb
      .select()
      .from(tenantSchema.userRole)
      .innerJoin(tenantSchema.role, eq(tenantSchema.userRole.roleId, tenantSchema.role.id))
      .innerJoin(tenantSchema.rolePermission, eq(tenantSchema.role.id, tenantSchema.rolePermission.roleId))
      .innerJoin(tenantSchema.permission, eq(tenantSchema.rolePermission.permissionId, tenantSchema.permission.id))
      .innerJoin(tenantSchema.user, eq(tenantSchema.userRole.userId, tenantSchema.user.id))
      .where(
        and(
          eq(tenantSchema.user.username, username),
          inArray(tenantSchema.permission.code, permissionCodes)
        )
      );

    const result = await tenantDb
      .select({
        exists: sql<boolean>`exists(${subquery})`
      })
      .from(sql`(select 1) as dummy`)
      .limit(1);

    return result[0]?.exists || false;
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return false;
  }
};

/**
 * Utility middleware to ensure tenant context is available
 */
export const requireTenantContext = (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantCode || !req.tenantDb) {
    return res.status(500).json({ 
      message: 'Tenant context not available. Ensure resolveTenantContext middleware is applied first.' 
    });
  }
  next();
};

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await connectionManager.closeAllConnections();
});

process.on('SIGTERM', async () => {
  await connectionManager.closeAllConnections();
});

export default {
  resolveTenantContext,
  authenticated,
  authorized,
  hasRoles,
  hasPermissions,
  requireTenantContext
};