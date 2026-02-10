import { sql } from 'drizzle-orm';
import { z } from 'zod';
import * as tenantSchema  from '../lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const optionSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required"),
  name: z.string().nonempty("Name is required"),
  value: z.string().nonempty("Value is required"),
});

export const optionValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return optionSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.option)
            .where(sql`${tenantSchema.option.code} = ${data.code} AND ${tenantSchema.option.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.option)
            .where(sql`${tenantSchema.option.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
} 

export const optionCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required"),
});

export const optionCodeValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return optionCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.option)
            .where(sql`${tenantSchema.option.code} = ${data.code} AND ${tenantSchema.option.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(tenantSchema.option)
            .where(sql`${tenantSchema.option.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    );
} 