/**
 * create-module-tables.mjs
 *
 * Creates all module-level tables (PO, GRN, SR, Transfer, Inventory, POS)
 * in every existing tenant_* schema.
 *
 * createTenantSchema() only seeds the base system + product/supplier tables.
 * This script fills the gap so E2E tests can call module API routes without 500s.
 *
 * Safe to run multiple times — every statement uses CREATE TABLE IF NOT EXISTS.
 *
 * Usage:
 *   node scripts/create-module-tables.mjs
 *   node scripts/create-module-tables.mjs --tenant tmj   # single tenant only
 */

import postgres from 'postgres';

const TARGET = process.argv.includes('--tenant')
  ? process.argv[process.argv.indexOf('--tenant') + 1]
  : null;

const sql = postgres('postgresql://sdlc_user:sdlc_password@localhost:5432/retail_multitenant');

// Build the SQL for all module tables, schema-qualified where needed.
// FKs to same-schema tables omit schema prefix (search_path handles it).
// FKs that reference sys_user must be schema-qualified.
function buildModuleTablesSql(schema) {
  return `
-- ============================================================
-- PURCHASE ORDER MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "po_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "year_month" varchar(6) NOT NULL UNIQUE,
  "last_sequence" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "po_number" varchar(30) NOT NULL UNIQUE,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id"),
  "location_id" uuid REFERENCES "locations"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','pending_approval','approved','sent','partially_received','fully_received','closed','cancelled')),
  "order_date" timestamptz NOT NULL,
  "expected_delivery_date" timestamptz,
  "subtotal" decimal(15,2) NOT NULL DEFAULT 0,
  "tax_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "total_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "tax_config_id" uuid REFERENCES "tax_configs"("id"),
  "tax_rate_percent" decimal(5,2),
  "tax_calc_mode" varchar(20) CHECK ("tax_calc_mode" IN ('inclusive','exclusive')),
  "notes" text,
  "cancellation_reason" text,
  "cancelled_at" timestamptz,
  "cancelled_by" uuid REFERENCES "${schema}"."sys_user"("id"),
  "version" integer NOT NULL DEFAULT 1,
  "created_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "quantity" integer NOT NULL,
  "received_quantity" integer NOT NULL DEFAULT 0,
  "unit_price" decimal(15,2) NOT NULL,
  "discount_percent" decimal(5,2) NOT NULL DEFAULT 0,
  "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "tax_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "line_total" decimal(15,2) NOT NULL,
  "uom" varchar(50) NOT NULL DEFAULT 'pcs',
  "supplier_sku" varchar(100),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_order_amendments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "changed_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "change_reason" text,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_po_status" ON "purchase_orders"("status");
CREATE INDEX IF NOT EXISTS "idx_po_supplier" ON "purchase_orders"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_po_number" ON "purchase_orders"("po_number");
CREATE INDEX IF NOT EXISTS "idx_po_order_date" ON "purchase_orders"("order_date");
CREATE INDEX IF NOT EXISTS "idx_po_item_po_id" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_po_amendment_po_id" ON "purchase_order_amendments"("purchase_order_id");

-- ============================================================
-- GRN MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "grn_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "year_month" varchar(6) NOT NULL UNIQUE,
  "last_sequence" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "goods_received_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grn_number" varchar(30) NOT NULL UNIQUE,
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id"),
  "location_id" uuid REFERENCES "locations"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','quality_inspection','accepted','stock_updated')),
  "received_date" timestamptz NOT NULL,
  "delivery_note_ref" varchar(100),
  "invoice_ref" varchar(100),
  "quality_check_passed" boolean,
  "quality_notes" text,
  "notes" text,
  "created_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "grn_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "grn_id" uuid NOT NULL REFERENCES "goods_received_notes"("id") ON DELETE CASCADE,
  "purchase_order_item_id" uuid NOT NULL REFERENCES "purchase_order_items"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "ordered_quantity" integer NOT NULL,
  "previously_received_quantity" integer NOT NULL DEFAULT 0,
  "received_quantity" integer NOT NULL,
  "accepted_quantity" integer NOT NULL,
  "rejected_quantity" integer NOT NULL DEFAULT 0,
  "rejection_reason_code" varchar(50),
  "rejection_notes" text,
  "batch_number" varchar(100),
  "lot_number" varchar(100),
  "expiry_date" timestamp,
  "uom" varchar(50) NOT NULL DEFAULT 'pcs',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_grn_status" ON "goods_received_notes"("status");
CREATE INDEX IF NOT EXISTS "idx_grn_po" ON "goods_received_notes"("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_grn_number" ON "goods_received_notes"("grn_number");
CREATE INDEX IF NOT EXISTS "idx_grn_received_date" ON "goods_received_notes"("received_date");
CREATE INDEX IF NOT EXISTS "idx_grn_item_grn_id" ON "grn_items"("grn_id");

-- ============================================================
-- SUPPLIER RETURN MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "sr_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "year_month" varchar(6) NOT NULL UNIQUE,
  "last_sequence" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplier_returns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "return_number" varchar(30) NOT NULL UNIQUE,
  "grn_id" uuid NOT NULL REFERENCES "goods_received_notes"("id"),
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id"),
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id"),
  "location_id" uuid REFERENCES "locations"("id"),
  "status" varchar(30) NOT NULL DEFAULT 'requested'
    CHECK ("status" IN ('requested','pending_approval','approved','dispatched','acknowledged','credit_note_received','closed','rejected')),
  "return_date" timestamptz NOT NULL,
  "notes" text,
  "rejection_reason" text,
  "dispatched_at" timestamptz,
  "acknowledged_at" timestamptz,
  "closed_at" timestamptz,
  "created_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplier_return_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_return_id" uuid NOT NULL REFERENCES "supplier_returns"("id") ON DELETE CASCADE,
  "grn_item_id" uuid NOT NULL REFERENCES "grn_items"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "return_quantity" integer NOT NULL,
  "reason_code" varchar(30) NOT NULL
    CHECK ("reason_code" IN ('defective','damaged','expired','excess','wrong_item')),
  "reason_notes" text,
  "uom" varchar(50) NOT NULL DEFAULT 'pcs',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_return_id" uuid NOT NULL REFERENCES "supplier_returns"("id") ON DELETE CASCADE,
  "credit_note_number" varchar(100) NOT NULL,
  "amount" decimal(15,2) NOT NULL,
  "credit_date" timestamptz NOT NULL,
  "notes" text,
  "is_replacement" boolean NOT NULL DEFAULT false,
  "replacement_grn_id" uuid REFERENCES "goods_received_notes"("id"),
  "created_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_sr_status" ON "supplier_returns"("status");
CREATE INDEX IF NOT EXISTS "idx_sr_supplier" ON "supplier_returns"("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_sr_grn" ON "supplier_returns"("grn_id");
CREATE INDEX IF NOT EXISTS "idx_sr_number" ON "supplier_returns"("return_number");
CREATE INDEX IF NOT EXISTS "idx_sr_return_date" ON "supplier_returns"("return_date");
CREATE INDEX IF NOT EXISTS "idx_sr_item_sr_id" ON "supplier_return_items"("supplier_return_id");
CREATE INDEX IF NOT EXISTS "idx_cn_sr_id" ON "credit_notes"("supplier_return_id");
CREATE INDEX IF NOT EXISTS "idx_cn_number" ON "credit_notes"("credit_note_number");

-- ============================================================
-- INVENTORY MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "inventory" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "variant_id" uuid REFERENCES "product_variants"("id"),
  "qty_on_hand" integer NOT NULL DEFAULT 0,
  "in_transit" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT inventory_location_product_unique UNIQUE (location_id, product_id)
);

CREATE TABLE IF NOT EXISTS "stock_counts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft'
    CHECK ("status" IN ('draft','in_progress','finalized','cancelled')),
  "started_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "finalized_by" uuid REFERENCES "${schema}"."sys_user"("id"),
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "finalized_at" timestamptz,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_count_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "stock_count_id" uuid NOT NULL REFERENCES "stock_counts"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "system_qty" integer NOT NULL DEFAULT 0,
  "counted_qty" integer,
  "variance_qty" integer,
  "uom" varchar(50) NOT NULL DEFAULT 'pcs',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "qty" integer NOT NULL,
  "reason_code" varchar(30) NOT NULL
    CHECK ("reason_code" IN ('damage','theft','write_off','correction','other')),
  "notes" text,
  "adjusted_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "movement_type" varchar(30) NOT NULL
    CHECK ("movement_type" IN ('sale','return','grn','transfer_out','transfer_in','adjustment','stock_count','opening_balance')),
  "qty" integer NOT NULL,
  "reference_id" uuid,
  "reference_type" varchar(50),
  "balance_after" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_alert_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "min_qty" integer NOT NULL DEFAULT 0,
  "max_qty" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_inventory_location_product" ON "inventory"("location_id","product_id");
CREATE INDEX IF NOT EXISTS "idx_stock_count_location" ON "stock_counts"("location_id");
CREATE INDEX IF NOT EXISTS "idx_stock_count_status" ON "stock_counts"("status");
CREATE INDEX IF NOT EXISTS "idx_stock_count_line_count" ON "stock_count_lines"("stock_count_id");
CREATE INDEX IF NOT EXISTS "idx_adjustment_location" ON "stock_adjustments"("location_id");
CREATE INDEX IF NOT EXISTS "idx_adjustment_product" ON "stock_adjustments"("product_id");
CREATE INDEX IF NOT EXISTS "idx_movement_location" ON "inventory_movements"("location_id");
CREATE INDEX IF NOT EXISTS "idx_movement_product" ON "inventory_movements"("product_id");
CREATE INDEX IF NOT EXISTS "idx_movement_type" ON "inventory_movements"("movement_type");
CREATE INDEX IF NOT EXISTS "idx_movement_created" ON "inventory_movements"("created_at");
CREATE INDEX IF NOT EXISTS "idx_alert_config_location" ON "stock_alert_configs"("location_id");

-- ============================================================
-- POS MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "pos_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_code" varchar(50) NOT NULL,
  "date_key" varchar(8) NOT NULL,
  "last_sequence" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pos_seq_loc_date_uq" ON "pos_sequences"("location_code","date_key");

CREATE TABLE IF NOT EXISTS "pos_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" varchar(50) NOT NULL UNIQUE,
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "cashier_id" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "shift_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open','completed','voided')),
  "subtotal" decimal(15,2) NOT NULL DEFAULT 0,
  "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "tax_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "total_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "payment_method" varchar(30) CHECK ("payment_method" IN ('cash','card','qris','transfer')),
  "payment_ref" varchar(100),
  "amount_tendered" decimal(15,2),
  "change_amount" decimal(15,2),
  "tax_config_id" uuid REFERENCES "tax_configs"("id"),
  "tax_rate_percent" decimal(5,2),
  "tax_calc_mode" varchar(20) CHECK ("tax_calc_mode" IN ('inclusive','exclusive')),
  "notes" text,
  "void_reason" text,
  "voided_at" timestamptz,
  "voided_by" uuid REFERENCES "${schema}"."sys_user"("id"),
  "completed_at" timestamptz,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pos_transaction_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pos_transaction_id" uuid NOT NULL REFERENCES "pos_transactions"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "variant_id" uuid REFERENCES "product_variants"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" decimal(15,2) NOT NULL,
  "discount_type" varchar(10) CHECK ("discount_type" IN ('percent','fixed')),
  "discount_value" decimal(15,2) NOT NULL DEFAULT 0,
  "discount_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "tax_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "line_total" decimal(15,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pos_transaction_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pos_transaction_id" uuid NOT NULL REFERENCES "pos_transactions"("id") ON DELETE CASCADE,
  "payment_method" varchar(30) NOT NULL CHECK ("payment_method" IN ('cash','card','qris','transfer')),
  "amount" decimal(15,2) NOT NULL,
  "payment_ref" varchar(100),
  "amount_tendered" decimal(15,2),
  "change_amount" decimal(15,2),
  "sequence" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pos_shifts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "cashier_id" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'open'
    CHECK ("status" IN ('open','closed')),
  "opened_at" timestamptz DEFAULT now() NOT NULL,
  "closed_at" timestamptz,
  "opening_float" decimal(15,2) NOT NULL DEFAULT 0,
  "expected_cash" decimal(15,2),
  "actual_cash" decimal(15,2),
  "variance" decimal(15,2),
  "variance_reason" text,
  "closed_by" uuid REFERENCES "${schema}"."sys_user"("id"),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pos_cash_drops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shift_id" uuid NOT NULL REFERENCES "pos_shifts"("id") ON DELETE CASCADE,
  "amount" decimal(15,2) NOT NULL,
  "reason" text,
  "dropped_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pos_held_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shift_id" uuid REFERENCES "pos_shifts"("id"),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "cashier_id" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "customer_note" text,
  "cart_data" jsonb NOT NULL,
  "total_amount" decimal(15,2) NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamptz
);

-- Add shift_id FK to pos_transactions after pos_shifts is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pos_transactions_shift_id_fk'
    AND table_schema = current_schema()
  ) THEN
    ALTER TABLE "pos_transactions"
      ADD CONSTRAINT "pos_transactions_shift_id_fk"
      FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_pos_txn_status" ON "pos_transactions"("status");
CREATE INDEX IF NOT EXISTS "idx_pos_txn_location" ON "pos_transactions"("location_id");
CREATE INDEX IF NOT EXISTS "idx_pos_txn_cashier" ON "pos_transactions"("cashier_id");
CREATE INDEX IF NOT EXISTS "idx_pos_txn_id" ON "pos_transactions"("transaction_id");
CREATE INDEX IF NOT EXISTS "idx_pos_txn_created" ON "pos_transactions"("created_at");
CREATE INDEX IF NOT EXISTS "idx_pos_item_txn_id" ON "pos_transaction_items"("pos_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_pos_payment_txn_id" ON "pos_transaction_payments"("pos_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_shift_cashier" ON "pos_shifts"("cashier_id");
CREATE INDEX IF NOT EXISTS "idx_shift_location" ON "pos_shifts"("location_id");
CREATE INDEX IF NOT EXISTS "idx_shift_status" ON "pos_shifts"("status");
CREATE INDEX IF NOT EXISTS "idx_cash_drop_shift" ON "pos_cash_drops"("shift_id");
CREATE INDEX IF NOT EXISTS "idx_held_shift" ON "pos_held_transactions"("shift_id");
CREATE INDEX IF NOT EXISTS "idx_held_location" ON "pos_held_transactions"("location_id");

-- ============================================================
-- TRANSFER MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS "transfer_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "year_month" varchar(6) NOT NULL UNIQUE,
  "last_sequence" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transfer_number" varchar(30) NOT NULL UNIQUE,
  "source_location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "dest_location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "status" varchar(30) NOT NULL DEFAULT 'requested'
    CHECK ("status" IN ('requested','pending_approval','approved','picking','dispatched','received','closed')),
  "requested_by" uuid NOT NULL REFERENCES "${schema}"."sys_user"("id"),
  "approved_by" uuid REFERENCES "${schema}"."sys_user"("id"),
  "approved_at" timestamptz,
  "dispatched_at" timestamptz,
  "received_at" timestamptz,
  "closed_at" timestamptz,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transfer_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transfer_id" uuid NOT NULL REFERENCES "transfers"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "sku_code" varchar(100) NOT NULL,
  "product_name" varchar(255) NOT NULL,
  "requested_qty" integer NOT NULL,
  "picked_qty" integer NOT NULL DEFAULT 0,
  "received_qty" integer NOT NULL DEFAULT 0,
  "discrepancy_qty" integer NOT NULL DEFAULT 0,
  "discrepancy_reason" varchar(30) CHECK ("discrepancy_reason" IN ('short','over','damaged')),
  "discrepancy_notes" text,
  "uom" varchar(50) NOT NULL DEFAULT 'pcs',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_transfer_status" ON "transfers"("status");
CREATE INDEX IF NOT EXISTS "idx_transfer_source" ON "transfers"("source_location_id");
CREATE INDEX IF NOT EXISTS "idx_transfer_dest" ON "transfers"("dest_location_id");
CREATE INDEX IF NOT EXISTS "idx_transfer_number" ON "transfers"("transfer_number");
CREATE INDEX IF NOT EXISTS "idx_transfer_item_transfer" ON "transfer_items"("transfer_id");
`;
}

async function run() {
  try {
    let schemas;
    if (TARGET) {
      schemas = [{ schema_name: `tenant_${TARGET}` }];
    } else {
      schemas = await sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
      `;
    }

    console.log(`Found ${schemas.length} tenant schema(s):`, schemas.map(r => r.schema_name));

    for (const row of schemas) {
      const schema = row.schema_name;
      console.log(`\nApplying module tables to ${schema}...`);
      try {
        // Reserve a single connection so SET search_path is sticky for the DDL
        await sql.reserve().then(async (reserved) => {
          try {
            await reserved.unsafe(`SET search_path TO "${schema}"`);
            await reserved.unsafe(buildModuleTablesSql(schema));
          } finally {
            reserved.release();
          }
        });
        console.log(`  ✓ Done — ${schema}`);
      } catch (err) {
        console.error(`  ✗ Error in ${schema}:`, err.message);
      }
    }

    console.log('\nAll done.');
  } finally {
    await sql.end();
  }
}

run();
