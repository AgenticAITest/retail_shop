import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  parentId: z.string().uuid().optional().nullable(),
  sortOrder: z.coerce.number().default(0),
});
