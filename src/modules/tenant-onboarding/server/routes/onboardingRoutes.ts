import { Router } from 'express';
import { eq, and, sql, gte } from 'drizzle-orm';
import { resolveTenantContext, authenticated, authorized } from 'src/server/middleware/authMiddleware';
import { checkModuleAuthorization } from '@server/middleware/moduleAuthMiddleware';
import * as tenantSchema from '@server/lib/db/schema/tenantSchema';
import * as sharedSchema from '@server/lib/db/schema/sharedSchema';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const onboardingRoutes = Router();
onboardingRoutes.use(resolveTenantContext());
onboardingRoutes.use(authenticated());
onboardingRoutes.use(checkModuleAuthorization('tenant-onboarding'));

// ============================================================
// STEP DEFINITIONS
// ============================================================

const STEPS = [
  { step: 1, name: 'Company Profile', required: true },
  { step: 2, name: 'Locations', required: false },
  { step: 3, name: 'Tax Configuration', required: true },
  { step: 4, name: 'Users & Roles', required: false },
  { step: 5, name: 'Import Products', required: false },
  { step: 6, name: 'Import Suppliers', required: false },
  { step: 7, name: 'Opening Stock', required: false, available: false, message: 'Coming in Phase 4' },
  { step: 8, name: 'Approval Rules', required: false },
  { step: 9, name: 'Sync Settings', required: false },
  { step: 10, name: 'Review & Go Live', required: true },
];

const TOTAL_STEPS = 10;
const REQUIRED_STEPS = [1, 3];

// ============================================================
// VALIDATION SCHEMAS (Zod 4 syntax)
// ============================================================

const companyProfileSchema = z.object({
  businessName: z.string().min(1, { error: 'Business name is required' }),
  npwp: z.string().optional(),
  address: z.string().optional(),
  logoUrl: z.string().optional(),
});

const locationItemSchema = z.object({
  code: z.string().min(1, { error: 'Location code is required' }),
  name: z.string().min(1, { error: 'Location name is required' }),
  type: z.enum(['shop', 'warehouse', 'distribution_center'], { error: 'Invalid location type' }),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
});

const locationsSchema = z.object({
  locations: z.array(locationItemSchema),
});

const taxConfigSchema = z.object({
  ratePercent: z.coerce.number({ error: 'Tax rate is required' }).min(0).max(100),
  calcMode: z.enum(['inclusive', 'exclusive'], { error: 'Invalid calculation mode' }),
});

const userItemSchema = z.object({
  username: z.string().min(1, { error: 'Username is required' }),
  fullname: z.string().min(1, { error: 'Full name is required' }),
  email: z.string().email({ error: 'Invalid email address' }),
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }),
  roleCode: z.string().min(1, { error: 'Role code is required' }),
  locationCodes: z.array(z.string()).optional(),
});

const usersSchema = z.object({
  users: z.array(userItemSchema),
});

const approvalConfigItemSchema = z.object({
  transactionType: z.string().min(1, { error: 'Transaction type is required' }),
  isRequired: z.boolean(),
  approverRoleId: z.string().optional(),
  thresholdAmount: z.string().optional(),
});

const approvalConfigsSchema = z.object({
  configs: z.array(approvalConfigItemSchema).min(1, { error: 'At least one config is required' }),
});

const syncLocationItemSchema = z.object({
  locationCode: z.string().min(1, { error: 'Location code is required' }),
  syncConfig: z.object({
    frequency: z.enum(['once_daily', 'twice_daily', 'custom']),
    windows: z.array(z.string()).optional(),
    bandwidthMode: z.enum(['full', 'compressed']).optional(),
    manualSyncEnabled: z.boolean().optional(),
    autoSyncOnReconnect: z.boolean().optional(),
  }),
});

const syncSettingsSchema = z.object({
  locations: z.array(syncLocationItemSchema),
});

// ============================================================
// HELPERS
// ============================================================

/**
 * Update onboardingStep to the given step number only if higher than current.
 */
async function advanceOnboardingStep(sharedDb: any, tenantCode: string, step: number) {
  await sharedDb
    .update(sharedSchema.tenant)
    .set({ onboardingStep: sql`GREATEST(${sharedSchema.tenant.onboardingStep}, ${step})` })
    .where(eq(sharedSchema.tenant.code, tenantCode));
}

/**
 * Get current tenant record from shared schema.
 */
