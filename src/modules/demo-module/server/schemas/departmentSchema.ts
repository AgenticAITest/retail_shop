import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { department } from '@modules/demo-module/server/lib/db/schemas/demoModule';
import * as tenantSchema  from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const departmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty("Name is required"),
  group: z.string().nonempty("Group is required"),
  since: z.coerce.date().nonoptional("Since is required"),
  inTime: z.coerce.date().nonoptional("InTime is required"),
  outTime: z.coerce.date().nonoptional("OutTime is required"),
});

export const departmentValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return departmentSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(department)
            .where(sql`${department.name} = ${data.name} AND ${department.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(department)
            .where(sql`${department.name} = ${data.name}`);
          return existing.length === 0;
        }
      },
      {
        message: "Name already exists",
        path: ["name"],
      }
    )
}

export const departmentNameValidationSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty("Name is required"),
});

export const departmentNameValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return departmentNameValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(department)
            .where(sql`${department.name} = ${data.name} AND ${department.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(department)
            .where(sql`${department.name} = ${data.name}`);
          return existing.length === 0;
        }
      },
      {
        message: "Name already exists",
        path: ["name"],
      }
    )
}