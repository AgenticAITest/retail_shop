import { Job } from 'bullmq';
import { sql } from 'drizzle-orm';
import { getQueue, registerWorker, QUEUE_NAMES } from '@server/lib/queue';
import { getConnectionManager } from '@server/lib/db/tenant-connection-manager';
import { sendReportEmail } from './reportEmailer';
import * as XLSX from 'xlsx';

export interface ReportGenerationPayload {
  tenantCode: string;
  scheduleId: string;
  reportType: string;
  reportParams: Record<string, unknown>;
  recipients: string[];
  exportFormat: 'csv' | 'xlsx' | 'pdf';
  scheduleName: string;
}

type Row = Record<string, unknown>;

async function fetchReportData(tenantDb: any, reportType: string, params: Record<string, unknown>): Promise<{ headers: string[]; rows: Row[] }> {
  const days = Number(params.days ?? 30);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  switch (reportType) {
    case 'revenue': {
      const byShop = await tenantDb.execute(sql`
        SELECT l.name as location_name,
          COALESCE(SUM(t.total_amount), 0) as revenue,
          COUNT(*) as transaction_count,
          COALESCE(AVG(t.total_amount), 0) as avg_basket
        FROM pos_transactions t JOIN locations l ON t.location_id = l.id
        WHERE t.status = 'completed' AND t.completed_at >= ${sinceIso}
        GROUP BY l.name ORDER BY revenue DESC
      `);
      return {
        headers: ['Location', 'Revenue (IDR)', 'Transactions', 'Avg Basket (IDR)'],
        rows: byShop,
      };
    }
    case 'inventory': {
      const rows = await tenantDb.execute(sql`
        SELECT l.name as location_name,
          COALESCE(SUM(i.qty_on_hand), 0) as total_on_hand,
          COALESCE(SUM(i.in_transit), 0) as total_in_transit,
          COUNT(DISTINCT i.product_id) as product_count,
          COALESCE(SUM(i.qty_on_hand * CAST(p.base_cost_price AS NUMERIC)), 0) as total_value
        FROM locations l
        LEFT JOIN inventory i ON i.location_id = l.id
        LEFT JOIN products p ON i.product_id = p.id
        WHERE l.status = 'active'
        GROUP BY l.name ORDER BY total_value DESC
      `);
      return {
        headers: ['Location', 'On Hand', 'In Transit', 'Products', 'Total Value (IDR)'],
        rows,
      };
    }
    case 'pos': {
      const rows = await tenantDb.execute(sql`
        SELECT p.payment_method, COUNT(*) as count, SUM(CAST(p.amount AS NUMERIC)) as total
        FROM pos_transaction_payments p JOIN pos_transactions t ON p.pos_transaction_id = t.id
        WHERE t.status = 'completed' AND t.completed_at >= ${sinceIso}
        GROUP BY p.payment_method ORDER BY total DESC
      `);
      return {
        headers: ['Payment Method', 'Count', 'Total (IDR)'],
        rows,
      };
    }
    case 'tax': {
      const rows = await tenantDb.execute(sql`
        SELECT l.name as location_name,
          COALESCE(SUM(CAST(t.tax_amount AS NUMERIC)), 0) as ppn,
          COALESCE(SUM(CAST(t.total_amount AS NUMERIC)), 0) as revenue
        FROM pos_transactions t JOIN locations l ON t.location_id = l.id
        WHERE t.status = 'completed' AND t.completed_at >= ${sinceIso}
        GROUP BY l.name ORDER BY ppn DESC
      `);
      return {
        headers: ['Location', 'PPN Collected (IDR)', 'Revenue (IDR)'],
        rows,
      };
    }
    case 'procurement': {
      const rows = await tenantDb.execute(sql`
        SELECT status, COUNT(*) as count,
          COALESCE(SUM(CAST(total_amount AS NUMERIC)), 0) as total_value
        FROM purchase_orders GROUP BY status ORDER BY count DESC
      `);
      return {
        headers: ['Status', 'Count', 'Total Value (IDR)'],
        rows,
      };
    }
    case 'transfer': {
      const rows = await tenantDb.execute(sql`
        SELECT sl.name as source_name, dl.name as dest_name,
          COUNT(*) as transfer_count,
          COALESCE(SUM(ti.requested_qty), 0) as total_qty
        FROM transfers t
        JOIN locations sl ON t.source_location_id = sl.id
        JOIN locations dl ON t.dest_location_id = dl.id
        LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
        GROUP BY sl.name, dl.name ORDER BY transfer_count DESC
      `);
      return {
        headers: ['Source', 'Destination', 'Transfers', 'Total Qty'],
        rows,
      };
    }
    default:
      return { headers: [], rows: [] };
  }
}

