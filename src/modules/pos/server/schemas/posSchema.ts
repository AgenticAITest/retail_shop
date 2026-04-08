import { z } from 'zod';

export const posTransactionItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid().nullable().optional(),
  skuCode: z.string().min(1, "SKU code is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be 0 or more"),
  taxApplicable: z.boolean().default(true),
  discountType: z.enum(['percent', 'fixed']).nullable().optional(),
  discountValue: z.number().min(0).default(0),
});

export const paymentMethodSchema = z.object({
  paymentMethod: z.enum(['cash', 'card', 'qris', 'transfer']),
  amount: z.number().positive("Payment amount must be positive"),
  paymentRef: z.string().nullable().optional(),
  amountTendered: z.number().min(0).nullable().optional(),
});

export const checkoutSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  items: z.array(posTransactionItemSchema).min(1, "At least one item is required"),
  payments: z.array(paymentMethodSchema).min(1, "At least one payment method is required"),
  transactionDiscount: z.object({
    type: z.enum(['percent', 'fixed']),
    value: z.number().min(0),
  }).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const voidTransactionSchema = z.object({
  voidReason: z.string().min(1, "Void reason is required"),
});

export const inventoryAdjustSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int(),
  reason: z.string().min(1, "Adjustment reason is required"),
});

// Shift schemas
export const openShiftSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  openingFloat: z.number().min(0).default(0),
});

export const closeShiftSchema = z.object({
  actualCash: z.number().min(0, "Actual cash must be 0 or more"),
  varianceReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const cashDropSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
});

// Hold schemas
export const holdTransactionSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  customerNote: z.string().nullable().optional(),
  cartData: z.any(),
  totalAmount: z.number().min(0),
});

// Sync schemas
export const syncPushItemSchema = z.object({
  type: z.enum(['transaction', 'shift']),
  offlineId: z.string().uuid("Invalid offline ID"),
  data: z.any(),
});

export const syncPushSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  deviceId: z.string().min(1).default('browser'),
  items: z.array(syncPushItemSchema).min(1),
});

export const syncPullSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  lastPullTimestamp: z.string().nullable().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type VoidTransactionInput = z.infer<typeof voidTransactionSchema>;
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;
export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type CashDropInput = z.infer<typeof cashDropSchema>;
export type HoldTransactionInput = z.infer<typeof holdTransactionSchema>;
