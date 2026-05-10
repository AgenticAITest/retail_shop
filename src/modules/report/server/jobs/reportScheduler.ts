import { sql } from 'drizzle-orm';
import { getQueue, registerWorker, QUEUE_NAMES } from '@server/lib/queue';
import { getConnectionManager } from '@server/lib/db/tenant-connection-manager';
import { tenant } from '@server/lib/db/schema/shared';
import { enqueueReportGeneration } from './reportGeneratorJob';

// Runs every 5 minutes, checks all tenants for due report schedules
async function checkAndEnqueueDueReports(): Promise<void> {
  const connectionManager = getConnectionManager();
  const sharedDb = await connectionManager.initializeSharedConnection();

  const activeTenants = await sharedDb
    .select({ code: tenant.code })
    .from(tenant)
    .where(sql`${tenant.status} = 'active'`);

  for (const { code } of activeTenants) {
    try {
      const tenantDb = await connectionManager.getTenantConnection(code);

      const dueSchedules = await tenantDb.execute(sql`
        SELECT id, name, report_type, report_params, recipients, export_format
        FROM report_schedules
        WHERE is_active = true AND next_run_at <= NOW()
      `);

      for (const schedule of dueSchedules) {
        await enqueueReportGeneration({
          tenantCode: code,
          scheduleId: String(schedule.id),
          reportType: String(schedule.report_type),
          reportParams: (schedule.report_params as Record<string, unknown>) ?? {},
          recipients: schedule.recipients as string[],
          exportFormat: String(schedule.export_format) as 'csv' | 'xlsx' | 'pdf',
          scheduleName: String(schedule.name),
        });

        console.log(`[REPORT_SCHEDULER] Enqueued ${schedule.report_type} for tenant ${code}, schedule ${schedule.id}`);
      }
    } catch (err) {
      // Don't let one tenant failure stop others
      console.error(`[REPORT_SCHEDULER] Error checking tenant ${code}:`, err instanceof Error ? err.message : err);
    }
  }
}

export function initReportScheduler(): void {
  // Register the worker that checks due schedules
  registerWorker('report-scheduler', checkAndEnqueueDueReports, 1);

  // Enqueue a repeating job every 5 minutes
  const schedulerQueue = getQueue('report-scheduler');
  schedulerQueue.add(
    'check-due-schedules',
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: 'report-scheduler-recurring',
    }
  ).then(() => {
    console.log('[REPORT_SCHEDULER] Recurring schedule check registered (every 5 minutes)');
  }).catch(err => {
    console.error('[REPORT_SCHEDULER] Failed to register recurring job:', err);
  });
}
