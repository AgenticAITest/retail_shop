import { eq, and, lt, sql } from 'drizzle-orm';
import { Job } from 'bullmq';
import { getQueue, registerWorker, QUEUE_NAMES } from '@server/lib/queue';
import { getConnectionManager } from '@server/lib/db/tenant-connection-manager';
import { approvalConfig, approvalLog } from '@server/lib/db/schema/tenantSchema';

interface ApprovalTimeoutPayload {
  tenantCode: string;
}

/**
 * Process timed-out approvals based on approval config settings.
 *
 * For each pending approval that has exceeded its configured timeout:
 * - If timeoutAction='auto_approve': set action='approved', approvedBy=null (system), reason='Auto-approved after timeout'
 * - If timeoutAction='escalate': log a warning (escalation notification to be added later)
 */
async function processApprovalTimeouts(job: Job<ApprovalTimeoutPayload>): Promise<void> {
  const { tenantCode } = job.data;

  console.log(`[APPROVAL_TIMEOUT] Processing timeouts for tenant: ${tenantCode}`);

  const connectionManager = getConnectionManager();

  try {
    const tenantDb = await connectionManager.getTenantConnection(tenantCode);

    // Get all approval configs that have approval required
    const configs = await tenantDb
      .select()
      .from(approvalConfig)
      .where(eq(approvalConfig.isRequired, true));

    for (const config of configs) {
      const timeoutHours = config.timeoutHours ?? 24;

      // Find pending approvals that have timed out for this transaction type
      const timedOutApprovals = await tenantDb
        .select()
        .from(approvalLog)
        .where(
          and(
            eq(approvalLog.transactionType, config.transactionType),
            eq(approvalLog.action, 'pending'),
            lt(
              approvalLog.requestedAt,
              sql`NOW() - INTERVAL '${sql.raw(String(timeoutHours))} hours'`
            )
          )
        );

      for (const approval of timedOutApprovals) {
        if (config.timeoutAction === 'auto_approve') {
          await tenantDb
            .update(approvalLog)
            .set({
              action: 'approved',
              approvedBy: null,
              reason: 'Auto-approved after timeout',
              actionedAt: new Date(),
            })
            .where(eq(approvalLog.id, approval.id));

          console.log(
            `[APPROVAL_TIMEOUT] Auto-approved approval ${approval.id} for ${config.transactionType} (tenant: ${tenantCode})`
          );
        } else {
          // timeoutAction === 'escalate'
          console.warn(
            `[APPROVAL_TIMEOUT] Escalation needed for approval ${approval.id} for ${config.transactionType} (tenant: ${tenantCode}). Escalation notification not yet implemented.`
          );
        }
      }
    }

    console.log(`[APPROVAL_TIMEOUT] Finished processing timeouts for tenant: ${tenantCode}`);
  } catch (error) {
    console.error(`[APPROVAL_TIMEOUT] Error processing timeouts for tenant ${tenantCode}:`, error);
    throw error;
  }
}

/**
 * Register the approval timeout worker
 */
export function registerApprovalTimeoutWorker(): void {
  registerWorker(QUEUE_NAMES.APPROVAL_TIMEOUT, processApprovalTimeouts, 1);
  console.log('[APPROVAL_TIMEOUT] Worker registered');
}

/**
 * Schedule a timeout check job for a specific tenant
 */
export async function scheduleApprovalTimeoutCheck(tenantCode: string): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.APPROVAL_TIMEOUT);
  await queue.add('check-timeouts', { tenantCode }, {
    jobId: `approval-timeout-${tenantCode}-${Date.now()}`,
  });
}

export default processApprovalTimeouts;
