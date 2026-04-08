import { Request, Response, NextFunction } from 'express';
import { auditLog, user } from '@server/lib/db/schema/tenantSchema';
import { eq } from 'drizzle-orm';

/**
 * Middleware that records audit log entries after a handler sends a response.
 *
 * Usage: router.post('/add', auditAction('product-catalog', 'create', 'product'), handler);
 * After the handler sends a response, this middleware records the audit entry.
 */
export const auditAction = (module: string, action: string, entityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store the original json method
    const originalJson = res.json.bind(res);

    // Override res.json to capture the response body
    res.json = (body: any) => {
      // Restore original json method first to avoid recursion
      res.json = originalJson;

      // Record audit log asynchronously (do not block the response)
      recordAuditLog(req, module, action, entityType, body).catch((err) => {
        console.error('Error recording audit log:', err);
      });

      // Send the response
      return originalJson(body);
    };

    next();
  };
};

async function recordAuditLog(
  req: Request,
  module: string,
  action: string,
  entityType: string,
  responseBody: any
): Promise<void> {
  if (!req.tenantDb || !req.user) {
    return;
  }

  try {
    // Get the current user ID
    const currentUser = await req.tenantDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, req.user.username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return;
    }

    // Extract entity ID from response body if available
    const entityId = responseBody?.id || null;

    await req.tenantDb.insert(auditLog).values({
      userId: currentUser.id,
      action,
      module,
      entityType,
      entityId,
      afterData: responseBody || null,
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (error) {
    console.error('Failed to record audit log entry:', error);
  }
}
