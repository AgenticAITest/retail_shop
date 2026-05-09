-- Supplier Return Module - Table Creation Script
-- This script is applied to each tenant schema when the module is activated

-- SR Sequences (counter table for Supplier Return number generation)
CREATE TABLE IF NOT EXISTS sr_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR(6) NOT NULL UNIQUE,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Supplier Returns
CREATE TABLE IF NOT EXISTS supplier_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(30) NOT NULL UNIQUE,
  grn_id UUID NOT NULL REFERENCES goods_received_notes(id),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  location_id UUID REFERENCES locations(id),
  status VARCHAR(30) NOT NULL DEFAULT 'requested',
  return_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  rejection_reason TEXT,
  dispatched_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES sys_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_status ON supplier_returns(status);
CREATE INDEX IF NOT EXISTS idx_sr_supplier ON supplier_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sr_grn ON supplier_returns(grn_id);
CREATE INDEX IF NOT EXISTS idx_sr_number ON supplier_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_sr_return_date ON supplier_returns(return_date);

-- Supplier Return Items
CREATE TABLE IF NOT EXISTS supplier_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  grn_item_id UUID NOT NULL REFERENCES grn_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  return_quantity INTEGER NOT NULL,
  reason_code VARCHAR(30) NOT NULL,
  reason_notes TEXT,
  uom VARCHAR(50) NOT NULL DEFAULT 'pcs',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_item_sr_id ON supplier_return_items(supplier_return_id);

-- Credit Notes (linked to supplier returns)
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  credit_note_number VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  credit_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  is_replacement BOOLEAN NOT NULL DEFAULT FALSE,
  replacement_grn_id UUID REFERENCES goods_received_notes(id),
  created_by UUID NOT NULL REFERENCES sys_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cn_sr_id ON credit_notes(supplier_return_id);
CREATE INDEX IF NOT EXISTS idx_cn_number ON credit_notes(credit_note_number);
