import { z } from 'zod';

export const transferItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  skuCode: z.string().min(1, "SKU code is required"),
  productName: z.string().min(1, "Product name is required"),
  requestedQty: z.number().int().min(1, "Quantity must be at least 1"),
  uom: z.string().default('pcs'),
});

export const createTransferSchema = z.object({
  sourceLocationId: z.string().uuid("Invalid source location"),
  destLocationId: z.string().uuid("Invalid destination location"),
  notes: z.string().nullable().optional(),
  items: z.array(transferItemSchema).min(1, "At least one item is required"),
});

export const transferStatusSchema = z.object({
  status: z.enum(['requested', 'pending_approval', 'approved', 'picking', 'dispatched', 'received', 'closed']),
  // For receive: item-level receive data
  receiveItems: z.array(z.object({
    transferItemId: z.string().uuid(),
    receivedQty: z.number().int().min(0),
    discrepancyReason: z.enum(['short', 'over', 'damaged']).nullable().optional(),
    discrepancyNotes: z.string().nullable().optional(),
  })).optional(),
  // For picking: picked quantities
  pickItems: z.array(z.object({
    transferItemId: z.string().uuid(),
    pickedQty: z.number().int().min(0),
  })).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferStatusInput = z.infer<typeof transferStatusSchema>;
