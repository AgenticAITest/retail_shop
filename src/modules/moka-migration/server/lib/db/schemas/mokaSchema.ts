import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const mokaMigrationBatch = pgTable('moka_migration_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  importedBy: uuid('imported_by').notNull(),
  locationId: uuid('location_id').notNull(),
  fileName: text('file_name').notNull(),
  status: varchar('status', { length: 20, enum: ['pending', 'completed', 'rolled_back'] }).notNull().default('pending'),
  totalRows: integer('total_rows').notNull().default(0),
  categoriesCreated: integer('categories_created').notNull().default(0),
  productsCreated: integer('products_created').notNull().default(0),
  variantsCreated: integer('variants_created').notNull().default(0),
  barcodesCreated: integer('barcodes_created').notNull().default(0),
  stockEntries: integer('stock_entries').notNull().default(0),
  modifiersSkipped: integer('modifiers_skipped').notNull().default(0),
  warnings: jsonb('warnings').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const mokaMigrationEntry = pgTable('moka_migration_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchId: uuid('batch_id').notNull(),
  entityType: varchar('entity_type', { length: 20, enum: ['category', 'product', 'variant', 'barcode', 'inventory', 'movement'] }).notNull(),
  entityId: uuid('entity_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type MokaMigrationBatch = typeof mokaMigrationBatch.$inferSelect;
export type NewMokaMigrationBatch = typeof mokaMigrationBatch.$inferInsert;
export type MokaMigrationEntry = typeof mokaMigrationEntry.$inferSelect;
