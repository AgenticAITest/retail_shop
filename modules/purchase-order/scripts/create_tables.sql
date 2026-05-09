-- Purchase Order Module - Table Creation Script
-- This script is applied to each tenant schema when the module is activated

-- PO Sequences (counter table for PO number generation)
CREATE TABLE IF NOT EXISTS po_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR(6) NOT NULL UNIQUE,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(30) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  location_id UUID REFERENCES locations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  order_date TIMESTAMPTZ NOT NULL,
  expected_delivery_date TIMESTAMPTZ,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_config_id UUID REFERENCES tax_configs(id),
  tax_rate_percent DECIMAL(5,2),
  tax_calc_mode VARCHAR(20),
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES sys_user(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES sys_user(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  uom VARCHAR(50) NOT NULL DEFAULT 'pcs',
  supplier_sku VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_item_po_id ON purchase_order_items(purchase_order_id);

-- Purchase Order Amendments (version history)
CREATE TABLE IF NOT EXISTS purchase_order_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  changed_by UUID NOT NULL REFERENCES sys_user(id),
  change_reason TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_amendment_po_id ON purchase_order_amendments(purchase_order_id);
