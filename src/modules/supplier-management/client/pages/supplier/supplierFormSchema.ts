import axios from 'axios';
import { z } from 'zod';

const bankDetailsSchema = z.object({
  bankName: z.string().optional().nullable(),
  accountNumber: z.string().optional().nullable(),
  accountHolder: z.string().optional().nullable(),
}).optional().nullable();

export const supplierFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  npwp: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().optional().nullable(),
  bankDetails: bankDetailsSchema,
  status: z.enum(['active', 'inactive'], {
    error: "Status is required",
  }).default('active'),
}).refine(
  async (data) => {
    try {
      const response = await axios.post('/api/modules/supplier-management/supplier/validate-code', {
        id: data.id,
        code: data.code,
      });
      return response.status == 200;
    } catch (error) {
      return false;
    }
  },
  {
    message: "Code must be unique",
    path: ["code"],
  }
);
