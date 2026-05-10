import { eq, and } from 'drizzle-orm';
import {
  category,
  product,
  productVariant,
  barcode,
  inventory,
  inventoryMovement,
} from '@server/lib/db/schema/tenantSchema';
import { mokaMigrationBatch, mokaMigrationEntry } from './db/schemas/mokaSchema';
import { TransformResult, MokaProduct } from './transformer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

interface ImportOptions {
  db: AnyDb;
  result: TransformResult;
  locationId: string;
  userId: string;
  fileName: string;
}

interface ImportSummary {
  batchId: string;
  categoriesCreated: number;
  productsCreated: number;
  variantsCreated: number;
  barcodesCreated: number;
  stockEntries: number;
  modifiersSkipped: number;
  warnings: string[];
}

// Generates a fallback SKU when MokaPOS row has none
function makeSku(name: string, suffix = ''): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20);
  return suffix ? `${base}-${suffix}` : base;
}

function detectBarcodeType(value: string): 'ean13' | 'upca' | 'internal' {
  if (/^\d{13}$/.test(value)) return 'ean13';
  if (/^\d{12}$/.test(value)) return 'upca';
  return 'internal';
}

export async function runMokaImport(opts: ImportOptions): Promise<ImportSummary> {
  const { db, result, locationId, userId, fileName } = opts;
  const warnings = [...result.warnings];

  // Create batch record
  const [batch] = await db
    .insert(mokaMigrationBatch)
    .values({
      importedBy: userId,
      locationId,
      fileName,
      status: 'pending',
      totalRows: result.products.length + result.modifiersSkipped,
      modifiersSkipped: result.modifiersSkipped,
    })
    .returning();

  const batchId = batch.id;

  const trackEntry = async (entityType: string, entityId: string) => {
    await db.insert(mokaMigrationEntry).values({ batchId, entityType, entityId });
  };

  let categoriesCreated = 0;
  let productsCreated = 0;
  let variantsCreated = 0;
  let barcodesCreated = 0;
  let stockEntries = 0;

  // ── 1. Categories ──────────────────────────────────────────────────────────
  const categoryIdByName = new Map<string, string>();

  for (const cat of result.categories) {
    const existing = await db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, cat.name))
      .limit(1)
      .then((r: { id: string }[]) => r[0]);

    if (existing) {
      categoryIdByName.set(cat.name, existing.id);
    } else {
      const [created] = await db
        .insert(category)
        .values({ name: cat.name, level: 1, status: 'active' })
        .returning({ id: category.id });
      categoryIdByName.set(cat.name, created.id);
      await trackEntry('category', created.id);
      categoriesCreated++;
    }
  }

  // ── 2. Products ────────────────────────────────────────────────────────────
  for (const p of result.products) {
    try {
      const productId = await upsertProduct(db, p, categoryIdByName, warnings);
      await trackEntry('product', productId);
      productsCreated++;

      // ── 3. Variants ──────────────────────────────────────────────────────
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          const sku = v.sku || makeSku(p.name, v.attribute);
          const existing = await db
            .select({ id: productVariant.id })
            .from(productVariant)
            .where(eq(productVariant.variantSku, sku))
            .limit(1)
            .then((r: { id: string }[]) => r[0]);

          let variantId: string;
          if (existing) {
            variantId = existing.id;
          } else {
            const [created] = await db
              .insert(productVariant)
              .values({
                productId,
                variantSku: sku,
                attributes: { option: v.attribute },
                costPrice: String(v.cost),
                sellingPrice: String(v.price),
                status: 'active',
              })
              .returning({ id: productVariant.id });
            variantId = created.id;
            await trackEntry('variant', variantId);
            variantsCreated++;
          }

          // Barcode for variant
          if (v.barcode) {
            const bc = await insertBarcodeIfNew(db, v.barcode, productId, variantId);
            if (bc) { await trackEntry('barcode', bc); barcodesCreated++; }
          }

          // Stock for variant
          if (p.trackInventory && v.stock > 0) {
            const invId = await upsertInventory(db, locationId, productId, variantId, v.stock);
            await trackEntry('inventory', invId);
            const movId = await insertMovement(db, locationId, productId, v.stock);
            await trackEntry('movement', movId);
            stockEntries++;
          }
        }
      } else {
        // ── 4. Barcode for standalone product ────────────────────────────
        if (p.barcode) {
          const bc = await insertBarcodeIfNew(db, p.barcode, productId, null);
          if (bc) { await trackEntry('barcode', bc); barcodesCreated++; }
        }

        // ── 5. Opening stock ─────────────────────────────────────────────
        if (p.trackInventory && p.stock > 0) {
          const invId = await upsertInventory(db, locationId, productId, null, p.stock);
          await trackEntry('inventory', invId);
          const movId = await insertMovement(db, locationId, productId, p.stock);
          await trackEntry('movement', movId);
          stockEntries++;
        }
      }
    } catch (err) {
      warnings.push(`Product "${p.name}": ${(err as Error).message}`);
    }
  }

  // ── 6. Mark batch complete ─────────────────────────────────────────────────
  await db
    .update(mokaMigrationBatch)
    .set({
      status: 'completed',
      categoriesCreated,
      productsCreated,
      variantsCreated,
      barcodesCreated,
      stockEntries,
      warnings: warnings.length ? warnings : null,
      completedAt: new Date(),
    })
    .where(eq(mokaMigrationBatch.id, batchId));

  return {
    batchId,
    categoriesCreated,
    productsCreated,
    variantsCreated,
    barcodesCreated,
    stockEntries,
    modifiersSkipped: result.modifiersSkipped,
    warnings,
  };
}

