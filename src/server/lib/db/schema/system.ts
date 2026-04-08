import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const user = pgTable('sys_user', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullname: varchar('fullname', { length: 255 }).notNull(),
  status: varchar('status', { length: 255, enum: ["active", "inactive"] }).notNull(),
  email: varchar('email', { length: 255 }),
  avatar: varchar('avatar', { length: 255 }),
  pinHash: varchar('pin_hash', { length: 255 }),
  pinFailedAttempts: integer('pin_failed_attempts').default(0),
  pinLockedUntil: timestamp('pin_locked_until'),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const role = pgTable('sys_role', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  isSystem: boolean('is_system').notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const permission = pgTable('sys_permission', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const option = pgTable('sys_option', {
  id: uuid('id').primaryKey(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const userRole = pgTable('sys_user_role', {
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id),
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id),
},
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] })
  ]);

export const rolePermission = pgTable('sys_role_permission', {
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id),
  permissionId: uuid('permission_id')
    .notNull()
    .references(() => permission.id),
},
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] })
  ]);


// user relations
export const userRelations = relations(user, ({ many }) => ({
  roles: many(userRole),
}));

// role relations
export const roleRelations = relations(role, ({ many }) => ({
  users: many(userRole),
  permissions: many(rolePermission)
}));

// permission relations
export const permissionRelations = relations(permission, ({ many }) => ({
  roles: many(rolePermission),
}));

// user role relations
export const userRoleRelations = relations(userRole, ({ one }) => ({
  role: one(role, {
    fields: [userRole.roleId],
    references: [role.id],
  }),
  user: one(user, {
    fields: [userRole.userId],
    references: [user.id],
  }),
}));

// role permission relations
export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.roleId],
    references: [role.id],
  }),
  permission: one(permission, {
    fields: [rolePermission.permissionId],
    references: [permission.id],
  }),
}));


export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;

export type Permission = typeof permission.$inferSelect;
export type NewPermission = typeof permission.$inferInsert;

export type Option = typeof option.$inferSelect;
export type NewOption = typeof option.$inferInsert;

export type UserRole = typeof userRole.$inferSelect;
export type NewUserRole = typeof userRole.$inferInsert;

export type RolePermission = typeof rolePermission.$inferSelect;
export type NewRolePermission = typeof rolePermission.$inferInsert;
