import { relations } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './system';

// ============================================================
// LOCATIONS
// ============================================================

export const location = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 20, enum: ['shop', 'warehouse', 'distribution_center'] }).notNull(),
  parentId: uuid('parent_id'),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  operatingHours: jsonb('operating_hours'),
  timezone: varchar('timezone', { length: 50 }).default('Asia/Jakarta'),
  syncConfig: jsonb('sync_config').$type<{
    frequency: 'once_daily' | 'twice_daily' | 'custom';
    windows: string[];
    bandwidthMode: 'full' | 'compressed';
    manualSyncEnabled: boolean;
    autoSyncOnReconnect: boolean;
  }>(),
  status: varchar('status', { length: 20, enum: ['active', 'inactive'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const userLocation = pgTable('user_locations', {
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => location.id, { onDelete: 'cascade' }),
  roleOverride: varchar('role_override', { length: 50 }),
  globalAccess: boolean('global_access').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.locationId] }),
]);

// ============================================================
// TAX CONFIGURATION
// ============================================================

export const taxConfig = pgTable('tax_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ratePercent: decimal('rate_percent', { precision: 5, scale: 2 }).notNull(),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
  calcMode: varchar('calc_mode', { length: 20, enum: ['inclusive', 'exclusive'] }).notNull().default('exclusive'),
  status: varchar('status', { length: 20, enum: ['active', 'historical'] }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// APPROVAL ENGINE
// ============================================================

export const approvalConfig = pgTable('approval_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull().unique(),
  isRequired: boolean('is_required').notNull().default(false),
  approverRoleId: uuid('approver_role_id'),
  thresholdAmount: decimal('threshold_amount', { precision: 15, scale: 2 }),
  timeoutHours: integer('timeout_hours').default(24),
  timeoutAction: varchar('timeout_action', { length: 20, enum: ['escalate', 'auto_approve'] }).default('escalate'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export const approvalLog = pgTable('approval_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionType: varchar('transaction_type', { length: 50 }).notNull(),
  transactionId: uuid('transaction_id').notNull(),
  requestedBy: uuid('requested_by').notNull().references(() => user.id),
  approvedBy: uuid('approved_by').references(() => user.id),
  action: varchar('action', { length: 20, enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  reason: text('reason'),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  actionedAt: timestamp('actioned_at'),
}, (t) => [
  index('idx_approval_pending').on(t.action),
]);

// ============================================================
// AUDIT LOG
// ============================================================

export const auditLog = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  action: varchar('action', { length: 50 }).notNull(),
  module: varchar('module', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }),
  entityId: uuid('entity_id'),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// SYNC LOG
// ============================================================

export const syncLog = pgTable('sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  deviceId: varchar('device_id', { length: 100 }),
  syncStart: timestamp('sync_start', { withTimezone: true }).notNull(),
  syncEnd: timestamp('sync_end', { withTimezone: true }),
  recordsPushed: integer('records_pushed').default(0),
  recordsPulled: integer('records_pulled').default(0),
  conflicts: integer('conflicts').default(0),
  status: varchar('status', { length: 20, enum: ['in_progress', 'completed', 'failed'] }).notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_sync_log_location').on(t.locationId, t.syncStart),
]);

// ============================================================
// RELATIONS
// ============================================================

export const locationRelations = relations(location, ({ one, many }) => ({
  parent: one(location, {
    fields: [location.parentId],
    references: [location.id],
    relationName: 'locationHierarchy',
  }),
  children: many(location, { relationName: 'locationHierarchy' }),
  userLocations: many(userLocation),
  syncLogs: many(syncLog),
}));

export const userLocationRelations = relations(userLocation, ({ one }) => ({
  user: one(user, { fields: [userLocation.userId], references: [user.id] }),
  location: one(location, { fields: [userLocation.locationId], references: [location.id] }),
}));

export const approvalLogRelations = relations(approvalLog, ({ one }) => ({
  requestedByUser: one(user, { fields: [approvalLog.requestedBy], references: [user.id], relationName: 'approvalRequester' }),
  approvedByUser: one(user, { fields: [approvalLog.approvedBy], references: [user.id], relationName: 'approvalApprover' }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, { fields: [auditLog.userId], references: [user.id] }),
}));

export const syncLogRelations = relations(syncLog, ({ one }) => ({
  location: one(location, { fields: [syncLog.locationId], references: [location.id] }),
}));

// ============================================================
// TYPES
// ============================================================

export type Location = typeof location.$inferSelect;
export type NewLocation = typeof location.$inferInsert;
export type UserLocation = typeof userLocation.$inferSelect;
export type NewUserLocation = typeof userLocation.$inferInsert;
export type TaxConfig = typeof taxConfig.$inferSelect;
export type NewTaxConfig = typeof taxConfig.$inferInsert;
export type ApprovalConfig = typeof approvalConfig.$inferSelect;
export type NewApprovalConfig = typeof approvalConfig.$inferInsert;
export type ApprovalLog = typeof approvalLog.$inferSelect;
export type NewApprovalLog = typeof approvalLog.$inferInsert;
export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type SyncLog = typeof syncLog.$inferSelect;
export type NewSyncLog = typeof syncLog.$inferInsert;

// ============================================================
// CATEGORIES
// ============================================================

export const category = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  parentId: uuid('parent_id'),
  level: integer('level').notNull().default(1),
  path: varchar('path', { length: 1000 }),
  sortOrder: integer('sort_order').default(0),
  status: varchar('status', { length: 20, enum: ['active', 'inactive'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// PRODUCTS
// ============================================================

export const product = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  skuCode: varchar('sku_code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => category.id),
  brand: varchar('brand', { length: 100 }),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  baseCostPrice: decimal('base_cost_price', { precision: 15, scale: 2 }).notNull().default('0'),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 2 }).notNull().default('0'),
  taxApplicable: boolean('tax_applicable').notNull().default(true),
  status: varchar('status', { length: 20, enum: ['draft', 'active', 'discontinued', 'archived'] }).notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_product_status').on(t.status),
  index('idx_product_category').on(t.categoryId),
  index('idx_product_sku').on(t.skuCode),
]);

// ============================================================
// PRODUCT VARIANTS
// ============================================================

export const productVariant = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  variantSku: varchar('variant_sku', { length: 100 }).notNull().unique(),
  attributes: jsonb('attributes').$type<Record<string, string>>(),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }).notNull().default('0'),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20, enum: ['active', 'inactive'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// BARCODES
// ============================================================

export const barcode = pgTable('barcodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  barcodeValue: varchar('barcode_value', { length: 100 }).notNull(),
  barcodeType: varchar('barcode_type', { length: 20, enum: ['ean13', 'upca', 'internal'] }).notNull().default('internal'),
  productId: uuid('product_id').references(() => product.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariant.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_barcode_value').on(t.barcodeValue),
]);

// ============================================================
// UOM CONVERSIONS
// ============================================================

export const uomConversion = pgTable('uom_conversions', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  procurementUom: varchar('procurement_uom', { length: 50 }).notNull(),
  salesUom: varchar('sales_uom', { length: 50 }).notNull(),
  conversionFactor: decimal('conversion_factor', { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// PRODUCT LOCATION PRICES
// ============================================================

export const productLocationPrice = pgTable('product_location_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => location.id, { onDelete: 'cascade' }),
  costPrice: decimal('cost_price', { precision: 15, scale: 2 }),
  sellingPrice: decimal('selling_price', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_product_location_price').on(t.productId, t.locationId),
]);

// ============================================================
// PRODUCT IMAGES
// ============================================================

export const productImage = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// PRODUCT RELATIONS
// ============================================================

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, { fields: [category.parentId], references: [category.id], relationName: 'categoryHierarchy' }),
  children: many(category, { relationName: 'categoryHierarchy' }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, { fields: [product.categoryId], references: [category.id] }),
  variants: many(productVariant),
  barcodes: many(barcode),
  uomConversions: many(uomConversion),
  locationPrices: many(productLocationPrice),
  images: many(productImage),
}));

export const productVariantRelations = relations(productVariant, ({ one, many }) => ({
  product: one(product, { fields: [productVariant.productId], references: [product.id] }),
  barcodes: many(barcode),
}));

export const barcodeRelations = relations(barcode, ({ one }) => ({
  product: one(product, { fields: [barcode.productId], references: [product.id] }),
  variant: one(productVariant, { fields: [barcode.variantId], references: [productVariant.id] }),
}));

export const uomConversionRelations = relations(uomConversion, ({ one }) => ({
  product: one(product, { fields: [uomConversion.productId], references: [product.id] }),
}));

export const productLocationPriceRelations = relations(productLocationPrice, ({ one }) => ({
  product: one(product, { fields: [productLocationPrice.productId], references: [product.id] }),
  location: one(location, { fields: [productLocationPrice.locationId], references: [location.id] }),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, { fields: [productImage.productId], references: [product.id] }),
}));

