import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import * as tenantSchema from '../lib/db/schema/tenantSchema';

/**
 * Location-scope middleware
 *
 * Resolves the user's assigned location IDs and attaches them to the request.
 * Subsequent route handlers can use `req.locationScope` to filter queries.
 *
 * Users with `global_access: true` in any of their location assignments
 * will have `locationScope` set to null (meaning no filtering needed).
 */
export const resolveLocationScope = () => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.tenantDb) {
    return next();
  }

  try {
    // Get user record to find their ID
    const userResult = await req.tenantDb
      .select({ id: tenantSchema.user.id })
      .from(tenantSchema.user)
      .where(eq(tenantSchema.user.username, req.user.username))
      .limit(1);

    const currentUser = userResult[0];
    if (!currentUser) {
      return next();
    }

    // Get user's location assignments
    const userLocations = await req.tenantDb
      .select({
        locationId: tenantSchema.userLocation.locationId,
        globalAccess: tenantSchema.userLocation.globalAccess,
      })
      .from(tenantSchema.userLocation)
      .where(eq(tenantSchema.userLocation.userId, currentUser.id));

    // Check if user has global access
    const hasGlobalAccess = userLocations.some(ul => ul.globalAccess === true);

    if (hasGlobalAccess || userLocations.length === 0) {
      // null means no location filtering — user sees all data
      req.locationScope = null;
    } else {
      req.locationScope = userLocations.map(ul => ul.locationId);
    }

    next();
  } catch (error) {
    console.error('Location scope resolution error:', error);
    // Don't block the request — proceed without scope
    req.locationScope = null;
    next();
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      /**
       * Array of location IDs the user has access to.
       * null = global access (no filtering needed).
       */
      locationScope?: string[] | null;
    }
  }
}
