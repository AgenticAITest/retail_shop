import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { document } from '@modules/demo-module/server/lib/db/schemas/demoModule';
import * as tenantSchema  from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const documentSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty("Name is required"),
  code: z.string().nonempty("Code is required"),
  releaseDate: z.coerce.date(),
  pages: z.number().optional(),
});

export const documentValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return documentSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(document)
            .where(sql`${document.code} = ${data.code} AND ${document.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(document)
            .where(sql`${document.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}

export const documentCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().nonempty("Code is required"),
});

export const documentCodeValidator = (tenantDb : PostgresJsDatabase<typeof tenantSchema> & {$client: postgres.Sql<{}>}) => {
  return documentCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          // check unique code when edit data
          const existing = await tenantDb
            .select()
            .from(document)
            .where(sql`${document.code} = ${data.code} AND ${document.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          // check unique code when create data
          const existing = await tenantDb
            .select()
            .from(document)
            .where(sql`${document.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    )
}
