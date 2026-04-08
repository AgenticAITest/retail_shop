/**
 * Sync Engine — Orchestrates push/pull sync between IndexedDB and server.
 *
 * Push: reads pending items from syncQueue, batches to /sync/push, marks synced.
 * Pull: sends lastPullTimestamp to /sync/pull, stores updates in Dexie.
 * Retry: exponential backoff (1s, 2s, 4s, 8s, max 30s).
 */

import axios from 'axios';
import { offlineDb } from './offlineDb';

export interface SyncProgress {
  phase: 'push' | 'pull' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface QueueStats {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
}

const BATCH_SIZE = 50;
const MAX_RETRY_DELAY = 30000;

let isSyncing = false;

/**
 * Get sync queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const pending = await offlineDb.syncQueue.where('status').equals('pending').count();
  const syncing = await offlineDb.syncQueue.where('status').equals('syncing').count();
  const synced = await offlineDb.syncQueue.where('status').equals('synced').count();
  const failed = await offlineDb.syncQueue.where('status').equals('failed').count();
  return { pending, syncing, synced, failed, total: pending + syncing + synced + failed };
}

/**
 * Push pending transactions to server
 */
export async function pushPendingTransactions(
  locationId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ accepted: number; rejected: number }> {
  const pending = await offlineDb.syncQueue
    .where('status').equals('pending')
    .limit(BATCH_SIZE)
    .toArray();

  if (pending.length === 0) return { accepted: 0, rejected: 0 };

  onProgress?.({ phase: 'push', current: 0, total: pending.length, message: `Pushing ${pending.length} items...` });

  // Mark as syncing
  const ids = pending.map(p => p.localId!).filter(Boolean);
  await offlineDb.syncQueue.where('localId').anyOf(ids).modify({ status: 'syncing' });

  const pushItems = pending.map(p => ({
    type: p.type,
    offlineId: p.data?.offlineId || crypto.randomUUID(),
    data: p.data,
  }));

  let retryDelay = 1000;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      const res = await axios.post('/api/modules/pos/sync/push', {
        locationId,
        deviceId: 'browser',
        items: pushItems,
      });

      const { accepted, rejected } = res.data;

      // Mark accepted as synced
      for (const item of pending) {
        const offlineId = item.data?.offlineId;
        const wasAccepted = (accepted || []).includes(offlineId);
        await offlineDb.syncQueue.update(item.localId!, {
          status: wasAccepted ? 'synced' : 'failed',
        });
      }

      onProgress?.({ phase: 'push', current: pending.length, total: pending.length, message: 'Push complete' });

      return { accepted: (accepted || []).length, rejected: (rejected || []).length };
    } catch {
      attempts++;
      if (attempts >= maxAttempts) {
        // Mark all as failed after max retries
        await offlineDb.syncQueue.where('localId').anyOf(ids).modify({ status: 'failed' });
        return { accepted: 0, rejected: pending.length };
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, retryDelay));
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    }
  }

  return { accepted: 0, rejected: pending.length };
}

/**
 * Pull server updates into local Dexie
 */
export async function pullServerUpdates(
  locationId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ products: number; categories: number; inventory: number }> {
  onProgress?.({ phase: 'pull', current: 0, total: 3, message: 'Pulling updates...' });

  const meta = await offlineDb.syncMeta.get('lastPullTimestamp');
  const lastPull = meta?.value || null;

  const res = await axios.post('/api/modules/pos/sync/pull', {
    locationId,
    lastPullTimestamp: lastPull,
  });

  const { products, categories, taxConfig: tc, inventory: inv, timestamp } = res.data;

  // Upsert products
  if (products?.length > 0) {
    const localProducts = products.map((p: any) => ({
      id: p.id, skuCode: p.skuCode, name: p.name,
      categoryId: p.categoryId, categoryName: null,
      brand: p.brand, uom: p.uom,
      sellingPrice: parseFloat(p.sellingPrice),
      taxApplicable: p.taxApplicable, imageUrl: null,
      status: p.status,
    }));
    await offlineDb.products.bulkPut(localProducts);
  }

  onProgress?.({ phase: 'pull', current: 1, total: 3, message: `${products?.length || 0} products updated` });

  // Upsert categories
  if (categories?.length > 0) {
    const localCats = categories.map((c: any) => ({
      id: c.id, name: c.name, parentId: c.parentId,
      level: c.level, sortOrder: c.sortOrder, status: c.status,
    }));
    await offlineDb.categories.bulkPut(localCats);
  }

  onProgress?.({ phase: 'pull', current: 2, total: 3, message: `${categories?.length || 0} categories updated` });

  // Update tax config
  if (tc) {
    await offlineDb.taxConfig.clear();
    await offlineDb.taxConfig.put({
      id: tc.id, ratePercent: parseFloat(tc.ratePercent),
      calcMode: tc.calcMode, status: 'active',
    });
  }

  // Update inventory
  if (inv?.length > 0) {
    await offlineDb.inventory.where('locationId').equals(locationId).delete();
    await offlineDb.inventory.bulkPut(inv.map((i: any) => ({
      locationId: i.locationId, productId: i.productId, qtyOnHand: i.qtyOnHand,
    })));
  }

  // Store pull timestamp
  await offlineDb.syncMeta.put({ key: 'lastPullTimestamp', value: timestamp });
  await offlineDb.syncMeta.put({ key: 'lastSyncTime', value: new Date().toISOString() });

  onProgress?.({ phase: 'pull', current: 3, total: 3, message: 'Pull complete' });

  return {
    products: products?.length || 0,
    categories: categories?.length || 0,
    inventory: inv?.length || 0,
  };
}

/**
 * Run full sync cycle: push first (outbound priority), then pull
 */
export async function runFullSync(
  locationId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ push: { accepted: number; rejected: number }; pull: { products: number; categories: number; inventory: number } }> {
  if (isSyncing) throw new Error('Sync already in progress');
  isSyncing = true;

  try {
    const pushResult = await pushPendingTransactions(locationId, onProgress);
    const pullResult = await pullServerUpdates(locationId, onProgress);
    onProgress?.({ phase: 'complete', current: 1, total: 1, message: 'Sync complete' });
    return { push: pushResult, pull: pullResult };
  } finally {
    isSyncing = false;
  }
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}
