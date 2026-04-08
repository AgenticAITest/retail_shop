import { z } from 'zod';

export const approvalConfigUpdateSchema = z.object({
  isRequired: z.boolean({
    error: 'isRequired must be a boolean',
  }),
  approverRoleId: z.string().uuid({ error: 'approverRoleId must be a valid UUID' }).optional(),
  thresholdAmount: z.coerce.number({ error: 'thresholdAmount must be a number' }).nullable().optional(),
  timeoutHours: z.number({ error: 'timeoutHours must be a number' }).optional().default(24),
  timeoutAction: z.enum(['escalate', 'auto_approve'], {
    error: 'timeoutAction must be either escalate or auto_approve',
  }).optional(),
});

export const rejectSchema = z.object({
  reason: z.string({
    error: 'Reason is required',
  }).min(1, { error: 'Reason cannot be empty' }),
});

export type ApprovalConfigUpdate = z.infer<typeof approvalConfigUpdateSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
