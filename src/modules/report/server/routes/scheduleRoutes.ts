import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { resolveTenantContext, authenticated, authorized } from '@server/middleware/authMiddleware';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import { enqueueReportGeneration } from '../jobs/reportGeneratorJob';

const router = Router();
router.use(resolveTenantContext());
router.use(authenticated());
router.use(checkModuleAuthorization('report'));

const scheduleSchema = z.object({
  name: z.string().min(1),
  report_type: z.enum(['revenue', 'inventory', 'pos', 'tax', 'procurement', 'transfer']),
  report_params: z.record(z.string(), z.unknown()).optional().default({}),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  schedule_time: z.string().regex(/^\d{2}:\d{2}$/),
  day_of_week: z.number().int().min(0).max(6).optional().nullable(),
  day_of_month: z.number().int().min(1).max(31).optional().nullable(),
  recipients: z.array(z.string().email()).min(1),
  export_format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  is_active: z.boolean().optional().default(true),
});

function computeNextRun(frequency: string, scheduleTime: string, dayOfWeek?: number | null, dayOfMonth?: number | null): Date {
  const [hh, mm] = scheduleTime.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  if (frequency === 'weekly' && dayOfWeek != null) {
    while (next.getDay() !== dayOfWeek) next.setDate(next.getDate() + 1);
  } else if (frequency === 'monthly' && dayOfMonth != null) {
    next.setDate(dayOfMonth);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * @swagger
 * /api/modules/report/schedule:
 *   get:
 *     summary: List all report schedules
 *     tags: [Reports]
 */
router.get('/', authorized('ADMIN', 'retail.report.schedule'), async (req, res) => {
  try {
    const rows = await req.tenantDb!.execute(sql`
      SELECT rs.*, u.fullname as created_by_name
      FROM report_schedules rs
      LEFT JOIN sys_user u ON rs.created_by = u.id
      ORDER BY rs.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error('[SCHEDULE] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/modules/report/schedule:
 *   post:
 *     summary: Create a report schedule
 *     tags: [Reports]
 */
router.post('/', authorized('ADMIN', 'retail.report.schedule'), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;
  const nextRun = computeNextRun(d.frequency, d.schedule_time, d.day_of_week, d.day_of_month);

  try {
    const [row] = await req.tenantDb!.execute(sql`
      INSERT INTO report_schedules
        (name, report_type, report_params, frequency, schedule_time, day_of_week, day_of_month,
         recipients, export_format, is_active, next_run_at, created_by)
      VALUES (
        ${d.name}, ${d.report_type}, ${JSON.stringify(d.report_params)}::jsonb,
        ${d.frequency}, ${d.schedule_time},
        ${d.day_of_week ?? null}, ${d.day_of_month ?? null},
        ${d.recipients}::text[], ${d.export_format}, ${d.is_active},
        ${nextRun.toISOString()}, ${req.user?.username ?? null}
      )
      RETURNING *
    `);
    res.status(201).json({ data: row });
  } catch (err) {
    console.error('[SCHEDULE] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/modules/report/schedule/{id}:
 *   put:
 *     summary: Update a report schedule
 *     tags: [Reports]
 */
router.put('/:id', authorized('ADMIN', 'retail.report.schedule'), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;
  const nextRun = computeNextRun(d.frequency, d.schedule_time, d.day_of_week, d.day_of_month);

  try {
    const [row] = await req.tenantDb!.execute(sql`
      UPDATE report_schedules SET
        name = ${d.name}, report_type = ${d.report_type},
        report_params = ${JSON.stringify(d.report_params)}::jsonb,
        frequency = ${d.frequency}, schedule_time = ${d.schedule_time},
        day_of_week = ${d.day_of_week ?? null}, day_of_month = ${d.day_of_month ?? null},
        recipients = ${d.recipients}::text[], export_format = ${d.export_format},
        is_active = ${d.is_active}, next_run_at = ${nextRun.toISOString()},
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `);
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ data: row });
  } catch (err) {
    console.error('[SCHEDULE] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/modules/report/schedule/{id}:
 *   delete:
 *     summary: Delete a report schedule
 *     tags: [Reports]
 */
router.delete('/:id', authorized('ADMIN', 'retail.report.schedule'), async (req, res) => {
  try {
    await req.tenantDb!.execute(sql`DELETE FROM report_schedules WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[SCHEDULE] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/modules/report/schedule/{id}/run:
 *   post:
 *     summary: Run a report schedule immediately
 *     tags: [Reports]
 */
router.post('/:id/run', authorized('ADMIN', 'retail.report.schedule'), async (req, res) => {
  try {
    const [row] = await req.tenantDb!.execute(sql`
      SELECT * FROM report_schedules WHERE id = ${req.params.id}
    `);
    if (!row) return res.status(404).json({ error: 'Schedule not found' });

    await enqueueReportGeneration({
      tenantCode: req.tenantCode!,
      scheduleId: String(row.id),
      reportType: String(row.report_type),
      reportParams: (row.report_params as Record<string, unknown>) ?? {},
      recipients: row.recipients as string[],
      exportFormat: String(row.export_format) as 'csv' | 'xlsx' | 'pdf',
      scheduleName: String(row.name),
    });

    res.json({ success: true, message: 'Report queued for generation' });
  } catch (err) {
    console.error('[SCHEDULE] run error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
