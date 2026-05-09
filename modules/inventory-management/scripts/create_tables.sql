-- Inventory Management Module - Table Creation Script

CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  started_by UUID NOT NULL REFERENCES sys_user(id),
  finalized_by UUID REFERENCES sys_user(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_count_location ON stock_counts(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_count_status ON stock_counts(status);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  system_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty INTEGER,
  variance_qty INTEGER,
  uom VARCHAR(50) NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_count_line_count ON stock_count_lines(stock_count_id);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL,
  reason_code VARCHAR(30) NOT NULL,
  notes TEXT,
  adjusted_by UUID NOT NULL REFERENCES sys_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_adjustment_location ON stock_adjustments(location_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_product ON stock_adjustments(product_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type VARCHAR(30) NOT NULL,
  qty INTEGER NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  balance_after INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movement_location ON inventory_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_movement_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movement_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movement_created ON inventory_movements(created_at);

CREATE TABLE IF NOT EXISTS stock_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  min_qty INTEGER NOT NULL DEFAULT 0,
  max_qty INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_config_location ON stock_alert_configs(location_id);
