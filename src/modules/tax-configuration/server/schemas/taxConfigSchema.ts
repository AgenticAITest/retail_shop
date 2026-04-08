import { z } from 'zod';

export const taxConfigSchema = z.object({
  ratePercent: z
    .number({ error: "Rate is required" })
    .min(0, "Rate must be at least 0")
    .max(100, "Rate must be at most 100"),
  effectiveDate: z.coerce.date({ error: "Effective date is required" }),
  calcMode: z.enum(['inclusive', 'exclusive'], {
    error: "Calculation mode is required",
  }),
});
