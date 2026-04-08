/**
 * Dexie.js IndexedDB Schema for POS Offline Support
 *
 * Stores product catalog, prices, tax config, inventory, transactions,
 * and sync metadata locally for offline operation.
 */

import Dexie, { type Table } from 'dexie';

// ============================================================
// Type Definitions
// ============================================================

export interface LocalProduct {
  id: string;
  skuCode: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  uom: string;
  sellingPrice: number;
  taxApplicable: boolean;
  imageUrl: string | null;
  status: string;
}

export interface LocalCategory {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  status: string;
}

export interface LocalPrice {
  productId: string;
  locationId: string;
  costPrice: number | null;
  sellingPrice: number | null;
}

export interface LocalTaxConfig {
  id: string;
  ratePercent: number;
  calcMode: 'inclusive' | 'exclusive';
  status: string;
}

export interface LocalInventory {
  locationId: string;
  productId: string;
  qtyOnHand: number;
}

export interface SyncQueueItem {
  localId?: number;
  type: 'transaction' | 'shift' | 'held';
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  data: any;
  createdAt: Date;
}

export interface LocalTransaction {
  id: string;
  offlineId: string;
  shiftId: string | null;
  locationId: string;
  transactionId: string;
  totalAmount: number;
  status: string;
  syncStatus: 'local' | 'synced';
  createdAt: Date;
}

export interface LocalTransactionItem {
  id?: number;
  transactionId: string;
  productId: string;
  skuCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LocalPayment {
  id?: number;
  transactionId: string;
  paymentMethod: string;
  amount: number;
  paymentRef: string | null;
}

export interface LocalHeldTransaction {
  id: string;
  shiftId: string | null;
  cartData: any;
  totalAmount: number;
  customerNote: string | null;
  createdAt: Date;
}

export interface SyncMeta {
  key: string;
  value: any;
}

// ============================================================
// Database Class
// ============================================================

class PosOfflineDB extends Dexie {
  products!: Table<LocalProduct, string>;
  categories!: Table<LocalCategory, string>;
  prices!: Table<LocalPrice, [string, string]>;
  taxConfig!: Table<LocalTaxConfig, string>;
  inventory!: Table<LocalInventory, [string, string]>;
  syncQueue!: Table<SyncQueueItem, number>;
  transactions!: Table<LocalTransaction, string>;
  transactionItems!: Table<LocalTransactionItem, number>;
  payments!: Table<LocalPayment, number>;
  heldTransactions!: Table<LocalHeldTransaction, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super('pos_offline');

    this.version(1).stores({
      products: 'id, skuCode, categoryId, status',
      categories: 'id, parentId, status',
      prices: '[productId+locationId], productId',
      taxConfig: 'id, status',
      inventory: '[locationId+productId], locationId',
      syncQueue: '++localId, type, status, createdAt',
      transactions: 'id, offlineId, shiftId, locationId, syncStatus',
      transactionItems: '++id, transactionId',
      payments: '++id, transactionId',
      heldTransactions: 'id, shiftId',
      syncMeta: 'key',
    });
  }
}

// Singleton instance
export const offlineDb = new PosOfflineDB();
