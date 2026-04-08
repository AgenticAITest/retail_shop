import { supplier, supplierContact } from "@server/lib/db/schema/tenantSchema";
import { supplierSchema, supplierContactSchema } from "@modules/supplier-management/server/schemas/supplierSchema";
import { checkModuleAuthorization } from "@server/middleware/moduleAuthMiddleware";
import { eq, sql } from "drizzle-orm";
import { Router } from "express";
import { authenticated, authorized, resolveTenantContext } from "src/server/middleware/authMiddleware";
import { parse as csvParse } from 'fast-csv';
import { Readable } from 'stream';

const supplierImportRoutes = Router();
supplierImportRoutes.use(resolveTenantContext());
supplierImportRoutes.use(authenticated());
supplierImportRoutes.use(checkModuleAuthorization('supplier-management'));

const CSV_HEADERS = [
  'supplier_code', 'name', 'npwp', 'address', 'payment_terms',
  'lead_time_days', 'contact_name', 'contact_email', 'contact_phone', 'contact_role'
];

// ============================================================
// TEMPLATE
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-management/import-export/template:
 *   get:
 *     tags:
 *       - Supplier Management - Import/Export
 *     summary: Download CSV template
 *     description: Download a CSV template with headers for supplier import
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
supplierImportRoutes.get("/template", authorized("ADMIN", "retail.supplier.create"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  const csvContent = CSV_HEADERS.join(',') + '\n';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="supplier_import_template.csv"');
  res.send(csvContent);
});


// ============================================================
// IMPORT
// ============================================================

/**
 * @swagger
 * /api/modules/supplier-management/import-export/import:
 *   post:
 *     tags:
 *       - Supplier Management - Import/Export
 *     summary: Import suppliers from CSV
 *     description: >
 *       Parse and import suppliers from CSV data. Validates each row.
 *       Upserts by supplier_code. Creates contacts from the same row.
 *       Returns summary of imported, skipped, and errored rows.
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
supplierImportRoutes.post("/import", authorized("ADMIN", "retail.supplier.create"), async (req, res) => {

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

    // Map CSV columns to supplier schema fields
    const mappedSupplier = {
      code: row.supplier_code,
      name: row.name,
      npwp: row.npwp || null,
      address: row.address || null,
      paymentTerms: row.payment_terms || null,
      leadTimeDays: row.lead_time_days ? Number(row.lead_time_days) : null,
    };

    // Validate supplier fields
    const parsedSupplier = supplierSchema.safeParse(mappedSupplier);
    if (!parsedSupplier.success) {
      for (const issue of parsedSupplier.error.issues) {
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
      // Upsert supplier by code
      const existing = await req.tenantDb
        .select()
        .from(supplier)
        .where(eq(supplier.code, parsedSupplier.data.code))
        .limit(1)
        .then((rows) => rows[0]);

      let supplierId: string;

      if (existing) {
        await req.tenantDb.update(supplier).set({
          name: parsedSupplier.data.name,
          npwp: parsedSupplier.data.npwp || null,
          address: parsedSupplier.data.address || null,
          paymentTerms: parsedSupplier.data.paymentTerms || null,
          leadTimeDays: parsedSupplier.data.leadTimeDays || null,
        }).where(eq(supplier.id, existing.id));
        supplierId = existing.id;
      } else {
        const newSupplier = await req.tenantDb.insert(supplier).values({
          id: crypto.randomUUID(),
          code: parsedSupplier.data.code,
          name: parsedSupplier.data.name,
          npwp: parsedSupplier.data.npwp || null,
          address: parsedSupplier.data.address || null,
          paymentTerms: parsedSupplier.data.paymentTerms || null,
          leadTimeDays: parsedSupplier.data.leadTimeDays || null,
          status: 'active',
        })
          .returning()
          .then((rows) => rows[0]);
        supplierId = newSupplier.id;
      }

      // Create contact from same row if contact_name is provided
      if (row.contact_name) {
        const mappedContact = {
          name: row.contact_name,
          role: row.contact_role || 'general',
          email: row.contact_email || null,
          phone: row.contact_phone || null,
          isPrimary: false,
        };

        const parsedContact = supplierContactSchema.safeParse(mappedContact);
        if (parsedContact.success) {
          await req.tenantDb.insert(supplierContact).values({
            id: crypto.randomUUID(),
            supplierId,
            name: parsedContact.data.name,
            role: parsedContact.data.role,
            phone: parsedContact.data.phone || null,
            email: parsedContact.data.email || null,
            isPrimary: false,
          });
        } else {
          for (const issue of parsedContact.error.issues) {
            errors.push({
              row: rowNumber,
              column: `contact_${issue.path.join('.')}`,
              message: issue.message,
            });
          }
        }
      }

      imported++;
    } catch (error) {
      console.error(`Error importing row ${rowNumber}:`, error);
      errors.push({
        row: rowNumber,
        column: 'supplier_code',
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
 * /api/modules/supplier-management/import-export/export:
 *   get:
 *     tags:
 *       - Supplier Management - Import/Export
 *     summary: Export suppliers as CSV
 *     description: Export all active suppliers as a CSV file, including primary contact info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file of active suppliers
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
supplierImportRoutes.get("/export", authorized("ADMIN", "retail.supplier.view"), async (req, res) => {

  if (!req.tenantDb) {
    return res.status(500).json({ error: "Tenant database connection not found." });
  }

  try {
    const suppliers = await req.tenantDb.query.supplier.findMany({
      where: eq(supplier.status, 'active'),
      with: {
        contacts: true,
      },
    });

    // Build CSV
    const csvRows = [CSV_HEADERS.join(',')];

    for (const s of suppliers) {
      // Find primary contact, or first contact, or empty
      const primaryContact = s.contacts?.find((c: any) => c.isPrimary) || s.contacts?.[0];

      const row = [
        escapeCsvField(s.code),
        escapeCsvField(s.name),
        escapeCsvField(s.npwp || ''),
        escapeCsvField(s.address || ''),
        escapeCsvField(s.paymentTerms || ''),
        s.leadTimeDays != null ? String(s.leadTimeDays) : '',
        escapeCsvField(primaryContact?.name || ''),
        escapeCsvField(primaryContact?.email || ''),
        escapeCsvField(primaryContact?.phone || ''),
        escapeCsvField(primaryContact?.role || ''),
      ];

      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="suppliers_export.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting suppliers:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default supplierImportRoutes;
