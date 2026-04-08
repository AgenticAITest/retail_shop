import { z } from 'zod';

export const poItemFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productName: z.string().optional(),
  skuCode: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price must be 0 or more"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  uom: z.string().default('pcs'),
  supplierSku: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const poFormSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().min(1, "Supplier is required"),
  locationId: z.string().optional().nullable(),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDeliveryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(poItemFormSchema).min(1, "At least one line item is required"),
});

export type PoFormValues = z.infer<typeof poFormSchema>;
export type PoItemFormValues = z.infer<typeof poItemFormSchema>;
