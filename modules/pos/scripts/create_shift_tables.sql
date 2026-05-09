-- POS Module - Shift Management Tables (Sprint 14)

-- Add shiftId column to pos_transactions (nullable for backward compat)
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS shift_id UUID;

-- Shifts
CREATE TABLE IF NOT EXISTS pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES sys_user(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_float DECIMAL(15,2) NOT NULL DEFAULT 0,
  expected_cash DECIMAL(15,2),
  actual_cash DECIMAL(15,2),
  variance DECIMAL(15,2),
  variance_reason TEXT,
  closed_by UUID REFERENCES sys_user(id),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_cashier ON pos_shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shift_location ON pos_shifts(location_id);
CREATE INDEX IF NOT EXISTS idx_shift_status ON pos_shifts(status);

-- Cash Drops
CREATE TABLE IF NOT EXISTS pos_cash_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  reason TEXT,
  dropped_by UUID NOT NULL REFERENCES sys_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drop_shift ON pos_cash_drops(shift_id);

-- Held Transactions
CREATE TABLE IF NOT EXISTS pos_held_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES pos_shifts(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  cashier_id UUID NOT NULL REFERENCES sys_user(id),
  customer_note TEXT,
  cart_data JSONB NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_held_shift ON pos_held_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_held_location ON pos_held_transactions(location_id);

-- Add FK from pos_transactions.shift_id to pos_shifts.id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_transactions_shift_id_fkey'
    AND table_name = 'pos_transactions'
  ) THEN
    ALTER TABLE pos_transactions
    ADD CONSTRAINT pos_transactions_shift_id_fkey
    FOREIGN KEY (shift_id) REFERENCES pos_shifts(id);
  END IF;
END $$;
