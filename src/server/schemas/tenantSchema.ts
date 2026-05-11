import { sql } from 'drizzle-orm';
import { z } from 'zod';
// import { db } from '../lib/db';
import * as sharedSchema from '../lib/db/schema/sharedSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const tenantSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required").lowercase("Must be lowercase"),
  name: z.string().nonempty("Name is required"),
  description: z.string().max(255, "Description must be up to 255 characters")
    .optional(),
  status: z.enum(['pending_setup', 'active', 'suspended']).optional(),
});

export const tenantValidator = (sharedDb : PostgresJsDatabase<typeof sharedSchema> & {$client: postgres.Sql<{}>}) => {
  return tenantSchema
    .refine(
      (data) => {
        return !data.code.includes(' ')
      },
      {
        message: "Must not contain spaces",
        path: ["code"],
      }
    )
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.code.toLowerCase} AND ${sharedSchema.tenant.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.code.toLowerCase()}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}

export const tenantCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required").lowercase("Must be lowercase"),
});

export const tenantCodeValidator = (sharedDb : PostgresJsDatabase<typeof sharedSchema> & {$client: postgres.Sql<{}>}) => {
  return tenantCodeValidationSchema
  .refine(
      (data) => {
        return !data.code.includes(' ')
      },
      {
        message: "Must not contain spaces",
        path: ["code"],
      }
    )
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.code.toLowerCase} AND ${sharedSchema.tenant.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await sharedDb
            .select()
            .from(sharedSchema.tenant)
            .where(sql`lower(${sharedSchema.tenant.code}) = ${data.code.toLowerCase()}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}