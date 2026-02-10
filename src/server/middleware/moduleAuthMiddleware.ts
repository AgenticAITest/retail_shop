import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';

// Import shared schema for module authorizations
import { moduleAuthorization } from '../lib/db/schema/module.js';
import { moduleRegistry } from '@server/lib/db/schema/shared.js';

/**
 * Middleware to check if a tenant has access to a specific module
 */
export const checkModuleAuthorization = (moduleId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated and tenant context is resolved
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
      }

      if (!req.tenantCode || !req.sharedDb || !req.tenantDb) {
        return res.status(500).json({ 
          message: 'Tenant context not resolved. Ensure tenant middleware is applied first.' 
        });
      }
      // Get tenant ID from shared database using tenant code
      const tenantResult = await req.sharedDb.execute(`
        SELECT id FROM sys_tenant 
        WHERE code = '${req.tenantCode}'
        LIMIT 1
      `);

      if (tenantResult.length === 0) {
        return res.status(404).json({ 
          message: 'Tenant not found or inactive.',
          tenantCode: req.tenantCode
        });
      }

      const tenantId = tenantResult[0].id as string;

      // check if module is registered in module registry
      const moduleResult = await req.sharedDb.select()
        .from(moduleRegistry)
        .where(and(
          eq(moduleRegistry.moduleId, moduleId),
          eq(moduleRegistry.isActive, true)
        ))
        .limit(1);

      if (moduleResult.length === 0) {
        return res.status(403).json({ 
          message: 'Access denied. Module not found or inactive in registry.',
          moduleId,
          tenantCode: req.tenantCode
        });
      }

      // Check if the module is authorized for this tenant using tenantDb
      const authorization = await req.tenantDb
        .select()
        .from(moduleAuthorization)
        .where(and(
          eq(moduleAuthorization.moduleId, moduleId),
          eq(moduleAuthorization.isEnabled, true)
        ))
        .limit(1);

      if (authorization.length === 0) {
        return res.status(403).json({ 
          message: 'Access denied. This module is not authorized for your tenant.',
          moduleId,
          tenantCode: req.tenantCode
        });
      }

      // Module is authorized, continue to the next middleware
      next();
    } catch (error) {
      console.error('Error checking module authorization:', error);
      return res.status(500).json({ 
        message: 'Internal server error during authorization check.',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  };
};

/**
 * Helper function to check if a module is authorized for a tenant ID (legacy compatibility)
 */
export const isModuleAuthorized = async (req: Request, moduleId: string): Promise<boolean> => {
  if (!req.tenantDb) {
    console.error('Tenant DB not available in request.');
    return false;
  }
  try {
    const authorization = await req.tenantDb
      .select()
      .from(moduleAuthorization)
      .where(and(
        eq(moduleAuthorization.moduleId, moduleId),
        eq(moduleAuthorization.isEnabled, true)
      ))
      .limit(1);

    return authorization.length > 0;
  } catch (error) {
    console.error('Error checking module authorization:', error);
    return false;
  }
};

/**
 * Helper function to get all authorized modules
 */
export const getAuthorizedModules = async (req: Request): Promise<string[]> => {
  if (!req.tenantDb) {
    console.error('Tenant DB not available in request.');
    return [];
  }
  try {
    const authorizations = await req.tenantDb
      .select({ moduleId: moduleAuthorization.moduleId })
      .from(moduleAuthorization)
      .where(
        eq(moduleAuthorization.isEnabled, true)
      );

    return authorizations.map((auth: any) => auth.moduleId);
  } catch (error) {
    console.error('Error getting authorized modules:', error);
    return [];
  }
};

/**
 * Middleware to attach authorized modules to request for a tenant
 */
export const loadAuthorizedModules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.tenantCode || !req.tenantDb) {
      return res.status(500).json({ 
        message: 'Tenant context not resolved. Ensure tenant middleware is applied first.' 
      });
    }

    const authorizedModules = await getAuthorizedModules(req);
    
    // Attach to request for use by other middleware/routes
    (req as any).authorizedModules = authorizedModules;
    
    next();
  } catch (error) {
    console.error('Error loading authorized modules:', error);
    return res.status(500).json({ 
      message: 'Internal server error loading modules.',
      error: (error as Error).message 
    });
  }
};

export default {
  checkModuleAuthorization,
  isModuleAuthorized,
  getAuthorizedModules,
  loadAuthorizedModules
};