// ============================================================
// PRODUCT TYPES
// ============================================================

export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;
export type Barcode = typeof barcode.$inferSelect;
export type NewBarcode = typeof barcode.$inferInsert;
export type UomConversion = typeof uomConversion.$inferSelect;
export type NewUomConversion = typeof uomConversion.$inferInsert;
export type ProductLocationPrice = typeof productLocationPrice.$inferSelect;
export type NewProductLocationPrice = typeof productLocationPrice.$inferInsert;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;

// ============================================================
// SUPPLIERS
// ============================================================

export const supplier = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  npwp: varchar('npwp', { length: 20 }),
  address: text('address'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  leadTimeDays: integer('lead_time_days'),
  bankDetails: jsonb('bank_details').$type<{ bankName?: string; accountNumber?: string; accountHolder?: string }>(),
  status: varchar('status', { length: 20, enum: ['active', 'inactive'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_supplier_code').on(t.code),
  index('idx_supplier_status').on(t.status),
]);

// ============================================================
// SUPPLIER CONTACTS
// ============================================================

export const supplierContact = pgTable('supplier_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => supplier.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50, enum: ['sales', 'ar', 'logistics', 'general'] }).notNull().default('general'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// SUPPLIER PRODUCTS (catalog mapping with pricing)
// ============================================================

export const supplierProduct = pgTable('supplier_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => supplier.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => product.id, { onDelete: 'cascade' }),
  supplierPrice: decimal('supplier_price', { precision: 15, scale: 2 }).notNull(),
  minOrderQty: integer('min_order_qty').default(1),
  supplierSku: varchar('supplier_sku', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_supplier_product').on(t.supplierId, t.productId),
]);

// ============================================================
// SUPPLIER RELATIONS
// ============================================================

export const supplierRelations = relations(supplier, ({ many }) => ({
  contacts: many(supplierContact),
  products: many(supplierProduct),
}));

export const supplierContactRelations = relations(supplierContact, ({ one }) => ({
  supplier: one(supplier, { fields: [supplierContact.supplierId], references: [supplier.id] }),
}));

export const supplierProductRelations = relations(supplierProduct, ({ one }) => ({
  supplier: one(supplier, { fields: [supplierProduct.supplierId], references: [supplier.id] }),
  product: one(product, { fields: [supplierProduct.productId], references: [product.id] }),
}));

// ============================================================
// SUPPLIER TYPES
// ============================================================

export type Supplier = typeof supplier.$inferSelect;
export type NewSupplier = typeof supplier.$inferInsert;
export type SupplierContact = typeof supplierContact.$inferSelect;
export type NewSupplierContact = typeof supplierContact.$inferInsert;
export type SupplierProduct = typeof supplierProduct.$inferSelect;
export type NewSupplierProduct = typeof supplierProduct.$inferInsert;

// ============================================================
// PO SEQUENCES (counter table for PO number generation)
// ============================================================

export const poSequence = pgTable('po_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  yearMonth: varchar('year_month', { length: 6 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// PURCHASE ORDERS
// ============================================================

export const purchaseOrder = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  poNumber: varchar('po_number', { length: 30 }).notNull().unique(),
  supplierId: uuid('supplier_id').notNull().references(() => supplier.id),
  locationId: uuid('location_id').references(() => location.id),
  status: varchar('status', { length: 20, enum: ['draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'fully_received', 'closed', 'cancelled'] }).notNull().default('draft'),
  orderDate: timestamp('order_date', { withTimezone: true }).notNull(),
  expectedDeliveryDate: timestamp('expected_delivery_date', { withTimezone: true }),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxConfigId: uuid('tax_config_id').references(() => taxConfig.id),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }),
  taxCalcMode: varchar('tax_calc_mode', { length: 20, enum: ['inclusive', 'exclusive'] }),
  notes: text('notes'),
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by').references(() => user.id),
  version: integer('version').notNull().default(1),
  createdBy: uuid('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_po_status').on(t.status),
  index('idx_po_supplier').on(t.supplierId),
  index('idx_po_number').on(t.poNumber),
  index('idx_po_order_date').on(t.orderDate),
]);

// ============================================================
// PURCHASE ORDER ITEMS
// ============================================================

export const purchaseOrderItem = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrder.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  receivedQuantity: integer('received_quantity').notNull().default(0),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  supplierSku: varchar('supplier_sku', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_po_item_po_id').on(t.purchaseOrderId),
]);

// ============================================================
// PURCHASE ORDER AMENDMENTS (version history)
// ============================================================

export const purchaseOrderAmendment = pgTable('purchase_order_amendments', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrder.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  changedBy: uuid('changed_by').notNull().references(() => user.id),
  changeReason: text('change_reason'),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_po_amendment_po_id').on(t.purchaseOrderId),
]);

// ============================================================
// PURCHASE ORDER RELATIONS
// ============================================================

export const purchaseOrderRelations = relations(purchaseOrder, ({ one, many }) => ({
  supplier: one(supplier, { fields: [purchaseOrder.supplierId], references: [supplier.id] }),
  location: one(location, { fields: [purchaseOrder.locationId], references: [location.id] }),
  taxConfigRef: one(taxConfig, { fields: [purchaseOrder.taxConfigId], references: [taxConfig.id] }),
  createdByUser: one(user, { fields: [purchaseOrder.createdBy], references: [user.id], relationName: 'poCreatedBy' }),
  cancelledByUser: one(user, { fields: [purchaseOrder.cancelledBy], references: [user.id], relationName: 'poCancelledBy' }),
  items: many(purchaseOrderItem),
  amendments: many(purchaseOrderAmendment),
  grns: many(goodsReceivedNote),
}));

export const purchaseOrderItemRelations = relations(purchaseOrderItem, ({ one }) => ({
  purchaseOrder: one(purchaseOrder, { fields: [purchaseOrderItem.purchaseOrderId], references: [purchaseOrder.id] }),
  product: one(product, { fields: [purchaseOrderItem.productId], references: [product.id] }),
}));

export const purchaseOrderAmendmentRelations = relations(purchaseOrderAmendment, ({ one }) => ({
  purchaseOrder: one(purchaseOrder, { fields: [purchaseOrderAmendment.purchaseOrderId], references: [purchaseOrder.id] }),
  changedByUser: one(user, { fields: [purchaseOrderAmendment.changedBy], references: [user.id] }),
}));

// ============================================================
// PURCHASE ORDER TYPES
// ============================================================

export type PoSequence = typeof poSequence.$inferSelect;
export type NewPoSequence = typeof poSequence.$inferInsert;
export type PurchaseOrder = typeof purchaseOrder.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrder.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItem.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItem.$inferInsert;
export type PurchaseOrderAmendment = typeof purchaseOrderAmendment.$inferSelect;
export type NewPurchaseOrderAmendment = typeof purchaseOrderAmendment.$inferInsert;

// ============================================================
// GRN SEQUENCES (counter table for GRN number generation)
// ============================================================

export const grnSequence = pgTable('grn_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  yearMonth: varchar('year_month', { length: 6 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// GOODS RECEIVED NOTES
// ============================================================

export const goodsReceivedNote = pgTable('goods_received_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  grnNumber: varchar('grn_number', { length: 30 }).notNull().unique(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrder.id),
  locationId: uuid('location_id').references(() => location.id),
  status: varchar('status', { length: 20, enum: ['draft', 'quality_inspection', 'accepted', 'stock_updated'] }).notNull().default('draft'),
  receivedDate: timestamp('received_date', { withTimezone: true }).notNull(),
  deliveryNoteRef: varchar('delivery_note_ref', { length: 100 }),
  invoiceRef: varchar('invoice_ref', { length: 100 }),
  qualityCheckPassed: boolean('quality_check_passed'),
  qualityNotes: text('quality_notes'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_grn_status').on(t.status),
  index('idx_grn_po').on(t.purchaseOrderId),
  index('idx_grn_number').on(t.grnNumber),
  index('idx_grn_received_date').on(t.receivedDate),
]);

// ============================================================
// GRN ITEMS
// ============================================================

export const grnItem = pgTable('grn_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  grnId: uuid('grn_id').notNull().references(() => goodsReceivedNote.id, { onDelete: 'cascade' }),
  purchaseOrderItemId: uuid('purchase_order_item_id').notNull().references(() => purchaseOrderItem.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  orderedQuantity: integer('ordered_quantity').notNull(),
  previouslyReceivedQuantity: integer('previously_received_quantity').notNull().default(0),
  receivedQuantity: integer('received_quantity').notNull(),
  acceptedQuantity: integer('accepted_quantity').notNull(),
  rejectedQuantity: integer('rejected_quantity').notNull().default(0),
  rejectionReasonCode: varchar('rejection_reason_code', { length: 50 }),
  rejectionNotes: text('rejection_notes'),
  batchNumber: varchar('batch_number', { length: 100 }),
  lotNumber: varchar('lot_number', { length: 100 }),
  expiryDate: timestamp('expiry_date'),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_grn_item_grn_id').on(t.grnId),
]);

// ============================================================
// GRN RELATIONS
// ============================================================

export const goodsReceivedNoteRelations = relations(goodsReceivedNote, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrder, { fields: [goodsReceivedNote.purchaseOrderId], references: [purchaseOrder.id] }),
  location: one(location, { fields: [goodsReceivedNote.locationId], references: [location.id] }),
  createdByUser: one(user, { fields: [goodsReceivedNote.createdBy], references: [user.id], relationName: 'grnCreatedBy' }),
  items: many(grnItem),
}));

