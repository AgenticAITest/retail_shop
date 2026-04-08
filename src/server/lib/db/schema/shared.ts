import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenant = pgTable('sys_tenant', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  businessName: varchar('business_name', { length: 255 }),
  npwp: varchar('npwp', { length: 20 }),
  address: text('address'),
  logoUrl: varchar('logo_url', { length: 500 }),
  plan: varchar('plan', { length: 50 }).default('standard'),
  status: varchar('status', { length: 20, enum: ['pending_setup', 'active', 'suspended'] }).default('pending_setup').notNull(),
  onboardingStep: integer('onboarding_step').default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const moduleRegistry = pgTable('sys_module_registry', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: varchar('moduleId', { length: 255 }).notNull().unique(),
  moduleName: varchar('moduleName', { length: 255 }).notNull(),
  description: text('description'),
  version: varchar('version', { length: 50 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  isActive: boolean('isActive').notNull().default(true),
  repositoryUrl: varchar('repositoryUrl', { length: 500 }),
  documentationUrl: varchar('documentationUrl', { length: 500 }),
  createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow(),
});

export const tenantSubscription = pgTable('sys_tenant_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
  plan: varchar('plan', { length: 50 }).notNull().default('standard'),
  maxShops: integer('max_shops').notNull().default(10),
  maxUsers: integer('max_users').notNull().default(50),
  maxSkus: integer('max_skus').notNull().default(50000),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
export type ModuleRegistry = typeof moduleRegistry.$inferSelect;
export type NewModuleRegistry = typeof moduleRegistry.$inferInsert;
export type TenantSubscription = typeof tenantSubscription.$inferSelect;
export type NewTenantSubscription = typeof tenantSubscription.$inferInsert;