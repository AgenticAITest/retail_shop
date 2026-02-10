import { boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenant = pgTable('sys_tenant', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
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

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
export type ModuleRegistry = typeof moduleRegistry.$inferSelect;
export type NewModuleRegistry = typeof moduleRegistry.$inferInsert;