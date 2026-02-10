import { sql, relations } from 'drizzle-orm';
import { date, integer, pgTable, text, time, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';


export const document = pgTable('demo_document', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  releaseDate: date("release_date"),
  pages: integer('pages'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const department = pgTable('demo_department', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  group: varchar('group', { length: 255 }).notNull(),
  since: date("date").notNull(),
  inTime: time('in_time').notNull(),
  outTime: time('out_time').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const employee = pgTable('demo_employee', {
  id: uuid('id').primaryKey(),
  empNo: varchar('empNo', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  status: varchar('status', { length: 255, enum: ["active", "inactive"] }).notNull(),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => department.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const employeeBio = pgTable('demo_employee_bio', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  birthPlace: varchar('birth_place', { length: 255 }).notNull(),
  birthDate: date("date").notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  gender: varchar('gender', { length: 255, enum: ["male", "female"] }).notNull(),
  employeeId: uuid('employee_id')
    .references(() => employee.id, { onDelete: 'cascade' })
    .notNull(), // Foreign key to employee table
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const employeeSkill = pgTable('demo_employee_skill', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  rating: integer('rating').notNull(),
  employeeId: uuid('employee_id')
    .references(() => employee.id, { onDelete: 'cascade' })
    .notNull(),
});

// Define the relations
export const employeeRelations = relations(employee, ({ one, many }) => ({
  bio: one(employeeBio, {
    fields: [employee.id],
    references: [employeeBio.employeeId],
  }),
  skills: many(employeeSkill),
  department: one(department, {
    fields: [employee.departmentId],
    references: [department.id],
  }),
}));

export const employeeBioRelations = relations(employeeBio, ({ one }) => ({
  employee: one(employee, {
    fields: [employeeBio.employeeId],
    references: [employee.id],
  }),
}));

export const employeeSkillRelations = relations(employeeSkill, ({ one }) => ({
  employee: one(employee, {
    fields: [employeeSkill.employeeId],
    references: [employee.id],
  }),
}));

export type Document = typeof document.$inferSelect;

export type Department = typeof department.$inferSelect;

export type Employee = typeof employee.$inferSelect;

export type EmployeeSkill = typeof employeeSkill.$inferSelect;

export type EmployeeBio = typeof employeeBio.$inferSelect;
