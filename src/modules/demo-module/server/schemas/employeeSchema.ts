import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { employee } from '@modules/demo-module/server/lib/db/schemas/demoModule';
import * as tenantSchema  from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const employeeSchema = z.object({
  id: z.string().optional(),
  empNo: z.string().nonempty("Employee No is required"),
  email: z.email("Invalid email address"),
  status: z.enum(["active", "inactive"]).nonoptional("Status is required"),
  departmentId: z.string().nonempty("Department is required"),
  name: z.string().nonempty("Name is required"),
  birthPlace: z.string().nonempty("Birth Place is required"),
  birthDate: z.coerce.date().nonoptional("Birth Date is required"),
  address: z.string().nonempty("Address is required"),
  gender: z.enum(["male", "female"]).nonoptional("Gender is required"),
  skills: z.array(z.object({
    name: z.string().optional(),
    rating: z.number().optional(),
  })),
});

export const employeeValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return employeeSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique empNo when edit data
          const existing = await tenantDb
            .select()
            .from(employee)
            .where(sql`${employee.empNo} = ${data.empNo} AND ${employee.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique empNo when create data
          const existing = await tenantDb
            .select()
            .from(employee)
            .where(sql`${employee.empNo} = ${data.empNo}`);
          return existing.length === 0;
        }
      },
      {
        message: "Employee No already exists",
        path: ["empNo"],
      }
    )
}

export const employeeNoValidationSchema = z.object({
  id: z.string().optional(),
  empNo: z.string().nonempty("Employee No is required"),
});

export const employeeNoValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return employeeNoValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique empNo when edit data
          const existing = await tenantDb
            .select()
            .from(employee)
            .where(sql`${employee.empNo} = ${data.empNo} AND ${employee.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique empNo when create data
          const existing = await tenantDb
            .select()
            .from(employee)
            .where(sql`${employee.empNo} = ${data.empNo}`);
          return existing.length === 0;
        }
      },
      {
        message: "Employee No already exists",
        path: ["empNo"],
      }
    )
}