import { sql } from 'drizzle-orm';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { JSDOM } from 'jsdom';
import postgres from 'postgres';
import * as tenantSchema from '../lib/db/schema/tenantSchema';

const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

export const roleSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required")
  .refine(
    (val) => val.toUpperCase() !== "SYSADMIN",
    {
      message: "Role Code is reserved",
      path: ["code"],
    }
  )
  .transform(val => val ? DOMPurifyInstance.sanitize(val) : val),
  name: z.string().nonempty("Name is required"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional()
});

export const roleValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return  roleSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.code} = ${data.code} AND ${tenantSchema.role.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}

export const roleCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required")
  .refine(
    (val) => val !== "SYSADMIN",
    {
      message: "Role Code is reserved",
      path: ["code"],
    }
  ),
});

export const roleCodeValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return roleCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.code} = ${data.code} AND ${tenantSchema.role.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.role)
            .where(sql`${tenantSchema.role.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}