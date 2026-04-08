import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { location } from '@server/lib/db/schema/tenantSchema';
import * as tenantSchema from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const syncConfigSchema = z.object({
  frequency: z.enum(['once_daily', 'twice_daily', 'custom']),
  windows: z.array(z.string()),
  bandwidthMode: z.enum(['full', 'compressed']),
  manualSyncEnabled: z.boolean(),
  autoSyncOnReconnect: z.boolean(),
}).optional().nullable();

export const locationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(['shop', 'warehouse', 'distribution_center'], {
    error: "Type is required",
  }),
  parentId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  timezone: z.string().default('Asia/Jakarta'),
  syncConfig: syncConfigSchema,
  status: z.enum(['active', 'inactive']).default('active'),
});

export const locationValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return locationSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(location)
            .where(sql`${location.code} = ${data.code} AND ${location.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(location)
            .where(sql`${location.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    );
};

export const locationCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
});

export const locationCodeValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return locationCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(location)
            .where(sql`${location.code} = ${data.code} AND ${location.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(location)
            .where(sql`${location.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    );
};
