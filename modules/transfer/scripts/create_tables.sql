-- Transfer Module - Table Creation Script

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS in_transit INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS transfer_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR(6) NOT NULL UNIQUE,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number VARCHAR(30) NOT NULL UNIQUE,
  source_location_id UUID NOT NULL REFERENCES locations(id),
  dest_location_id UUID NOT NULL REFERENCES locations(id),
  status VARCHAR(30) NOT NULL DEFAULT 'requested',
  requested_by UUID NOT NULL REFERENCES sys_user(id),
  approved_by UUID REFERENCES sys_user(id),
  approved_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfer_source ON transfers(source_location_id);
CREATE INDEX IF NOT EXISTS idx_transfer_dest ON transfers(dest_location_id);
CREATE INDEX IF NOT EXISTS idx_transfer_number ON transfers(transfer_number);

CREATE TABLE IF NOT EXISTS transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  requested_qty INTEGER NOT NULL,
  picked_qty INTEGER NOT NULL DEFAULT 0,
  received_qty INTEGER NOT NULL DEFAULT 0,
  discrepancy_qty INTEGER NOT NULL DEFAULT 0,
  discrepancy_reason VARCHAR(30),
  discrepancy_notes TEXT,
  uom VARCHAR(50) NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_item_transfer ON transfer_items(transfer_id);
