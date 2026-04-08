import { z } from 'zod';

export const returnItemSchema = z.object({
  grnItemId: z.string().uuid("Invalid GRN item ID"),
  productId: z.string().uuid("Invalid product ID"),
  skuCode: z.string().min(1, "SKU code is required"),
  productName: z.string().min(1, "Product name is required"),
  returnQuantity: z.number().int().min(1, "Return quantity must be at least 1"),
  reasonCode: z.enum(['defective', 'damaged', 'expired', 'excess', 'wrong_item'], {
    message: "Invalid reason code",
  }),
  reasonNotes: z.string().nullable().optional(),
  uom: z.string().default('pcs'),
});

export const createReturnSchema = z.object({
  grnId: z.string().uuid("Invalid GRN ID"),
  returnDate: z.string().min(1, "Return date is required"),
  notes: z.string().nullable().optional(),
  items: z.array(returnItemSchema).min(1, "At least one line item is required"),
});

export const returnStatusTransitionSchema = z.object({
  status: z.enum([
    'requested', 'pending_approval', 'approved', 'dispatched',
    'acknowledged', 'credit_note_received', 'closed', 'rejected',
  ]),
  rejectionReason: z.string().optional(),
});

export const createCreditNoteSchema = z.object({
  supplierReturnId: z.string().uuid("Invalid supplier return ID"),
  creditNoteNumber: z.string().min(1, "Credit note number is required"),
  amount: z.number().positive("Amount must be positive"),
  creditDate: z.string().min(1, "Credit date is required"),
  notes: z.string().nullable().optional(),
  isReplacement: z.boolean().default(false),
  replacementGrnId: z.string().uuid().nullable().optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ReturnStatusTransitionInput = z.infer<typeof returnStatusTransitionSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;