export const grnItemRelations = relations(grnItem, ({ one }) => ({
  grn: one(goodsReceivedNote, { fields: [grnItem.grnId], references: [goodsReceivedNote.id] }),
  purchaseOrderItem: one(purchaseOrderItem, { fields: [grnItem.purchaseOrderItemId], references: [purchaseOrderItem.id] }),
  product: one(product, { fields: [grnItem.productId], references: [product.id] }),
}));

// ============================================================
// GRN TYPES
// ============================================================

export type GrnSequence = typeof grnSequence.$inferSelect;
export type NewGrnSequence = typeof grnSequence.$inferInsert;
export type GoodsReceivedNote = typeof goodsReceivedNote.$inferSelect;
export type NewGoodsReceivedNote = typeof goodsReceivedNote.$inferInsert;
export type GrnItem = typeof grnItem.$inferSelect;
export type NewGrnItem = typeof grnItem.$inferInsert;

// ============================================================
// SR SEQUENCES (counter table for Supplier Return number generation)
// ============================================================

export const srSequence = pgTable('sr_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  yearMonth: varchar('year_month', { length: 6 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// SUPPLIER RETURNS
// ============================================================

export const supplierReturn = pgTable('supplier_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnNumber: varchar('return_number', { length: 30 }).notNull().unique(),
  grnId: uuid('grn_id').notNull().references(() => goodsReceivedNote.id),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrder.id),
  supplierId: uuid('supplier_id').notNull().references(() => supplier.id),
  locationId: uuid('location_id').references(() => location.id),
  status: varchar('status', { length: 30, enum: [
    'requested', 'pending_approval', 'approved', 'dispatched',
    'acknowledged', 'credit_note_received', 'closed', 'rejected',
  ] }).notNull().default('requested'),
  returnDate: timestamp('return_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  rejectionReason: text('rejection_reason'),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_sr_status').on(t.status),
  index('idx_sr_supplier').on(t.supplierId),
  index('idx_sr_grn').on(t.grnId),
  index('idx_sr_number').on(t.returnNumber),
  index('idx_sr_return_date').on(t.returnDate),
]);

