import axios from 'axios';
import { z } from 'zod';

const syncConfigFormSchema = z.object({
  frequency: z.enum(['once_daily', 'twice_daily', 'custom']),
  windows: z.array(z.string()),
  bandwidthMode: z.enum(['full', 'compressed']),
  manualSyncEnabled: z.boolean(),
  autoSyncOnReconnect: z.boolean(),
}).optional().nullable();

export const locationFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(['shop', 'warehouse', 'distribution_center'], {
    error: "Type is required",
  }),
  parentId: z.string().uuid().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  timezone: z.string().default('Asia/Jakarta'),
  syncConfig: syncConfigFormSchema,
  status: z.enum(['active', 'inactive']).default('active'),
}).refine(
  async (data) => {
    try {
      const response = await axios.post('/api/modules/location-management/location/validate-code', {
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
