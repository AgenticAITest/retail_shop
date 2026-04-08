import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { product, category } from '@server/lib/db/schema/tenantSchema';
import * as tenantSchema from '@server/lib/db/schema/tenantSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ============================================================
// PRODUCT SCHEMA
// ============================================================

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  skuCode: z.string().min(1, "SKU code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid({ error: "Invalid category ID" }).optional().nullable(),
  brand: z.string().optional().nullable(),
  uom: z.string().default('pcs'),
  baseCostPrice: z.coerce.number({ error: "Cost price is required" }),
  sellingPrice: z.coerce.number({ error: "Selling price is required" }),
  taxApplicable: z.boolean().default(true),
  status: z.enum(['draft', 'active', 'discontinued', 'archived'], {
    error: "Status must be one of: draft, active, discontinued, archived",
  }).default('draft'),
});

export const productValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return productSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(product)
            .where(sql`${product.skuCode} = ${data.skuCode} AND ${product.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(product)
            .where(sql`${product.skuCode} = ${data.skuCode}`);
          return existing.length === 0;
        }
      },
      {
        message: "SKU code already exists",
        path: ["skuCode"],
      }
    );
};

export const skuValidationSchema = z.object({
  id: z.string().uuid().optional(),
  skuCode: z.string().min(1, "SKU code is required"),
});

export const skuValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return skuValidationSchema
    .refine(
      async (data) => {
        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(product)
            .where(sql`${product.skuCode} = ${data.skuCode} AND ${product.id} != ${data.id}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(product)
            .where(sql`${product.skuCode} = ${data.skuCode}`);
          return existing.length === 0;
        }
      },
      {
        message: "SKU code already exists",
        path: ["skuCode"],
      }
    );
};

// ============================================================
// VARIANT SCHEMA
// ============================================================

export const variantSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid({ error: "Product ID is required" }),
  variantSku: z.string().min(1, "Variant SKU is required"),
  attributes: z.record(z.string(), z.string()).optional().nullable(),
  costPrice: z.coerce.number({ error: "Cost price is required" }),
  sellingPrice: z.coerce.number({ error: "Selling price is required" }),
  status: z.enum(['active', 'inactive'], {
    error: "Status must be one of: active, inactive",
  }).default('active'),
});

// ============================================================
// BARCODE SCHEMA
// ============================================================

export const barcodeSchema = z.object({
  id: z.string().uuid().optional(),
  barcodeValue: z.string().min(1, "Barcode value is required"),
  barcodeType: z.enum(['ean13', 'upca', 'internal'], {
    error: "Barcode type must be one of: ean13, upca, internal",
  }).default('internal'),
  productId: z.string().uuid({ error: "Invalid product ID" }).optional().nullable(),
  variantId: z.string().uuid({ error: "Invalid variant ID" }).optional().nullable(),
});

// ============================================================
// CATEGORY SCHEMA
// ============================================================

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Category name is required"),
  parentId: z.string().uuid({ error: "Invalid parent ID" }).optional().nullable(),
  level: z.number().optional(),
  sortOrder: z.number().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const categoryNameValidationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Category name is required"),
  parentId: z.string().uuid().optional().nullable(),
});

export const categoryNameValidator = (tenantDb: PostgresJsDatabase<typeof tenantSchema> & { $client: postgres.Sql<{}> }) => {
  return categoryNameValidationSchema
    .refine(
      async (data) => {
        const parentCondition = data.parentId
          ? sql`${category.parentId} = ${data.parentId}`
          : sql`${category.parentId} IS NULL`;

        if (data.id) {
          const existing = await tenantDb
            .select()
            .from(category)
            .where(sql`${category.name} = ${data.name} AND ${category.id} != ${data.id} AND ${parentCondition}`);
          return existing.length === 0;
        } else {
          const existing = await tenantDb
            .select()
            .from(category)
            .where(sql`${category.name} = ${data.name} AND ${parentCondition}`);
          return existing.length === 0;
        }
      },
      {
        message: "Category name already exists within the same parent",
        path: ["name"],
      }
    );
};