// ============================================================
// SUPPLIER RETURN ITEMS
// ============================================================

export const supplierReturnItem = pgTable('supplier_return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierReturnId: uuid('supplier_return_id').notNull().references(() => supplierReturn.id, { onDelete: 'cascade' }),
  grnItemId: uuid('grn_item_id').notNull().references(() => grnItem.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  returnQuantity: integer('return_quantity').notNull(),
  reasonCode: varchar('reason_code', { length: 30, enum: ['defective', 'damaged', 'expired', 'excess', 'wrong_item'] }).notNull(),
  reasonNotes: text('reason_notes'),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_sr_item_sr_id').on(t.supplierReturnId),
]);

// ============================================================
// CREDIT NOTES (linked to supplier returns)
// ============================================================

export const creditNote = pgTable('credit_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierReturnId: uuid('supplier_return_id').notNull().references(() => supplierReturn.id, { onDelete: 'cascade' }),
  creditNoteNumber: varchar('credit_note_number', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  creditDate: timestamp('credit_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  isReplacement: boolean('is_replacement').default(false).notNull(),
  replacementGrnId: uuid('replacement_grn_id').references(() => goodsReceivedNote.id),
  createdBy: uuid('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_cn_sr_id').on(t.supplierReturnId),
  index('idx_cn_number').on(t.creditNoteNumber),
]);

// ============================================================
// SUPPLIER RETURN RELATIONS
// ============================================================

export const supplierReturnRelations = relations(supplierReturn, ({ one, many }) => ({
  grn: one(goodsReceivedNote, { fields: [supplierReturn.grnId], references: [goodsReceivedNote.id] }),
  purchaseOrder: one(purchaseOrder, { fields: [supplierReturn.purchaseOrderId], references: [purchaseOrder.id] }),
  supplier: one(supplier, { fields: [supplierReturn.supplierId], references: [supplier.id] }),
  location: one(location, { fields: [supplierReturn.locationId], references: [location.id] }),
  createdByUser: one(user, { fields: [supplierReturn.createdBy], references: [user.id], relationName: 'srCreatedBy' }),
  items: many(supplierReturnItem),
  creditNotes: many(creditNote),
}));

export const supplierReturnItemRelations = relations(supplierReturnItem, ({ one }) => ({
  supplierReturn: one(supplierReturn, { fields: [supplierReturnItem.supplierReturnId], references: [supplierReturn.id] }),
  grnItem: one(grnItem, { fields: [supplierReturnItem.grnItemId], references: [grnItem.id] }),
  product: one(product, { fields: [supplierReturnItem.productId], references: [product.id] }),
}));

export const creditNoteRelations = relations(creditNote, ({ one }) => ({
  supplierReturn: one(supplierReturn, { fields: [creditNote.supplierReturnId], references: [supplierReturn.id] }),
  replacementGrn: one(goodsReceivedNote, { fields: [creditNote.replacementGrnId], references: [goodsReceivedNote.id] }),
  createdByUser: one(user, { fields: [creditNote.createdBy], references: [user.id], relationName: 'cnCreatedBy' }),
}));

// ============================================================
// SUPPLIER RETURN TYPES
// ============================================================

export type SrSequence = typeof srSequence.$inferSelect;
export type NewSrSequence = typeof srSequence.$inferInsert;
export type SupplierReturn = typeof supplierReturn.$inferSelect;
export type NewSupplierReturn = typeof supplierReturn.$inferInsert;
export type SupplierReturnItem = typeof supplierReturnItem.$inferSelect;
export type NewSupplierReturnItem = typeof supplierReturnItem.$inferInsert;
export type CreditNote = typeof creditNote.$inferSelect;
export type NewCreditNote = typeof creditNote.$inferInsert;

// ============================================================
// INVENTORY
// ============================================================

export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  variantId: uuid('variant_id').references(() => productVariant.id),
  qtyOnHand: integer('qty_on_hand').notNull().default(0),
  inTransit: integer('in_transit').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_inventory_location_product').on(t.locationId, t.productId),
]);