async function upsertProduct(
  db: AnyDb,
  p: MokaProduct,
  categoryIdByName: Map<string, string>,
  warnings: string[]
): Promise<string> {
  const sku = p.sku || makeSku(p.name);
  const categoryId = p.categoryName ? categoryIdByName.get(p.categoryName) ?? null : null;

  const existing = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.skuCode, sku))
    .limit(1)
    .then((r: { id: string }[]) => r[0]);

  if (existing) {
    warnings.push(`Product SKU "${sku}" already exists — skipped`);
    return existing.id;
  }

  const [created] = await db
    .insert(product)
    .values({
      skuCode: sku,
      name: p.name,
      categoryId,
      baseCostPrice: String(p.cost),
      sellingPrice: String(p.price),
      taxApplicable: true,
      status: 'active',
    })
    .returning({ id: product.id });

  return created.id;
}

async function insertBarcodeIfNew(
  db: AnyDb,
  value: string,
  productId: string,
  variantId: string | null
): Promise<string | null> {
  const existing = await db
    .select({ id: barcode.id })
    .from(barcode)
    .where(eq(barcode.barcodeValue, value))
    .limit(1)
    .then((r: { id: string }[]) => r[0]);

  if (existing) return null;

  const [created] = await db
    .insert(barcode)
    .values({
      barcodeValue: value,
      barcodeType: detectBarcodeType(value),
      productId,
      variantId: variantId ?? undefined,
    })
    .returning({ id: barcode.id });

  return created.id;
}

async function upsertInventory(
  db: AnyDb,
  locationId: string,
  productId: string,
  variantId: string | null,
  qty: number
): Promise<string> {
  const conditions = variantId
    ? and(eq(inventory.locationId, locationId), eq(inventory.productId, productId), eq(inventory.variantId, variantId))
    : and(eq(inventory.locationId, locationId), eq(inventory.productId, productId));

  const existing = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(conditions)
    .limit(1)
    .then((r: { id: string }[]) => r[0]);

  if (existing) {
    await db
      .update(inventory)
      .set({ qtyOnHand: qty })
      .where(eq(inventory.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(inventory)
    .values({
      locationId,
      productId,
      variantId: variantId ?? undefined,
      qtyOnHand: qty,
    })
    .returning({ id: inventory.id });

  return created.id;
}

async function insertMovement(
  db: AnyDb,
  locationId: string,
  productId: string,
  qty: number
): Promise<string> {
  const [created] = await db
    .insert(inventoryMovement)
    .values({
      locationId,
      productId,
      movementType: 'opening_balance',
      qty,
      balanceAfter: qty,
    })
    .returning({ id: inventoryMovement.id });

  return created.id;
}

export async function rollbackBatch(db: AnyDb, batchId: string): Promise<void> {
  // Fetch all entries ordered by entity type for correct deletion order
  const entries: { entityType: string; entityId: string }[] = await db
    .select({ entityType: mokaMigrationEntry.entityType, entityId: mokaMigrationEntry.entityId })
    .from(mokaMigrationEntry)
    .where(eq(mokaMigrationEntry.batchId, batchId));

  const order = ['movement', 'inventory', 'barcode', 'variant', 'product', 'category'];
  const grouped = new Map<string, string[]>();
  for (const e of entries) {
    if (!grouped.has(e.entityType)) grouped.set(e.entityType, []);
    grouped.get(e.entityType)!.push(e.entityId);
  }

  for (const type of order) {
    const ids = grouped.get(type) ?? [];
    for (const id of ids) {
      try {
        if (type === 'movement') await db.delete(inventoryMovement).where(eq(inventoryMovement.id, id));
        else if (type === 'inventory') await db.delete(inventory).where(eq(inventory.id, id));
        else if (type === 'barcode') await db.delete(barcode).where(eq(barcode.id, id));
        else if (type === 'variant') await db.delete(productVariant).where(eq(productVariant.id, id));
        else if (type === 'product') await db.delete(product).where(eq(product.id, id));
        else if (type === 'category') await db.delete(category).where(eq(category.id, id));
      } catch {
        // Entity may already be gone — continue
      }
    }
  }

  await db
    .update(mokaMigrationBatch)
    .set({ status: 'rolled_back' })
    .where(eq(mokaMigrationBatch.id, batchId));
}
