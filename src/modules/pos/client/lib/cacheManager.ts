/**
 * Cache Manager — Syncs server data to local IndexedDB for offline use.
 *
 * Downloads products, categories, tax config, and inventory from the
 * server API and stores them in Dexie.js IndexedDB tables.
 */

import axios from 'axios';
import { offlineDb, type LocalProduct, type LocalCategory, type LocalPrice, type LocalTaxConfig, type LocalInventory } from './offlineDb';

export interface CacheSyncProgress {
  stage: 'products' | 'categories' | 'taxConfig' | 'inventory' | 'complete';
  current: number;
  total: number;
}

/**
 * Sync all active products to local IndexedDB
 */
export async function syncProductsToLocal(locationId?: string): Promise<number> {
  const params: any = { perPage: 5000, status: 'active' };
  if (locationId) params.locationId = locationId;

  const res = await axios.get('/api/modules/pos/transaction/products', { params });
  const products: LocalProduct[] = (res.data.products || []).map((p: any) => ({
    id: p.id,
    skuCode: p.skuCode,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    brand: p.brand,
    uom: p.uom,
    sellingPrice: parseFloat(p.sellingPrice),
    taxApplicable: p.taxApplicable,
    imageUrl: p.imageUrl,
    status: 'active',
  }));

  await offlineDb.products.clear();
  if (products.length > 0) {
    await offlineDb.products.bulkPut(products);
  }

  return products.length;
}

/**
 * Sync categories to local IndexedDB
 */
export async function syncCategoriesToLocal(): Promise<number> {
  const res = await axios.get('/api/modules/pos/transaction/categories');
  const categories: LocalCategory[] = (res.data.categories || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    level: c.level,
    sortOrder: c.sortOrder,
    status: 'active',
  }));

  await offlineDb.categories.clear();
  if (categories.length > 0) {
    await offlineDb.categories.bulkPut(categories);
  }

  return categories.length;
}

/**
 * Sync active tax config to local IndexedDB
 */
export async function syncTaxConfigToLocal(): Promise<void> {
  try {
    const res = await axios.get('/api/modules/tax-configuration/config/active');
    if (res.data) {
      const tc: LocalTaxConfig = {
        id: res.data.id,
        ratePercent: parseFloat(res.data.ratePercent),
        calcMode: res.data.calcMode,
        status: 'active',
      };
      await offlineDb.taxConfig.clear();
      await offlineDb.taxConfig.put(tc);
    }
  } catch {
    // Tax config might not exist
  }
}

/**
 * Sync inventory for a location to local IndexedDB
 */
export async function syncInventoryToLocal(locationId: string): Promise<number> {
  const res = await axios.get('/api/modules/pos/inventory', {
    params: { locationId, perPage: 10000 },
  });
  const items: LocalInventory[] = (res.data.inventory || []).map((i: any) => ({
    locationId: i.locationId,
    productId: i.productId,
    qtyOnHand: i.qtyOnHand,
  }));

  // Clear only this location's inventory
  await offlineDb.inventory.where('locationId').equals(locationId).delete();
  if (items.length > 0) {
    await offlineDb.inventory.bulkPut(items);
  }

  return items.length;
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<Date | null> {
  const meta = await offlineDb.syncMeta.get('lastSyncTime');
  return meta ? new Date(meta.value) : null;
}

/**
 * Set last sync timestamp
 */
export async function setLastSyncTime(time: Date): Promise<void> {
  await offlineDb.syncMeta.put({ key: 'lastSyncTime', value: time.toISOString() });
}

/**
 * Full cache sync — downloads all catalog data to IndexedDB.
 * Non-blocking, runs in background.
 */
export async function fullCacheSync(
  locationId: string,
  onProgress?: (progress: CacheSyncProgress) => void,
): Promise<{ products: number; categories: number; inventory: number }> {
  onProgress?.({ stage: 'products', current: 0, total: 4 });
  const products = await syncProductsToLocal(locationId);

  onProgress?.({ stage: 'categories', current: 1, total: 4 });
  const categories = await syncCategoriesToLocal();

  onProgress?.({ stage: 'taxConfig', current: 2, total: 4 });
  await syncTaxConfigToLocal();

  onProgress?.({ stage: 'inventory', current: 3, total: 4 });
  const inventory = await syncInventoryToLocal(locationId);

  await setLastSyncTime(new Date());
  onProgress?.({ stage: 'complete', current: 4, total: 4 });

  return { products, categories, inventory };
}
