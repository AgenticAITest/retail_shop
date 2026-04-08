import { z } from 'zod';

export const returnItemFormSchema = z.object({
  grnItemId: z.string().min(1, "GRN item reference is required"),
  productId: z.string(),
  skuCode: z.string(),
  productName: z.string(),
  acceptedQuantity: z.coerce.number().int(),
  alreadyReturned: z.coerce.number().int(),
  returnableQuantity: z.coerce.number().int(),
  returnQuantity: z.coerce.number().int().min(0, "Return quantity must be 0 or more"),
  reasonCode: z.enum(['defective', 'damaged', 'expired', 'excess', 'wrong_item']).or(z.literal('')),
  reasonNotes: z.string().optional().nullable(),
  uom: z.string().default('pcs'),
});

export const returnFormSchema = z.object({
  grnId: z.string().min(1, "GRN is required"),
  returnDate: z.string().min(1, "Return date is required"),
  notes: z.string().optional().nullable(),
  items: z.array(returnItemFormSchema).min(1, "At least one line item is required"),
});

export type ReturnFormValues = z.infer<typeof returnFormSchema>;
export type ReturnItemFormValues = z.infer<typeof returnItemFormSchema>;
