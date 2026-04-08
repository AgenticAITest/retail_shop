/**
 * Offline Transaction Creation
 *
 * Creates transactions locally in IndexedDB when offline.
 * Queues them in syncQueue for later push to server.
 */

import { offlineDb, type LocalTransaction, type LocalTransactionItem, type LocalPayment, type SyncQueueItem } from './offlineDb';

interface OfflineCartItem {
  productId: string;
  variantId: string | null;
  skuCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxApplicable: boolean;
  discountType?: string | null;
  discountValue?: number;
}

interface OfflinePayment {
  paymentMethod: string;
  amount: number;
  paymentRef?: string | null;
  amountTendered?: number | null;
  changeAmount?: number | null;
}

interface CreateOfflineTransactionInput {
  items: OfflineCartItem[];
  payments: OfflinePayment[];
  shiftId: string | null;
  locationId: string;
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  transactionDiscount?: any;
}

const WARN_THRESHOLD = 2000;
const BLOCK_THRESHOLD = 5000;

/**
 * Create an offline transaction — saves to Dexie and queues for sync
 */
export async function createOfflineTransaction(input: CreateOfflineTransactionInput): Promise<{
  offlineId: string;
  blocked: boolean;
}> {
  // Check queue threshold
  const pendingCount = await offlineDb.syncQueue.where('status').anyOf(['pending', 'failed']).count();
  if (pendingCount >= BLOCK_THRESHOLD) {
    return { offlineId: '', blocked: true };
  }

  const offlineId = crypto.randomUUID();
  const now = new Date();

  // Save transaction to local store
  const txn: LocalTransaction = {
    id: offlineId,
    offlineId,
    shiftId: input.shiftId,
    locationId: input.locationId,
    transactionId: `OFFLINE-${offlineId.substring(0, 8).toUpperCase()}`,
    totalAmount: input.totalAmount,
    status: 'completed',
    syncStatus: 'local',
    createdAt: now,
  };
  await offlineDb.transactions.put(txn);

  // Save items
  for (const item of input.items) {
    const lineItem: LocalTransactionItem = {
      transactionId: offlineId,
      productId: item.productId,
      skuCode: item.skuCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.quantity * item.unitPrice,
    };
    await offlineDb.transactionItems.add(lineItem);
  }

  // Save payments
  for (const payment of input.payments) {
    const p: LocalPayment = {
      transactionId: offlineId,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      paymentRef: payment.paymentRef || null,
    };
    await offlineDb.payments.add(p);
  }

  // Queue for sync
  const queueItem: SyncQueueItem = {
    type: 'transaction',
    status: 'pending',
    data: {
      offlineId,
      shiftId: input.shiftId,
      items: input.items,
      payments: input.payments,
      totalAmount: input.totalAmount,
      subtotal: input.subtotal,
      discountAmount: input.discountAmount,
      taxAmount: input.taxAmount,
      transactionDiscount: input.transactionDiscount,
      completedAt: now.toISOString(),
    },
    createdAt: now,
  };
  await offlineDb.syncQueue.add(queueItem);

  return { offlineId, blocked: false };
}

/**
 * Get count of unsynced offline transactions
 */
export async function getOfflineTransactionCount(): Promise<number> {
  return offlineDb.transactions.where('syncStatus').equals('local').count();
}

/**
 * Get queue threshold status
 */
export async function getQueueThresholdStatus(): Promise<{
  count: number;
  warning: boolean;
  blocked: boolean;
}> {
  const count = await offlineDb.syncQueue.where('status').anyOf(['pending', 'failed']).count();
  return {
    count,
    warning: count >= WARN_THRESHOLD,
    blocked: count >= BLOCK_THRESHOLD,
  };
}
