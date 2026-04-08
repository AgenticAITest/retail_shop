import { z } from 'zod';

export const poItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  skuCode: z.string().min(1, "SKU code is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Unit price must be 0 or more"),
  discountPercent: z.number().min(0).max(100).default(0),
  uom: z.string().default('pcs'),
  supplierSku: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createPoSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID"),
  locationId: z.string().uuid("Invalid location ID").nullable().optional(),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(poItemSchema).min(1, "At least one line item is required"),
});

export const updatePoSchema = z.object({
  supplierId: z.string().uuid("Invalid supplier ID").optional(),
  locationId: z.string().uuid("Invalid location ID").nullable().optional(),
  orderDate: z.string().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  changeReason: z.string().min(1, "Change reason is required for amendments"),
  items: z.array(poItemSchema).min(1, "At least one line item is required"),
});

export const statusTransitionSchema = z.object({
  status: z.enum([
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'partially_received',
    'fully_received',
    'closed',
    'cancelled',
  ]),
  reason: z.string().optional(),
});

export const cancelPoSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});

export type CreatePoInput = z.infer<typeof createPoSchema>;
export type UpdatePoInput = z.infer<typeof updatePoSchema>;
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;
export type CancelPoInput = z.infer<typeof cancelPoSchema>;
