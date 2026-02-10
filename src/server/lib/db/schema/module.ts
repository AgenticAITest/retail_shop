import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const moduleAuthorization = pgTable('sys_module_auth', {
  id: uuid('id').primaryKey(),
  moduleId: varchar('module_id', { length: 255 }).notNull(),
  moduleName: varchar('module_name', { length: 255 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  enabledAt: timestamp("enabled_at"),
  enabledBy: varchar('enabled_by', { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

// Types
export type ModuleAuthorization = typeof moduleAuthorization.$inferSelect;
export type NewModuleAuthorization = typeof moduleAuthorization.$inferInsert;
