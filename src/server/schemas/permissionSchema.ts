import { sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';
import * as tenantSchema from '../lib/db/schema/tenantSchema';

export const permissionSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required"),
  name: z.string().nonempty("Name is required"),
  description: z.string().max(255, "Description must be up to 255 characters")
    .optional()
});

export const permissionValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return  permissionSchema
  .refine(
    async (data) => {
      if (data.id) {
        // check unique code when edit data
        const existing = await tenantDb
          .select()
          .from(tenantSchema.permission)
          .where(sql`${tenantSchema.permission.code} = ${data.code} AND ${tenantSchema.permission.id} != ${data.id}`);
        return existing.length === 0;
      } else {
        // check unique code when create data
        const existing = await tenantDb
          .select()
          .from(tenantSchema.permission)
          .where(sql`${tenantSchema.permission.code} = ${data.code}`);
        return existing.length === 0;
      }
    },
    {
      message: "Code already exists",
      path: ["code"],
    }
  );
} 

export const permissionCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required"),
});

export const permissionCodeValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return permissionCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.permission)
            .where(sql`${tenantSchema.permission.code} = ${data.code} AND ${tenantSchema.permission.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.permission)
            .where(sql`${tenantSchema.permission.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
  )
}