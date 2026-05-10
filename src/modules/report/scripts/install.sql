-- Report Module: Scheduled Reports Table
-- Apply to each tenant schema (tenant_{code})

CREATE TABLE IF NOT EXISTS report_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  report_type     VARCHAR(100) NOT NULL,
  report_params   JSONB NOT NULL DEFAULT '{}',
  frequency       VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  schedule_time   VARCHAR(5) NOT NULL,
  day_of_week     SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month    SMALLINT CHECK (day_of_month BETWEEN 1 AND 31),
  recipients      TEXT[] NOT NULL DEFAULT '{}',
  export_format   VARCHAR(10) NOT NULL DEFAULT 'csv' CHECK (export_format IN ('csv', 'xlsx', 'pdf')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_by      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_schedules_active ON report_schedules (is_active, next_run_at)
  WHERE is_active = true;