async function getTenantRecord(sharedDb: any, tenantCode: string) {
  const result = await sharedDb
    .select()
    .from(sharedSchema.tenant)
    .where(eq(sharedSchema.tenant.code, tenantCode))
    .limit(1);
  return result[0] || null;
}

/**
 * Clean empty strings from an object (replace with null).
 */
function cleanEmptyStrings(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'id') continue; // Don't send id in create payloads
    cleaned[key] = value === '' ? null : value;
  }
  return cleaned;
}

// ============================================================
// ROUTES
// ============================================================

/**
 * @swagger
 * /api/modules/tenant-onboarding/status:
 *   get:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Get onboarding status
 *     description: Returns the current onboarding progress for the tenant
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentStep:
 *                   type: integer
 *                 totalSteps:
 *                   type: integer
 *                 completed:
 *                   type: boolean
 *                 steps:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       step:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       required:
 *                         type: boolean
 *                       completed:
 *                         type: boolean
 *                       available:
 *                         type: boolean
 *                       message:
 *                         type: string
 */
onboardingRoutes.get('/status', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const tenantRecord = await getTenantRecord(req.sharedDb, req.tenantCode);
    if (!tenantRecord) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const currentStep = tenantRecord.onboardingStep || 0;

    const steps = STEPS.map((s) => ({
      step: s.step,
      name: s.name,
      required: s.required,
      completed: currentStep >= s.step,
      ...(s.available === false ? { available: false, message: s.message } : {}),
    }));

    res.json({
      currentStep,
      totalSteps: TOTAL_STEPS,
      completed: currentStep >= TOTAL_STEPS,
      steps,
    });
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/1:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 1 - Company Profile
 *     description: Update the tenant company profile (business name, NPWP, address, logo)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               npwp:
 *                 type: string
 *               address:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Company profile updated successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/1', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = companyProfileSchema.parse(req.body);

    await req.sharedDb
      .update(sharedSchema.tenant)
      .set({
        businessName: parsed.businessName,
        npwp: parsed.npwp || null,
        address: parsed.address || null,
        logoUrl: parsed.logoUrl || null,
      })
      .where(eq(sharedSchema.tenant.code, req.tenantCode));

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 1);

    res.json({ message: 'Company profile updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error updating company profile:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/2:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 2 - Locations
 *     description: Batch insert locations for the tenant. Skips duplicates by code.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locations
 *             properties:
 *               locations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - code
 *                     - name
 *                     - type
 *                   properties:
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [shop, warehouse, distribution_center]
 *                     address:
 *                       type: string
 *                     city:
 *                       type: string
 *                     province:
 *                       type: string
 *                     phone:
 *                       type: string
 *     responses:
 *       200:
 *         description: Locations imported successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/2', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = locationsSchema.parse(req.body);

    // Get existing location codes to skip duplicates
    const existingLocations = await req.tenantDb
      .select({ code: tenantSchema.location.code })
      .from(tenantSchema.location);
    const existingCodes = new Set(existingLocations.map((l) => l.code));

    const newLocations = parsed.locations.filter((l) => !existingCodes.has(l.code));
    let inserted = 0;

    if (newLocations.length > 0) {
      const values = newLocations.map((l) => cleanEmptyStrings({
        code: l.code,
        name: l.name,
        type: l.type,
        address: l.address || null,
        city: l.city || null,
        province: l.province || null,
        phone: l.phone || null,
      }));

      await req.tenantDb.insert(tenantSchema.location).values(values as any);
      inserted = newLocations.length;
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 2);

    res.json({
      message: 'Locations imported successfully.',
      inserted,
      skipped: parsed.locations.length - inserted,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error importing locations:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/3:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 3 - Tax Configuration
 *     description: Insert or update the active tax configuration. Sets existing active config to historical.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ratePercent
 *               - calcMode
 *             properties:
 *               ratePercent:
 *                 type: string
 *               calcMode:
 *                 type: string
 *                 enum: [inclusive, exclusive]
 *     responses:
 *       200:
 *         description: Tax configuration updated successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/3', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = taxConfigSchema.parse(req.body);

    // Set existing active configs to historical
    await req.tenantDb
      .update(tenantSchema.taxConfig)
      .set({ status: 'historical' })
      .where(eq(tenantSchema.taxConfig.status, 'active'));

    // Insert new active config
    await req.tenantDb.insert(tenantSchema.taxConfig).values({
      ratePercent: String(parsed.ratePercent),
      calcMode: parsed.calcMode,
      effectiveDate: new Date(),
      status: 'active',
    });

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 3);

    res.json({ message: 'Tax configuration updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error updating tax configuration:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/4:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 4 - Users & Roles
 *     description: Create users with role and location assignments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - users
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - username
 *                     - fullname
 *                     - email
 *                     - password
 *                     - roleCode
 *                   properties:
 *                     username:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     password:
 *                       type: string
 *                     roleCode:
 *                       type: string
 *                     locationCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       200:
 *         description: Users created successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/4', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = usersSchema.parse(req.body);
    const created: string[] = [];
    const errors: string[] = [];

    for (const u of parsed.users) {
      try {
        // Hash password
        const passwordHash = await bcrypt.hash(u.password, 10);

        // Create user
        const newUser = await req.tenantDb
          .insert(tenantSchema.user)
          .values({
            id: crypto.randomUUID(),
            username: u.username,
            passwordHash,
            fullname: u.fullname,
            email: u.email,
            status: 'active',
          })
          .returning()
          .then((rows) => rows[0]);

        // Assign role by code
        const roleResult = await req.tenantDb
          .select({ id: tenantSchema.role.id })
          .from(tenantSchema.role)
          .where(eq(tenantSchema.role.code, u.roleCode))
          .limit(1);

        if (roleResult.length > 0) {
          await req.tenantDb.insert(tenantSchema.userRole).values({
            userId: newUser.id,
            roleId: roleResult[0].id,
          });
        }

        // Assign locations by code
        if (u.locationCodes && u.locationCodes.length > 0) {
          for (const locCode of u.locationCodes) {
            const locResult = await req.tenantDb
              .select({ id: tenantSchema.location.id })
              .from(tenantSchema.location)
              .where(eq(tenantSchema.location.code, locCode))
              .limit(1);

            if (locResult.length > 0) {
              await req.tenantDb.insert(tenantSchema.userLocation).values({
                userId: newUser.id,
                locationId: locResult[0].id,
              });
            }
          }
        }

        created.push(u.username);
      } catch (userError) {
        errors.push(`Failed to create user '${u.username}': ${(userError as Error).message}`);
      }
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 4);

    res.json({
      message: 'Users processed successfully.',
      created: created.length,
      errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error creating users:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/5:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 5 - Import Products
 *     description: Upload a CSV file to import products. Upserts by sku_code.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Products imported successfully
 *       400:
 *         description: No file uploaded or invalid CSV
 */
onboardingRoutes.put('/step/5', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const files = (req as any).files;
    if (!files || !files.file) {
      // Allow skipping - no file means skip this step
      await advanceOnboardingStep(req.sharedDb, req.tenantCode, 5);
      return res.json({ message: 'Step skipped. No products imported.', imported: 0, skipped: 0, errors: [] });
    }

    const file = files.file;
    const csvContent = file.data.toString('utf-8');
    const lines = csvContent.split('\n').filter((line: string) => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file must contain a header row and at least one data row.' });
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const skuIndex = headers.indexOf('sku_code');
    const nameIndex = headers.indexOf('name');

    if (skuIndex === -1 || nameIndex === -1) {
      return res.status(400).json({ error: 'CSV must contain sku_code and name columns.' });
    }

    const descIndex = headers.indexOf('description');
    const brandIndex = headers.indexOf('brand');
    const uomIndex = headers.indexOf('uom');
    const costPriceIndex = headers.indexOf('base_cost_price');
    const sellingPriceIndex = headers.indexOf('selling_price');

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c: string) => c.trim());
      const skuCode = cols[skuIndex];
      const name = cols[nameIndex];

      if (!skuCode || !name) {
        errors.push(`Row ${i + 1}: Missing sku_code or name`);
        skipped++;
        continue;
      }

      try {
        // Check if product exists
        const existing = await req.tenantDb!
          .select({ id: tenantSchema.product.id })
          .from(tenantSchema.product)
          .where(eq(tenantSchema.product.skuCode, skuCode))
          .limit(1);

        const productData: Record<string, any> = {
          name,
          description: descIndex >= 0 ? (cols[descIndex] || null) : null,
          brand: brandIndex >= 0 ? (cols[brandIndex] || null) : null,
          uom: uomIndex >= 0 ? (cols[uomIndex] || 'pcs') : 'pcs',
          baseCostPrice: costPriceIndex >= 0 ? (cols[costPriceIndex] || '0') : '0',
          sellingPrice: sellingPriceIndex >= 0 ? (cols[sellingPriceIndex] || '0') : '0',
          status: 'active' as const,
        };

        if (existing.length > 0) {
          // Update existing
          await req.tenantDb!
            .update(tenantSchema.product)
            .set(productData)
            .where(eq(tenantSchema.product.skuCode, skuCode));
        } else {
          // Insert new
          await req.tenantDb!.insert(tenantSchema.product).values({
            skuCode,
            ...productData,
          } as any);
        }

        imported++;
      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${(rowError as Error).message}`);
        skipped++;
      }
    }

    await advanceOnboardingStep(req.sharedDb!, req.tenantCode!, 5);

    res.json({
      message: 'Product import completed.',
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('Error importing products:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/6:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 6 - Import Suppliers (Stub)
 *     description: Supplier import is not yet available. Returns a stub response.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stub response indicating feature is not yet available
 */
onboardingRoutes.put('/step/6', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const files = (req as any).files;
    if (!files || !files.file) {
      // Allow skipping
      await advanceOnboardingStep(req.sharedDb, req.tenantCode, 6);
      return res.json({ message: 'Step skipped. No suppliers imported.', imported: 0, skipped: 0, errors: [] });
    }

    const csvContent = files.file.data.toString('utf-8');
    const lines = csvContent.split('\n').filter((line: string) => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must contain a header row and at least one data row.' });
    }

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const codeIdx = headers.indexOf('supplier_code');
    const nameIdx = headers.indexOf('name');

    if (codeIdx === -1 || nameIdx === -1) {
      return res.status(400).json({ error: 'CSV must contain supplier_code and name columns.' });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c: string) => c.trim());
      const code = cols[codeIdx];
      const name = cols[nameIdx];

      if (!code || !name) {
        errors.push(`Row ${i + 1}: supplier_code and name are required`);
        continue;
      }

      try {
        const existing = await req.tenantDb
          .select()
          .from(tenantSchema.supplier)
          .where(eq(tenantSchema.supplier.code, code))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        await req.tenantDb.insert(tenantSchema.supplier).values({
          code,
          name,
          npwp: cols[headers.indexOf('npwp')] || null,
          address: cols[headers.indexOf('address')] || null,
          paymentTerms: cols[headers.indexOf('payment_terms')] || null,
          leadTimeDays: cols[headers.indexOf('lead_time_days')] ? parseInt(cols[headers.indexOf('lead_time_days')]) : null,
          status: 'active',
        } as any);

        imported++;
      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${(rowError as Error).message}`);
      }
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 6);
    res.json({ message: 'Suppliers imported.', imported, skipped, errors });
  } catch (error) {
    console.error('Error in step 6:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/7:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 7 - Opening Stock (Stub)
 *     description: Opening stock import is not yet available. Returns a stub response.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stub response indicating feature is not yet available
 */
onboardingRoutes.put('/step/7', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 7);

    res.json({
      message: 'Opening stock import will be available in Phase 4',
      available: false,
    });
  } catch (error) {
    console.error('Error in step 7:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/8:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 8 - Approval Rules
 *     description: Batch update approval configurations for the tenant
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configs
 *             properties:
 *               configs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - transactionType
 *                     - isRequired
 *                   properties:
 *                     transactionType:
 *                       type: string
 *                     isRequired:
 *                       type: boolean
 *                     approverRoleId:
 *                       type: string
 *                     thresholdAmount:
 *                       type: string
 *     responses:
 *       200:
 *         description: Approval rules updated successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/8', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = approvalConfigsSchema.parse(req.body);

    for (const config of parsed.configs) {
      // Check if config exists for this transaction type
      const existing = await req.tenantDb
        .select({ id: tenantSchema.approvalConfig.id })
        .from(tenantSchema.approvalConfig)
        .where(eq(tenantSchema.approvalConfig.transactionType, config.transactionType))
        .limit(1);

      const values: Record<string, any> = {
        transactionType: config.transactionType,
        isRequired: config.isRequired,
        approverRoleId: config.approverRoleId || null,
        thresholdAmount: config.thresholdAmount || null,
      };

      if (existing.length > 0) {
        await req.tenantDb
          .update(tenantSchema.approvalConfig)
          .set(values)
          .where(eq(tenantSchema.approvalConfig.id, existing[0].id));
      } else {
        await req.tenantDb.insert(tenantSchema.approvalConfig).values(values as any);
      }
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 8);

    res.json({ message: 'Approval rules updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error updating approval rules:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/9:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 9 - Sync Settings
 *     description: Update sync configuration for each location by code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locations
 *             properties:
 *               locations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - locationCode
 *                     - syncConfig
 *                   properties:
 *                     locationCode:
 *                       type: string
 *                     syncConfig:
 *                       type: object
 *                       properties:
 *                         frequency:
 *                           type: string
 *                           enum: [once_daily, twice_daily, custom]
 *                         windows:
 *                           type: array
 *                           items:
 *                             type: string
 *                         bandwidthMode:
 *                           type: string
 *                           enum: [full, compressed]
 *                         manualSyncEnabled:
 *                           type: boolean
 *                         autoSyncOnReconnect:
 *                           type: boolean
 *     responses:
 *       200:
 *         description: Sync settings updated successfully
 *       400:
 *         description: Validation error
 */
onboardingRoutes.put('/step/9', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.tenantDb || !req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const parsed = syncSettingsSchema.parse(req.body);
    let updated = 0;

    for (const loc of parsed.locations) {
      const result = await req.tenantDb
        .update(tenantSchema.location)
        .set({ syncConfig: loc.syncConfig as any })
        .where(eq(tenantSchema.location.code, loc.locationCode))
        .returning();

      if (result.length > 0) {
        updated++;
      }
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 9);

    res.json({
      message: 'Sync settings updated successfully.',
      updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', details: error.issues });
    }
    console.error('Error updating sync settings:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/step/10:
 *   put:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Step 10 - Review & Go Live
 *     description: Validates that all required steps (1, 3) are completed before going live
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review passed, ready to go live
 *       400:
 *         description: Required steps not completed
 */
onboardingRoutes.put('/step/10', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const tenantRecord = await getTenantRecord(req.sharedDb, req.tenantCode);
    if (!tenantRecord) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const currentStep = tenantRecord.onboardingStep || 0;

    // Validate required steps are completed
    const incompleteRequired = REQUIRED_STEPS.filter((s) => currentStep < s);
    if (incompleteRequired.length > 0) {
      const stepNames = incompleteRequired.map(
        (s) => STEPS.find((st) => st.step === s)?.name || `Step ${s}`
      );
      return res.status(400).json({
        error: 'Required steps not completed.',
        incompleteSteps: stepNames,
      });
    }

    await advanceOnboardingStep(req.sharedDb, req.tenantCode, 10);

    res.json({ message: 'Review completed. Ready to go live.' });
  } catch (error) {
    console.error('Error in review step:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * @swagger
 * /api/modules/tenant-onboarding/complete:
 *   post:
 *     tags:
 *       - Tenant Onboarding
 *     summary: Finalize onboarding
 *     description: Sets tenant status to active and marks onboarding as complete
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       400:
 *         description: Required steps not completed
 */
onboardingRoutes.post('/complete', authorized('ADMIN', 'tenant-onboarding.wizard.manage'), async (req, res) => {
  if (!req.sharedDb || !req.tenantCode) {
    return res.status(500).json({ error: 'Tenant context not resolved.' });
  }

  try {
    const tenantRecord = await getTenantRecord(req.sharedDb, req.tenantCode);
    if (!tenantRecord) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const currentStep = tenantRecord.onboardingStep || 0;

    // Validate required steps are completed
    const incompleteRequired = REQUIRED_STEPS.filter((s) => currentStep < s);
    if (incompleteRequired.length > 0) {
      const stepNames = incompleteRequired.map(
        (s) => STEPS.find((st) => st.step === s)?.name || `Step ${s}`
      );
      return res.status(400).json({
        error: 'Cannot complete onboarding. Required steps not finished.',
        incompleteSteps: stepNames,
      });
    }

    // Set tenant to active and onboardingStep to 10
    await req.sharedDb
      .update(sharedSchema.tenant)
      .set({
        status: 'active',
        onboardingStep: 10,
      })
      .where(eq(sharedSchema.tenant.code, req.tenantCode));

    res.json({
      success: true,
      message: 'Onboarding complete',
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default onboardingRoutes;
