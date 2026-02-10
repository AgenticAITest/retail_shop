import { z } from 'zod';

export const eventAddSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Max 100 chars'),
  description: z.string().max(1000, 'Max 1000 chars').optional(),
  isActive: z.boolean().default(true),
});

export const eventEditSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100, 'Max 100 chars'),
  description: z.string().max(1000, 'Max 1000 chars').optional(),
  isActive: z.boolean().default(true),
});

export const eventQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(10),
  isActive: z.union([
    z.boolean(),
    z.string().transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      throw new Error('Invalid boolean value');
    })
  ]).optional(),
  name: z.string().optional(),
});

export type EventAddData = z.infer<typeof eventAddSchema>;
export type EventEditData = z.infer<typeof eventEditSchema>;
export type EventQueryParams = z.infer<typeof eventQuerySchema>;