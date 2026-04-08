import postgres from 'postgres';

const sql = postgres('postgresql://sdlc_user:sdlc_password@localhost:5432/retail_multitenant');

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS sr_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR(6) NOT NULL UNIQUE,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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
`;

// Get tenant schemas
const schemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'`;
console.log('Found tenant schemas:', schemas.map(r => r.schema_name));

for (const row of schemas) {
  const schema = row.schema_name;
  console.log(`\nCreating supplier-return tables in ${schema}...`);
  try {
    await sql.unsafe(`SET search_path TO "${schema}"`);
    await sql.unsafe(CREATE_TABLES_SQL);
    console.log(`  OK - tables created in ${schema}`);
  } catch (err) {
    console.error(`  ERROR in ${schema}:`, err.message);
  }
}

// Register module in sys_module_registry
try {
  await sql.unsafe('SET search_path TO public');
  const existing = await sql`SELECT id FROM sys_module_registry WHERE module_id = 'supplier-return'`;
  if (existing.length === 0) {
    await sql`
      INSERT INTO sys_module_registry (module_id, module_name, version, description, is_active)
      VALUES ('supplier-return', 'Supplier Returns & Credit Notes', '1.0.0', 'Manage supplier returns, track return lifecycle, and record credit notes or replacement receipts', true)
    `;
    console.log('\nModule registered in sys_module_registry');
  } else {
    console.log('\nModule already registered in sys_module_registry');
  }
} catch (err) {
  console.error('Error registering module:', err.message);
}

await sql.end();
console.log('\nDone!');
