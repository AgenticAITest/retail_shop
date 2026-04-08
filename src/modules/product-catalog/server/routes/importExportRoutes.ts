import { product, category } from "@server/lib/db/schema/tenantSchema";
import { productSchema } from "@modules/product-catalog/server/schemas/productSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { eq, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { parse as csvParse } from 'fast-csv';
import { Readable } from 'stream';

const importExportRoutes = Router();
importExportRoutes.use(resolveTenantContext());
importExportRoutes.use(authenticated());
importExportRoutes.use(checkModuleAuthorization('product-catalog'));

const CSV_HEADERS = [
  'sku_code', 'name', 'description', 'category', 'brand',
  'uom', 'cost_price', 'selling_price', 'tax_applicable', 'barcode', 'status'
];

// ============================================================
// TEMPLATE
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/import-export/template:
 *   get:
 *     tags:
 *       - Product Catalog - Import/Export
 *     summary: Download CSV template
 *     description: Download a CSV template with headers for product import
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
importExportRoutes.get("/template", authorized("ADMIN", "retail.product.import"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const csvContent = CSV_HEADERS.join(',') + '\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="product_import_template.csv"');
  res.send(csvContent);
});


// ============================================================
// IMPORT
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/import-export/import:
 *   post:
 *     tags:
 *       - Product Catalog - Import/Export
 *     summary: Import products from CSV
 *     description: >
 *       Parse and import products from CSV data. Validates each row with Zod.
 *       Upserts by sku_code. Returns summary of imported, skipped, and errored rows.
 *     requestBody:
 *       required: true
 *       content:
 *         text/csv:
 *           schema:
 *             type: string
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               csvData:
 *                 type: string
 *                 description: Raw CSV string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Import result summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: integer
 *                       column:
 *                         type: string
 *                       message:
 *                         type: string
 */
importExportRoutes.post("/import", authorized("ADMIN", "retail.product.import"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const csvData = req.body.csvData || '';

  if (!csvData) {
    return res.status(400).json({ error: "CSV data is required. Send as { csvData: '...' }" });
  }

  const rows: any[] = [];
  const errors: { row: number; column: string; message: string }[] = [];

  try {
    // Parse CSV string using a readable stream
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from([csvData]);
      stream
        .pipe(csvParse({ headers: true, trim: true }))
        .on('data', (row: any) => {
          rows.push(row);
        })
        .on('error', (error: Error) => {
          reject(error);
        })
        .on('end', () => {
          resolve();
        });
    });
  } catch (error) {
    console.error("CSV parsing error:", error);
    return res.status(400).json({ error: "Failed to parse CSV data" });
  }

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 for 1-indexed + header row

    // Map CSV columns to schema fields
    const mapped = {
      skuCode: row.sku_code,
      name: row.name,
      description: row.description || null,
      brand: row.brand || null,
      uom: row.uom || 'pcs',
      baseCostPrice: row.cost_price,
      sellingPrice: row.selling_price,
      taxApplicable: row.tax_applicable !== undefined
        ? row.tax_applicable === 'true' || row.tax_applicable === '1'
        : true,
      status: row.status || 'draft',
    };

    // Validate with Zod
    const parsed = productSchema.safeParse(mapped);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowNumber,
          column: issue.path.join('.'),
          message: issue.message,
        });
      }
      skipped++;
      continue;
    }

    try {
      // Resolve category by name if provided
      let categoryId: string | null = null;
      if (row.category) {
        const cat = await req.tenantDb
          .select()
          .from(category)
          .where(eq(category.name, row.category))
          .limit(1)
          .then((rows) => rows[0]);

        if (cat) {
          categoryId = cat.id;
        }
      }

      // Upsert by sku_code
      const existing = await req.tenantDb
        .select()
        .from(product)
        .where(eq(product.skuCode, parsed.data.skuCode))
        .limit(1)
        .then((rows) => rows[0]);

      if (existing) {
        await req.tenantDb.update(product).set({
          name: parsed.data.name,
          description: parsed.data.description || null,
          categoryId,
          brand: parsed.data.brand || null,
          uom: parsed.data.uom || 'pcs',
          baseCostPrice: String(parsed.data.baseCostPrice),
          sellingPrice: String(parsed.data.sellingPrice),
          taxApplicable: parsed.data.taxApplicable,
          status: parsed.data.status,
        }).where(eq(product.id, existing.id));
      } else {
        await req.tenantDb.insert(product).values({
          id: crypto.randomUUID(),
          skuCode: parsed.data.skuCode,
          name: parsed.data.name,
          description: parsed.data.description || null,
          categoryId,
          brand: parsed.data.brand || null,
          uom: parsed.data.uom || 'pcs',
          baseCostPrice: String(parsed.data.baseCostPrice),
          sellingPrice: String(parsed.data.sellingPrice),
          taxApplicable: parsed.data.taxApplicable,
          status: parsed.data.status,
        });
      }

      imported++;
    } catch (error) {
      console.error(`Error importing row ${rowNumber}:`, error);
      errors.push({
        row: rowNumber,
        column: 'sku_code',
        message: `Database error: ${(error as Error).message}`,
      });
      skipped++;
    }
  }

  res.json({ imported, skipped, errors });
});


// ============================================================
// EXPORT
// ============================================================

/**
 * @swagger
 * /api/modules/product-catalog/import-export/export:
 *   get:
 *     tags:
 *       - Product Catalog - Import/Export
 *     summary: Export products as CSV
 *     description: Export all active products as a CSV file
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file of active products
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
importExportRoutes.get("/export", authorized("ADMIN", "retail.product.import"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const products = await req.tenantDb.query.product.findMany({
      where: eq(product.status, 'active'),
      with: {
        category: true,
        barcodes: true,
      },
    });

    // Build CSV
    const csvRows = [CSV_HEADERS.join(',')];

    for (const p of products) {
      const primaryBarcode = p.barcodes && p.barcodes.length > 0 ? p.barcodes[0].barcodeValue : '';
      const categoryName = p.category ? p.category.name : '';

      const row = [
        escapeCsvField(p.skuCode),
        escapeCsvField(p.name),
        escapeCsvField(p.description || ''),
        escapeCsvField(categoryName),
        escapeCsvField(p.brand || ''),
        escapeCsvField(p.uom),
        p.baseCostPrice,
        p.sellingPrice,
        p.taxApplicable ? 'true' : 'false',
        escapeCsvField(primaryBarcode),
        p.status,
      ];

      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting products:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default importExportRoutes;