// ============================================================
// POS SEQUENCES
// ============================================================

export const posSequence = pgTable('pos_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationCode: varchar('location_code', { length: 50 }).notNull(),
  dateKey: varchar('date_key', { length: 8 }).notNull(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_pos_seq_loc_date').on(t.locationCode, t.dateKey),
]);

// ============================================================
// POS TRANSACTIONS
// ============================================================

export const posTransaction = pgTable('pos_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: varchar('transaction_id', { length: 50 }).notNull().unique(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  cashierId: uuid('cashier_id').notNull().references(() => user.id),
  shiftId: uuid('shift_id'),
  status: varchar('status', { length: 20, enum: ['open', 'completed', 'voided'] }).notNull().default('open'),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  paymentMethod: varchar('payment_method', { length: 30, enum: ['cash', 'card', 'qris', 'transfer'] }),
  paymentRef: varchar('payment_ref', { length: 100 }),
  amountTendered: decimal('amount_tendered', { precision: 15, scale: 2 }),
  changeAmount: decimal('change_amount', { precision: 15, scale: 2 }),
  taxConfigId: uuid('tax_config_id').references(() => taxConfig.id),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }),
  taxCalcMode: varchar('tax_calc_mode', { length: 20, enum: ['inclusive', 'exclusive'] }),
  notes: text('notes'),
  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by').references(() => user.id),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_pos_txn_status').on(t.status),
  index('idx_pos_txn_location').on(t.locationId),
  index('idx_pos_txn_cashier').on(t.cashierId),
  index('idx_pos_txn_id').on(t.transactionId),
  index('idx_pos_txn_created').on(t.createdAt),
]);

