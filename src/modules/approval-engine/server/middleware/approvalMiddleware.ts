import { eq, and } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import { approvalConfig, approvalLog, user } from '@server/lib/db/schema/tenantSchema';

/**
 * Check if a transaction type requires approval. If yes, create an approval_log entry
 * with action='pending' and return 202 Accepted. If not, call next() to proceed.
 *
 * Usage in other modules:
 * router.post('/approve-step', requireApproval('purchase_order', (req) => ({
 *   transactionId: req.body.id,
 *   amount: req.body.totalAmount
 * })), actualHandler);
 */
export const requireApproval = (
  transactionType: string,
  getContext: (req: Request) => { transactionId: string; amount?: number }
) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.tenantDb) {
    return res.status(500).json({ error: 'Tenant database connection not found.' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Check if approval is configured and required for this transaction type
    const config = await req.tenantDb
      .select()
      .from(approvalConfig)
      .where(
        and(
          eq(approvalConfig.transactionType, transactionType),
          eq(approvalConfig.isRequired, true)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

    // If no config or approval is not required, proceed
    if (!config) {
      return next();
    }

    const context = getContext(req);

    // If a threshold is configured and the amount is below it, proceed without approval
    if (config.thresholdAmount && context.amount !== undefined) {
      const threshold = parseFloat(config.thresholdAmount);
      if (context.amount < threshold) {
        return next();
      }
    }

    // Get the current user ID
    const currentUser = await req.tenantDb
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, req.user.username))
      .limit(1)
      .then((rows) => rows[0]);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Create a pending approval log entry
    const newApproval = await req.tenantDb
      .insert(approvalLog)
      .values({
        transactionType,
        transactionId: context.transactionId,
        requestedBy: currentUser.id,
        action: 'pending',
      })
      .returning()
      .then((rows) => rows[0]);

    return res.status(202).json({
      message: 'Approval required. Your request has been submitted for review.',
      approvalId: newApproval.id,
      transactionType,
      transactionId: context.transactionId,
    });
  } catch (error) {
    console.error('Error in approval middleware:', error);
    return res.status(500).json({ error: 'Internal server error during approval check.' });
  }
};
