import axios from 'axios';
import { z } from 'zod';

export const productFormSchema = z.object({
  id: z.string().optional(),
  skuCode: z.string().min(1, "SKU Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  brand: z.string().optional().nullable(),
  uom: z.string().default('pcs'),
  baseCostPrice: z.coerce.number({ error: "Base cost price is required" }),
  sellingPrice: z.coerce.number({ error: "Selling price is required" }),
  taxApplicable: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'discontinued', 'archived'], {
    error: "Status is required",
  }).default('draft'),
}).refine(
  async (data) => {
    try {
      const response = await axios.post('/api/modules/product-catalog/product/validate-sku', {
        id: data.id,
        skuCode: data.skuCode,
      });
      return response.status == 200;
    } catch (error) {
      return false;
    }
  },
  {
    message: "SKU Code must be unique",
    path: ["skuCode"],
  }
);