// ============================================================
// POS TRANSACTION ITEMS
// ============================================================

export const posTransactionItem = pgTable('pos_transaction_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  posTransactionId: uuid('pos_transaction_id').notNull().references(() => posTransaction.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => product.id),
  variantId: uuid('variant_id').references(() => productVariant.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  discountType: varchar('discount_type', { length: 10, enum: ['percent', 'fixed'] }),
  discountValue: decimal('discount_value', { precision: 15, scale: 2 }).notNull().default('0'),
  discountAmount: decimal('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  lineTotal: decimal('line_total', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_pos_item_txn_id').on(t.posTransactionId),
]);

// ============================================================
// POS TRANSACTION PAYMENTS (split payment support)
// ============================================================

export const posTransactionPayment = pgTable('pos_transaction_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  posTransactionId: uuid('pos_transaction_id').notNull().references(() => posTransaction.id, { onDelete: 'cascade' }),
  paymentMethod: varchar('payment_method', { length: 30, enum: ['cash', 'card', 'qris', 'transfer'] }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  paymentRef: varchar('payment_ref', { length: 100 }),
  amountTendered: decimal('amount_tendered', { precision: 15, scale: 2 }),
  changeAmount: decimal('change_amount', { precision: 15, scale: 2 }),
  sequence: integer('sequence').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_pos_payment_txn_id').on(t.posTransactionId),
]);

// ============================================================
// INVENTORY RELATIONS
// ============================================================

export const inventoryRelations = relations(inventory, ({ one }) => ({
  location: one(location, { fields: [inventory.locationId], references: [location.id] }),
  product: one(product, { fields: [inventory.productId], references: [product.id] }),
  variant: one(productVariant, { fields: [inventory.variantId], references: [productVariant.id] }),
}));

// ============================================================
// POS TRANSACTION RELATIONS
// ============================================================

export const posTransactionRelations = relations(posTransaction, ({ one, many }) => ({
  location: one(location, { fields: [posTransaction.locationId], references: [location.id] }),
  cashier: one(user, { fields: [posTransaction.cashierId], references: [user.id], relationName: 'posCashier' }),
  voidedByUser: one(user, { fields: [posTransaction.voidedBy], references: [user.id], relationName: 'posVoidedBy' }),
  taxConfigRef: one(taxConfig, { fields: [posTransaction.taxConfigId], references: [taxConfig.id] }),
  items: many(posTransactionItem),
  payments: many(posTransactionPayment),
}));

export const posTransactionItemRelations = relations(posTransactionItem, ({ one }) => ({
  posTransaction: one(posTransaction, { fields: [posTransactionItem.posTransactionId], references: [posTransaction.id] }),
  product: one(product, { fields: [posTransactionItem.productId], references: [product.id] }),
  variant: one(productVariant, { fields: [posTransactionItem.variantId], references: [productVariant.id] }),
}));

export const posTransactionPaymentRelations = relations(posTransactionPayment, ({ one }) => ({
  posTransaction: one(posTransaction, { fields: [posTransactionPayment.posTransactionId], references: [posTransaction.id] }),
}));

// ============================================================
// POS TYPES
// ============================================================

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
export type PosSequence = typeof posSequence.$inferSelect;
export type NewPosSequence = typeof posSequence.$inferInsert;
export type PosTransaction = typeof posTransaction.$inferSelect;
export type NewPosTransaction = typeof posTransaction.$inferInsert;
export type PosTransactionItem = typeof posTransactionItem.$inferSelect;
export type NewPosTransactionItem = typeof posTransactionItem.$inferInsert;
export type PosTransactionPayment = typeof posTransactionPayment.$inferSelect;
export type NewPosTransactionPayment = typeof posTransactionPayment.$inferInsert;

// ============================================================
// POS SHIFTS
// ============================================================

export const posShift = pgTable('pos_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cashierId: uuid('cashier_id').notNull().references(() => user.id),
  locationId: uuid('location_id').notNull().references(() => location.id),
  status: varchar('status', { length: 20, enum: ['open', 'closed'] }).notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  openingFloat: decimal('opening_float', { precision: 15, scale: 2 }).notNull().default('0'),
  expectedCash: decimal('expected_cash', { precision: 15, scale: 2 }),
  actualCash: decimal('actual_cash', { precision: 15, scale: 2 }),
  variance: decimal('variance', { precision: 15, scale: 2 }),
  varianceReason: text('variance_reason'),
  closedBy: uuid('closed_by').references(() => user.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_shift_cashier').on(t.cashierId),
  index('idx_shift_location').on(t.locationId),
  index('idx_shift_status').on(t.status),
]);

// ============================================================
// POS CASH DROPS
// ============================================================

