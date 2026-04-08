import { z } from 'zod';

export const grnItemFormSchema = z.object({
  purchaseOrderItemId: z.string().min(1, "PO item reference is required"),
  productId: z.string(),
  skuCode: z.string(),
  productName: z.string(),
  orderedQuantity: z.coerce.number().int(),
  previouslyReceivedQuantity: z.coerce.number().int(),
  remainingQuantity: z.coerce.number().int(),
  receivedQuantity: z.coerce.number().int().min(0, "Received quantity must be 0 or more"),
  acceptedQuantity: z.coerce.number().int().min(0, "Accepted quantity must be 0 or more"),
  rejectedQuantity: z.coerce.number().int().min(0).default(0),
  rejectionReasonCode: z.string().optional().nullable(),
  rejectionNotes: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  uom: z.string().default('pcs'),
});

export const grnFormSchema = z.object({
  purchaseOrderId: z.string().min(1, "Purchase Order is required"),
  locationId: z.string().optional().nullable(),
  receivedDate: z.string().min(1, "Received date is required"),
  deliveryNoteRef: z.string().optional().nullable(),
  invoiceRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(grnItemFormSchema).min(1, "At least one line item is required"),
});

export type GrnFormValues = z.infer<typeof grnFormSchema>;
export type GrnItemFormValues = z.infer<typeof grnItemFormSchema>;
