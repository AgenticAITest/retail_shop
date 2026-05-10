-- MokaPOS Migration module tables
-- Run inside tenant schema context

CREATE TABLE IF NOT EXISTS moka_migration_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by   UUID NOT NULL REFERENCES sys_user(id),
  location_id   UUID NOT NULL,
  file_name     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'rolled_back')),
  total_rows    INTEGER NOT NULL DEFAULT 0,
  categories_created  INTEGER NOT NULL DEFAULT 0,
  products_created    INTEGER NOT NULL DEFAULT 0,
  variants_created    INTEGER NOT NULL DEFAULT 0,
  barcodes_created    INTEGER NOT NULL DEFAULT 0,
  stock_entries       INTEGER NOT NULL DEFAULT 0,
  modifiers_skipped   INTEGER NOT NULL DEFAULT 0,
  warnings        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS moka_migration_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES moka_migration_batches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL
                CHECK (entity_type IN ('category', 'product', 'variant', 'barcode', 'inventory', 'movement')),
  entity_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moka_entries_batch_id ON moka_migration_entries(batch_id);
CREATE INDEX IF NOT EXISTS idx_moka_entries_entity ON moka_migration_entries(entity_type, entity_id);