export const posCashDrop = pgTable('pos_cash_drops', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull().references(() => posShift.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason'),
  droppedBy: uuid('dropped_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_cash_drop_shift').on(t.shiftId),
]);

// ============================================================
// POS HELD TRANSACTIONS
// ============================================================

export const posHeldTransaction = pgTable('pos_held_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').references(() => posShift.id),
  locationId: uuid('location_id').notNull().references(() => location.id),
  cashierId: uuid('cashier_id').notNull().references(() => user.id),
  customerNote: text('customer_note'),
  cartData: jsonb('cart_data').notNull(),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => [
  index('idx_held_shift').on(t.shiftId),
  index('idx_held_location').on(t.locationId),
]);

// ============================================================
// SHIFT RELATIONS
// ============================================================

export const posShiftRelations = relations(posShift, ({ one, many }) => ({
  cashier: one(user, { fields: [posShift.cashierId], references: [user.id], relationName: 'shiftCashier' }),
  closedByUser: one(user, { fields: [posShift.closedBy], references: [user.id], relationName: 'shiftClosedBy' }),
  location: one(location, { fields: [posShift.locationId], references: [location.id] }),
  cashDrops: many(posCashDrop),
}));

export const posCashDropRelations = relations(posCashDrop, ({ one }) => ({
  shift: one(posShift, { fields: [posCashDrop.shiftId], references: [posShift.id] }),
  droppedByUser: one(user, { fields: [posCashDrop.droppedBy], references: [user.id] }),
}));

export const posHeldTransactionRelations = relations(posHeldTransaction, ({ one }) => ({
  shift: one(posShift, { fields: [posHeldTransaction.shiftId], references: [posShift.id] }),
  location: one(location, { fields: [posHeldTransaction.locationId], references: [location.id] }),
  cashier: one(user, { fields: [posHeldTransaction.cashierId], references: [user.id] }),
}));

// ============================================================
// SHIFT TYPES
// ============================================================

export type PosShift = typeof posShift.$inferSelect;
export type NewPosShift = typeof posShift.$inferInsert;
export type PosCashDrop = typeof posCashDrop.$inferSelect;
export type NewPosCashDrop = typeof posCashDrop.$inferInsert;
export type PosHeldTransaction = typeof posHeldTransaction.$inferSelect;
export type NewPosHeldTransaction = typeof posHeldTransaction.$inferInsert;

// ============================================================
// TRANSFER SEQUENCES
// ============================================================

export const transferSequence = pgTable('transfer_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  yearMonth: varchar('year_month', { length: 6 }).notNull().unique(),
  lastSequence: integer('last_sequence').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// ============================================================
// TRANSFERS
// ============================================================

export const transfer = pgTable('transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferNumber: varchar('transfer_number', { length: 30 }).notNull().unique(),
  sourceLocationId: uuid('source_location_id').notNull().references(() => location.id),
  destLocationId: uuid('dest_location_id').notNull().references(() => location.id),
  status: varchar('status', { length: 30, enum: [
    'requested', 'pending_approval', 'approved', 'picking', 'dispatched', 'received', 'closed',
  ] }).notNull().default('requested'),
  requestedBy: uuid('requested_by').notNull().references(() => user.id),
  approvedBy: uuid('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_transfer_status').on(t.status),
  index('idx_transfer_source').on(t.sourceLocationId),
  index('idx_transfer_dest').on(t.destLocationId),
  index('idx_transfer_number').on(t.transferNumber),
]);

// ============================================================
// TRANSFER ITEMS
// ============================================================

export const transferItem = pgTable('transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').notNull().references(() => transfer.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  requestedQty: integer('requested_qty').notNull(),
  pickedQty: integer('picked_qty').notNull().default(0),
  receivedQty: integer('received_qty').notNull().default(0),
  discrepancyQty: integer('discrepancy_qty').notNull().default(0),
  discrepancyReason: varchar('discrepancy_reason', { length: 30, enum: ['short', 'over', 'damaged'] }),
  discrepancyNotes: text('discrepancy_notes'),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_transfer_item_transfer').on(t.transferId),
]);

// ============================================================
// TRANSFER RELATIONS
// ============================================================

export const transferRelations = relations(transfer, ({ one, many }) => ({
  sourceLocation: one(location, { fields: [transfer.sourceLocationId], references: [location.id], relationName: 'transferSource' }),
  destLocation: one(location, { fields: [transfer.destLocationId], references: [location.id], relationName: 'transferDest' }),
  requestedByUser: one(user, { fields: [transfer.requestedBy], references: [user.id], relationName: 'transferRequester' }),
  approvedByUser: one(user, { fields: [transfer.approvedBy], references: [user.id], relationName: 'transferApprover' }),
  items: many(transferItem),
}));

export const transferItemRelations = relations(transferItem, ({ one }) => ({
  transfer: one(transfer, { fields: [transferItem.transferId], references: [transfer.id] }),
  product: one(product, { fields: [transferItem.productId], references: [product.id] }),
}));

// ============================================================
// TRANSFER TYPES
// ============================================================

