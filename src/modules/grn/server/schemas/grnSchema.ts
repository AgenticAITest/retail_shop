import { z } from 'zod';

export const grnItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid("Invalid PO item ID"),
  productId: z.string().uuid("Invalid product ID"),
  skuCode: z.string().min(1, "SKU code is required"),
  productName: z.string().min(1, "Product name is required"),
  orderedQuantity: z.number().int().min(0),
  previouslyReceivedQuantity: z.number().int().min(0),
  receivedQuantity: z.number().int().min(0, "Received quantity must be 0 or more"),
  acceptedQuantity: z.number().int().min(0, "Accepted quantity must be 0 or more"),
  rejectedQuantity: z.number().int().min(0).default(0),
  rejectionReasonCode: z.string().nullable().optional(),
  rejectionNotes: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  lotNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  uom: z.string().default('pcs'),
}).refine(
  (data) => data.acceptedQuantity + data.rejectedQuantity === data.receivedQuantity,
  { message: "Accepted + Rejected must equal Received quantity", path: ["receivedQuantity"] }
);

export const createGrnSchema = z.object({
  purchaseOrderId: z.string().uuid("Invalid purchase order ID"),
  locationId: z.string().uuid("Invalid location ID").nullable().optional(),
  receivedDate: z.string().min(1, "Received date is required"),
  deliveryNoteRef: z.string().nullable().optional(),
  invoiceRef: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(grnItemSchema).min(1, "At least one line item is required"),
});

export const grnStatusTransitionSchema = z.object({
  status: z.enum(['draft', 'quality_inspection', 'accepted', 'stock_updated']),
  qualityCheckPassed: z.boolean().optional(),
  qualityNotes: z.string().optional(),
});

export type CreateGrnInput = z.infer<typeof createGrnSchema>;
export type GrnStatusTransitionInput = z.infer<typeof grnStatusTransitionSchema>;
