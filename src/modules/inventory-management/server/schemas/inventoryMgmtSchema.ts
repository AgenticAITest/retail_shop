import { z } from 'zod';

export const createStockCountSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  notes: z.string().nullable().optional(),
});

export const recordCountLineSchema = z.object({
  productId: z.string().uuid(),
  skuCode: z.string().min(1),
  productName: z.string().min(1),
  countedQty: z.number().int().min(0, "Counted qty must be 0 or more"),
});

export const recordCountLinesSchema = z.object({
  lines: z.array(recordCountLineSchema).min(1, "At least one line required"),
});

export const createAdjustmentSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  productId: z.string().uuid("Invalid product ID"),
  skuCode: z.string().min(1),
  productName: z.string().min(1),
  qty: z.number().int().refine(v => v !== 0, "Quantity cannot be zero"),
  reasonCode: z.enum(['damage', 'theft', 'write_off', 'correction', 'other'], { message: "Invalid reason code" }),
  notes: z.string().nullable().optional(),
});

export const alertConfigSchema = z.object({
  locationId: z.string().uuid("Invalid location ID"),
  productId: z.string().uuid("Invalid product ID"),
  minQty: z.number().int().min(0).default(0),
  maxQty: z.number().int().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type AlertConfigInput = z.infer<typeof alertConfigSchema>;