export type TransferSequence = typeof transferSequence.$inferSelect;
export type NewTransferSequence = typeof transferSequence.$inferInsert;
export type Transfer = typeof transfer.$inferSelect;
export type NewTransfer = typeof transfer.$inferInsert;
export type TransferItem = typeof transferItem.$inferSelect;
export type NewTransferItem = typeof transferItem.$inferInsert;

// ============================================================
// STOCK COUNTS
// ============================================================

export const stockCount = pgTable('stock_counts', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  status: varchar('status', { length: 20, enum: ['draft', 'in_progress', 'finalized', 'cancelled'] }).notNull().default('draft'),
  startedBy: uuid('started_by').notNull().references(() => user.id),
  finalizedBy: uuid('finalized_by').references(() => user.id),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_stock_count_location').on(t.locationId),
  index('idx_stock_count_status').on(t.status),
]);

export const stockCountLine = pgTable('stock_count_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  stockCountId: uuid('stock_count_id').notNull().references(() => stockCount.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  systemQty: integer('system_qty').notNull().default(0),
  countedQty: integer('counted_qty'),
  varianceQty: integer('variance_qty'),
  uom: varchar('uom', { length: 50 }).notNull().default('pcs'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_stock_count_line_count').on(t.stockCountId),
]);

// ============================================================
// STOCK ADJUSTMENTS
// ============================================================

export const stockAdjustment = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  qty: integer('qty').notNull(),
  reasonCode: varchar('reason_code', { length: 30, enum: ['damage', 'theft', 'write_off', 'correction', 'other'] }).notNull(),
  notes: text('notes'),
  adjustedBy: uuid('adjusted_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_adjustment_location').on(t.locationId),
  index('idx_adjustment_product').on(t.productId),
]);

// ============================================================
// INVENTORY MOVEMENTS (ledger)
// ============================================================

export const inventoryMovement = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  movementType: varchar('movement_type', { length: 30, enum: [
    'sale', 'return', 'grn', 'transfer_out', 'transfer_in', 'adjustment', 'stock_count', 'opening_balance',
  ] }).notNull(),
  qty: integer('qty').notNull(),
  referenceId: uuid('reference_id'),
  referenceType: varchar('reference_type', { length: 50 }),
  balanceAfter: integer('balance_after').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_movement_location').on(t.locationId),
  index('idx_movement_product').on(t.productId),
  index('idx_movement_type').on(t.movementType),
  index('idx_movement_created').on(t.createdAt),
]);

// ============================================================
// STOCK ALERT CONFIG
// ============================================================

export const stockAlertConfig = pgTable('stock_alert_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => location.id),
  productId: uuid('product_id').notNull().references(() => product.id),
  minQty: integer('min_qty').notNull().default(0),
  maxQty: integer('max_qty'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (t) => [
  index('idx_alert_config_location').on(t.locationId),
]);

// ============================================================
// INVENTORY MANAGEMENT RELATIONS
// ============================================================

export const stockCountRelations = relations(stockCount, ({ one, many }) => ({
  location: one(location, { fields: [stockCount.locationId], references: [location.id] }),
  startedByUser: one(user, { fields: [stockCount.startedBy], references: [user.id], relationName: 'countStartedBy' }),
  finalizedByUser: one(user, { fields: [stockCount.finalizedBy], references: [user.id], relationName: 'countFinalizedBy' }),
  lines: many(stockCountLine),
}));

export const stockCountLineRelations = relations(stockCountLine, ({ one }) => ({
  stockCount: one(stockCount, { fields: [stockCountLine.stockCountId], references: [stockCount.id] }),
  product: one(product, { fields: [stockCountLine.productId], references: [product.id] }),
}));

export const stockAdjustmentRelations = relations(stockAdjustment, ({ one }) => ({
  location: one(location, { fields: [stockAdjustment.locationId], references: [location.id] }),
  product: one(product, { fields: [stockAdjustment.productId], references: [product.id] }),
  adjustedByUser: one(user, { fields: [stockAdjustment.adjustedBy], references: [user.id] }),
}));

export const inventoryMovementRelations = relations(inventoryMovement, ({ one }) => ({
  location: one(location, { fields: [inventoryMovement.locationId], references: [location.id] }),
  product: one(product, { fields: [inventoryMovement.productId], references: [product.id] }),
}));

export const stockAlertConfigRelations = relations(stockAlertConfig, ({ one }) => ({
  location: one(location, { fields: [stockAlertConfig.locationId], references: [location.id] }),
  product: one(product, { fields: [stockAlertConfig.productId], references: [product.id] }),
}));

// ============================================================
// INVENTORY MANAGEMENT TYPES
// ============================================================

export type StockCount = typeof stockCount.$inferSelect;
export type NewStockCount = typeof stockCount.$inferInsert;
export type StockCountLine = typeof stockCountLine.$inferSelect;
export type NewStockCountLine = typeof stockCountLine.$inferInsert;
export type StockAdjustment = typeof stockAdjustment.$inferSelect;
export type NewStockAdjustment = typeof stockAdjustment.$inferInsert;
export type InventoryMovement = typeof inventoryMovement.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovement.$inferInsert;
export type StockAlertConfig = typeof stockAlertConfig.$inferSelect;
export type NewStockAlertConfig = typeof stockAlertConfig.$inferInsert;
