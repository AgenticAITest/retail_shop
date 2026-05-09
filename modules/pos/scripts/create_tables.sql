-- POS Module - Table Creation Script
-- This script is applied to each tenant schema when the module is activated

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  qty_on_hand INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_location_product ON inventory(location_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_location_product ON inventory(location_id, product_id);

-- POS Sequences (transaction ID generation)
CREATE TABLE IF NOT EXISTS pos_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code VARCHAR(50) NOT NULL,
  date_key VARCHAR(8) NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(location_code, date_key)
);

CREATE INDEX IF NOT EXISTS idx_pos_seq_loc_date ON pos_sequences(location_code, date_key);

-- POS Transactions
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(50) NOT NULL UNIQUE,
  location_id UUID NOT NULL REFERENCES locations(id),
  cashier_id UUID NOT NULL REFERENCES sys_user(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30),
  payment_ref VARCHAR(100),
  amount_tendered DECIMAL(15,2),
  change_amount DECIMAL(15,2),
  tax_config_id UUID REFERENCES tax_configs(id),
  tax_rate_percent DECIMAL(5,2),
  tax_calc_mode VARCHAR(20),
  notes TEXT,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES sys_user(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_txn_status ON pos_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pos_txn_location ON pos_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_pos_txn_cashier ON pos_transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_pos_txn_id ON pos_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_txn_created ON pos_transactions(created_at);

-- POS Transaction Items
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  sku_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  discount_type VARCHAR(10),
  discount_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_item_txn_id ON pos_transaction_items(pos_transaction_id);
