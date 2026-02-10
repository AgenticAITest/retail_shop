import axios from 'axios';
import { ref } from 'process';
import { z } from 'zod';

export const documentFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().nonempty("Name is required"),
  code: z.string().nonempty("Code is required"),
  releaseDate: z.date().optional(),
  pages: z.number().optional(),
}).refine(
  async (data) => {
    // Check if the code is unique within the tenant
    try {
      const response = await axios.post('/api/modules/demo-module/document/validate-code', data);
      return response.status == 200;
    } catch (error) {
      console.error("Error validating document code:", error);
      return false;
    }

  },
  {
    message: "Code must be unique",
    path: ["code"],
  }
);

export const documentImportSchema = z.object({
  file: z.instanceof(File, { message: "File is required" })
    .refine((file) => file.size > 0, { message: "File is required" })
    .refine((file) => file.type === "text/csv" || file.name.endsWith(".csv"), { message: "File must be a CSV" }), 
});

export const documentBulkEditFormSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one document must be selected"),
  releaseDate: z.date().optional(),
  pages: z.number().optional(),
}).refine(
  (data) => data.releaseDate !== undefined || data.pages !== undefined,
  {
    message: "At least one of Release Date or Pages must be filled.",
    path: ["releaseDate"], // atau ["pages"], atau kosong []
  }
);
