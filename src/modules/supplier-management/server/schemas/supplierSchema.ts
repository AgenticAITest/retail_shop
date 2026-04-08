import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { supplier } from '@server/lib/db/schema/tenantSchema';
import * as tenantSchema from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ============================================================
// SUPPLIER SCHEMA
// ============================================================

export const bankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
}).optional().nullable();

export const supplierSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  npwp: z.string()
    .regex(/^\d{15,16}$/, "NPWP must be 15-16 digits")
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().optional().nullable(),
  bankDetails: bankDetailsSchema,
  status: z.enum(['active', 'inactive']).default('active'),
});

// ============================================================
// SUPPLIER CONTACT SCHEMA
// ============================================================

export const supplierContactSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  role: z.enum(['sales', 'ar', 'logistics', 'general'], {
    error: "Role is required",
  }),
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});

// ============================================================
// SUPPLIER PRODUCT SCHEMA
// ============================================================

export const supplierProductSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  productId: z.string().uuid("Product ID is required"),
  supplierPrice: z.coerce.number({ error: "Supplier price is required" }),
  minOrderQty: z.coerce.number().default(1).optional(),
  supplierSku: z.string().optional().nullable(),
});

// ============================================================
// SUPPLIER CODE VALIDATOR (async uniqueness check)
// ============================================================

export const supplierCodeValidationSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
});

export const supplierCodeValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return supplierCodeValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(supplier)
            .where(sql`${supplier.code} = ${data.code} AND ${supplier.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(supplier)
            .where(sql`${supplier.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    );
};

export const supplierValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return supplierSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(supplier)
            .where(sql`${supplier.code} = ${data.code} AND ${supplier.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(supplier)
            .where(sql`${supplier.code} = ${data.code}`);
          return existing.length === 0;
        }
      },
      {
        message: "Code already exists",
        path: ["code"],
      }
    );
};