function rowValues(row: Row, headers: string[]): string[] {
  return Object.values(row).map(v => (v == null ? '' : String(v)));
}

function generateCsvBuffer(headers: string[], rows: Row[]): Buffer {
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      Object.values(row).map(v => {
        const val = v == null ? '' : String(v);
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ];
  return Buffer.from(lines.join('\n'), 'utf-8');
}

function generateXlsxBuffer(sheetName: string, headers: string[], rows: Row[]): Buffer {
  const data = [headers, ...rows.map(row => Object.values(row).map(v => (v == null ? '' : v)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function processReportGeneration(job: Job<ReportGenerationPayload>): Promise<void> {
  const { tenantCode, scheduleId, reportType, reportParams, recipients, exportFormat, scheduleName } = job.data;
  console.log(`[REPORT_JOB] Generating ${reportType} report for tenant ${tenantCode}`);

  const connectionManager = getConnectionManager();
  const tenantDb = await connectionManager.getTenantConnection(tenantCode);

  try {
    const { headers, rows } = await fetchReportData(tenantDb, reportType, reportParams);

    let attachment: { filename: string; content: Buffer };
    const dateStr = new Date().toISOString().slice(0, 10);
    const baseName = `${reportType}-report-${dateStr}`;

    if (exportFormat === 'xlsx') {
      attachment = { filename: `${baseName}.xlsx`, content: generateXlsxBuffer(reportType, headers, rows) };
    } else {
      attachment = { filename: `${baseName}.csv`, content: generateCsvBuffer(headers, rows) };
    }

    await sendReportEmail({ recipients, scheduleName, reportType, attachment });

    // Update last_run_at and compute next_run_at
    const [schedule] = await tenantDb.execute(sql`
      SELECT frequency, schedule_time, day_of_week, day_of_month
      FROM report_schedules WHERE id = ${scheduleId}
    `);

    if (schedule) {
      const next = computeNextRun(
        String(schedule.frequency),
        String(schedule.schedule_time),
        schedule.day_of_week != null ? Number(schedule.day_of_week) : null,
        schedule.day_of_month != null ? Number(schedule.day_of_month) : null,
      );
      await tenantDb.execute(sql`
        UPDATE report_schedules
        SET last_run_at = NOW(), next_run_at = ${next.toISOString()}, updated_at = NOW()
        WHERE id = ${scheduleId}
      `);
    }

    console.log(`[REPORT_JOB] Completed ${reportType} report for tenant ${tenantCode}`);
  } catch (err) {
    console.error(`[REPORT_JOB] Failed for tenant ${tenantCode}:`, err);
    throw err;
  }
}

function computeNextRun(frequency: string, scheduleTime: string, dayOfWeek?: number | null, dayOfMonth?: number | null): Date {
  const [hh, mm] = scheduleTime.split(':').map(Number);
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hh, mm);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  if (frequency === 'weekly' && dayOfWeek != null) {
    while (next.getDay() !== dayOfWeek) next.setDate(next.getDate() + 1);
  } else if (frequency === 'monthly' && dayOfMonth != null) {
    next.setDate(dayOfMonth);
    if (next <= new Date()) next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function registerReportGeneratorWorker(): void {
  registerWorker(QUEUE_NAMES.REPORT_GENERATION, processReportGeneration, 2);
  console.log('[REPORT_JOB] Worker registered');
}

export async function enqueueReportGeneration(payload: ReportGenerationPayload): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.REPORT_GENERATION);
  await queue.add('generate-report', payload, {
    jobId: `report-${payload.tenantCode}-${payload.scheduleId}-${Date.now()}`,
  });
}
